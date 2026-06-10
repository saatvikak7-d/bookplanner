import pickle
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
import os
from .models import Book, ChunkInput, IndexRequest, ChatRequest, ChatResponse, Citation, ChunkDTO
from .vector_store import vector_store_manager
from .config import settings
from fastapi.responses import JSONResponse
from openai import OpenAI
from .pdf_utils import extract_text, chunk_text

router = APIRouter()

# In‑memory storage for books (id counter managed here)
books: List[Book] = []
_book_id_counter = 1

# OpenRouter client (optional)
client = None
if settings.openrouter_api_key:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
        default_headers={
            "HTTP-Referer": "https://github.com/Saatvikak/bookplanner",
            "X-Title": "BookPlanner AI Assistant",
        },
    )

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "openrouter_configured": client is not None,
        "model": settings.openrouter_model if client else None,
    }

@router.get("/api/books", response_model=List[Book])
def list_books():
    return books

@router.post("/api/books/upload", response_model=Book)
async def upload_book(file: UploadFile = File(...)):
    global _book_id_counter, books
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    # Read PDF bytes
    pdf_bytes = await file.read()
    # Extract full text
    full_text = extract_text(pdf_bytes)
    # Chunk into ~1500‑word pieces
    chunks = chunk_text(full_text)
    # Create book entry
    new_book = Book(
        id=_book_id_counter,
        title=file.filename or f"Untitled Book {_book_id_counter}",
    )
    books.append(new_book)
    # Index chunks
    vector_store_manager.index_book(_book_id_counter, chunks)
    _book_id_counter += 1
    return new_book

@router.get("/api/books/{book_id}/chunks", response_model=List[ChunkDTO])
def get_book_chunks(book_id: int):
    chunks = vector_store_manager.get_chunks(book_id)
    if not chunks:
        raise HTTPException(status_code=404, detail="Book not found or no chunks indexed")
    # Convert plain dicts to ChunkDTO instances (pydantic will handle aliasing)
    return [ChunkDTO(**c) for c in chunks]

@router.post("/api/index")
def index_book(payload: IndexRequest):
    chunks_dict = [c.model_dump() for c in payload.chunks]
    success = vector_store_manager.index_book(payload.book_id, chunks_dict)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to index chunks")
    return {"message": f"Successfully indexed {len(payload.chunks)} chunks for book {payload.book_id}"}

@router.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    relevant = vector_store_manager.search(payload.book_id, payload.question, top_k=3)
    if not relevant:
        return ChatResponse(answer="I couldn't find any relevant sections in the book.", citations=[])
    # Build citation list
    citations = [Citation(
        chunk_id=r["chunk_id"],
        chunk_index=r["chunk_index"],
        title=r["title"],
        start_page=r["start_page"],
        end_page=r["end_page"]
    ) for r in relevant]
    # Build context for LLM
    context = "\n\n".join([
        f"--- Source: {c['title']} (Pages {c['start_page']}-{c['end_page']}) ---\n{c['content']}"
        for c in relevant
    ])
    if client:
        try:
            system_prompt = (
                "You are a helpful reading assistant for a book planner application. "
                "Answer the user's question about the book based ONLY on the context provided below. "
                "If the context doesn't contain the answer, say that you don't know based on the provided text. "
                "Keep your answer concise, accurate, and professional."
            )
            user_prompt = f"Context from the book:\n{context}\n\nQuestion: {payload.question}"
            response = client.chat.completions.create(
                model=settings.openrouter_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                temperature=0.3,
            )
            answer = response.choices[0].message.content.strip()
        except Exception as e:
            answer = f"Error querying OpenRouter API: {e}. Falling back to offline answer.\n" + generate_offline_answer(payload.question, relevant)
    else:
        answer = generate_offline_answer(payload.question, relevant)
    return ChatResponse(answer=answer, citations=citations)

def generate_offline_answer(question: str, chunks: List[dict]) -> str:
    """Very simple fallback that returns the first matching snippet."""
    main = chunks[0]
    snippet = main["content"][:300].strip() + "..."
    return (
        f"Based on the most relevant section in **{main['title']}** (pages {main['start_page']}-{main['end_page']}):\n\n"
        f"\"{snippet}\"\n\nYou can refer to these sections directly for a complete answer."
    )

@router.patch("/api/books/{book_id}/chunks/{chunk_id}")
def toggle_chunk_completed(book_id: int, chunk_id: int, completed: bool):
    # Load metadata, modify the `completed` flag, and save back.
    index_path, meta_path = vector_store_manager._get_paths(book_id)
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Book metadata not found")
    with open(meta_path, "rb") as f:
        meta = pickle.load(f)
    # Find entry by chunk_id
    for info in meta.values():
        if info.get("chunk_id") == chunk_id:
            info["completed"] = completed
            break
    else:
        raise HTTPException(status_code=404, detail="Chunk not found")
    with open(meta_path, "wb") as f:
        pickle.dump(meta, f)
    return {"message": f"Chunk {chunk_id} completed set to {completed}"}
api_router = router
