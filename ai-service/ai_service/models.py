from pydantic import BaseModel, Field
from typing import List


# Book model returned to frontend
class Book(BaseModel):
    id: int
    title: str
    totalPages: int = 0
    wordCount: int = 0
    estimatedCompletionTime: int = 0
    chapterCount: int = 0
    readingDifficulty: str = "Easy"
    readingProgress: int = 0


# Input chunk for indexing — accepts both snake_case and camelCase
class ChunkInput(BaseModel):
    model_config = {"populate_by_name": True}

    chunk_id: int = Field(..., alias="chunkId")
    chunk_index: int = Field(..., alias="chunkIndex")
    title: str
    content: str
    start_page: int = Field(..., alias="startPage")
    end_page: int = Field(..., alias="endPage")


# Request model for bulk indexing — accepts both snake_case and camelCase
class IndexRequest(BaseModel):
    model_config = {"populate_by_name": True}

    book_id: int = Field(..., alias="bookId")
    chunks: List[ChunkInput]


# Chat request model — accepts both snake_case and camelCase
class ChatRequest(BaseModel):
    model_config = {"populate_by_name": True}

    book_id: int = Field(..., alias="bookId")
    question: str


# Citation model returned with chat answer
class Citation(BaseModel):
    chunk_id: int
    chunk_index: int
    title: str
    start_page: int
    end_page: int


# Chat response model
class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]


# Chunk DTO for retrieving stored chunks (used by GET /books/{id}/chunks)
class ChunkDTO(BaseModel):
    model_config = {"populate_by_name": True}

    id: int = Field(..., alias="chunk_id")
    chunkIndex: int = Field(..., alias="chunk_index")
    title: str
    content: str
    startPage: int = Field(..., alias="start_page")
    endPage: int = Field(..., alias="end_page")
    completed: bool = False
