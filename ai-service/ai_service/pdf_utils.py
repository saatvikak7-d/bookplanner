import io
from typing import List, Dict
import PyPDF2


def extract_text(pdf_bytes: bytes) -> str:
    """Extract full text from a PDF file.

    Args:
        pdf_bytes: Raw PDF content as bytes.
    Returns:
        The concatenated text of all pages.
    """
    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    text_parts: List[str] = []
    for page in reader.pages:
        try:
            text_parts.append(page.extract_text() or "")
        except Exception:
            # Fallback to empty string for problematic pages
            text_parts.append("")
    return "\n".join(text_parts)


def chunk_text(full_text: str, max_words: int = 1500) -> List[Dict]:
    """Split the extracted text into roughly *max_words* sized chunks.

    The function also creates a minimal metadata dict for each chunk that matches the
    `ChunkInput` model used by the router.
    """
    words = full_text.split()
    chunks: List[Dict] = []
    chunk_id = 1
    for i in range(0, len(words), max_words):
        chunk_words = words[i:i + max_words]
        content = " ".join(chunk_words)
        chunk = {
            "chunk_id": chunk_id,
            "chunk_index": i // max_words,
            "title": f"Chunk {chunk_id}",
            "content": content,
            "start_page": 0,
            "end_page": 0,
        }
        chunks.append(chunk)
        chunk_id += 1
    return chunks
