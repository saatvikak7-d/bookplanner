import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
from openai import OpenAI

from vector_store import vector_store_manager

# Load environment variables (such as OPENAI_API_KEY)
load_dotenv()

app = FastAPI(title="BookPlanner AI Service", version="1.0.0")

# Setup OpenRouter client if API key is provided
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3-8b-instruct:free")

client = None
if OPENROUTER_API_KEY:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
        default_headers={
            "HTTP-Referer": "https://github.com/Saatvikak/bookplanner",
            "X-Title": "BookPlanner AI Assistant",
        }
    )

# Define request/response models
class ChunkInput(BaseModel):
    chunk_id: int
    chunk_index: int
    title: str
    content: str
    start_page: int
    end_page: int

class IndexRequest(BaseModel):
    book_id: int
    chunks: List[ChunkInput]

class ChatRequest(BaseModel):
    book_id: int
    question: str

class Citation(BaseModel):
    chunk_id: int
    chunk_index: int
    title: str
    start_page: int
    end_page: int

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]

@app.get("/health")
def health_check():
    return {"status": "ok", "openrouter_configured": client is not None, "model": OPENROUTER_MODEL if client else None}

@app.post("/api/index")
def index_book(payload: IndexRequest):
    chunks_dict = [chunk.model_dump() for chunk in payload.chunks]
    success = vector_store_manager.index_book(payload.book_id, chunks_dict)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to index chunks. Chunks list might be empty.")
    return {"message": f"Successfully indexed {len(payload.chunks)} chunks for book {payload.book_id}"}

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_book(payload: ChatRequest):
    # Retrieve top 3 relevant chunks
    relevant_chunks = vector_store_manager.search(payload.book_id, payload.question, top_k=3)
    
    if not relevant_chunks:
        return ChatResponse(
            answer="I couldn't find any relevant sections in the book to answer your question. Have you indexed this book?",
            citations=[]
        )

    # Build context from relevant chunks
    context_str = "\n\n".join([
        f"--- Source: {chunk['title']} (Pages {chunk['start_page']}-{chunk['end_page']}) ---\n{chunk['content']}"
        for chunk in relevant_chunks
    ])

    citations = [
        Citation(
            chunk_id=chunk["chunk_id"],
            chunk_index=chunk["chunk_index"],
            title=chunk["title"],
            start_page=chunk["start_page"],
            end_page=chunk["end_page"]
        )
        for chunk in relevant_chunks
    ]

    # Generate answer
    if client:
        try:
            # RAG prompt
            system_prompt = (
                "You are a helpful reading assistant for a book planner application. "
                "Answer the user's question about the book based ONLY on the context provided below. "
                "If the context doesn't contain the answer, say that you don't know based on the provided text. "
                "Keep your answer concise, accurate, and professional."
            )
            user_prompt = f"Context from the book:\n{context_str}\n\nQuestion: {payload.question}"

            response = client.chat.completions.create(
                model=OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )
            answer = response.choices[0].message.content.strip()
        except Exception as e:
            answer = f"Error querying OpenRouter API: {str(e)}. Falling back to local search content."
            # If API fails, fall back to offline answering
            answer += "\n\n" + generate_offline_answer(payload.question, relevant_chunks)
    else:
        # Offline fallback: construct an informative answer directly from the top search results
        answer = (
            "⚠️ [Running in Offline/Local Mode - OpenRouter API Key not set]\n\n"
            + generate_offline_answer(payload.question, relevant_chunks)
        )

    return ChatResponse(answer=answer, citations=citations)

def generate_offline_answer(question: str, chunks: List[dict]) -> str:
    """
    Constructs a simple local answer by pointing to the matching sections and summarizing relevant snippets.
    """
    # Simple semantic fallback: present the most relevant passages
    main_chunk = chunks[0]
    snippet = main_chunk["content"][:300].strip() + "..."
    
    ans = (
        f"Based on the most relevant section found in **{main_chunk['title']}** (pages {main_chunk['start_page']}-{main_chunk['end_page']}):\n\n"
        f"\"{snippet}\"\n\n"
        f"You can refer to these sections directly for a complete answer."
    )
    return ans

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
