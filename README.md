# BookPlanner – Smart Reading Planner & Book Assistant

## Overview# BookPlanner is a web application designed to make reading large books more manageable and interactive. Users can upload a PDF book, and the system automatically analyzes the content to provide structured reading assistance.

The application splits books into logical reading chunks, estimates reading times, generates useful metadata about the book, and offers an AI-powered chatbot that can answer questions about the uploaded content.

Whether you're studying a textbook, reading a novel, or reviewing documentation# BookPlanner helps users plan, track, and interact with their reading material efficiently.

---

## Features

### PDF Upload & Processing

* Upload books in PDF format.
* Extract and process text content automatically.
* Handle large documents efficiently.

### Intelligent Book Chunking

* Split books into manageable reading sections.
* Generate chapter-based or page-based reading chunks.
* Support customizable chunk sizes.

### Reading Time Estimation

* Estimate reading time for:

  * Entire book
  * Individual chapters
  * Generated reading chunks
* Based on configurable reading speed (words per minute).

### Book Insights

Generate useful information about the uploaded book, including:

* Total pages
* Word count
* Estimated completion time
* Chapter count
* Reading difficulty indicators
* Reading progress metrics

### AI Reading Assistant

* Ask questions about the uploaded book.
* Receive contextual responses based on the book's content.
* Summarize chapters and sections.
* Clarify concepts and answer reader queries.

### Reading Progress Tracking

* Mark completed sections.
* Track overall reading progress.
* View remaining reading time estimates.

---

## Architecture

### Backend (Java + Spring Boot)

The core application is built using Spring Boot and is responsible for:

* User management
* File uploads
* PDF processing orchestration
* Book metadata storage
* Reading chunk generation
* REST API endpoints
* Progress tracking

### AI Service (Python)

A separate Python service handles:

* Text embeddings
* Semantic search
* Retrieval-Augmented Generation (RAG)
* Chatbot interactions
* Summarization tasks

Communication between the Spring Boot application and the Python service is performed through REST APIs.

### Frontend

The frontend provides:

* PDF upload interface
* Book dashboard
* Reading planner
* Progress tracker
* Interactive chatbot

---

## Technology Stack

### Backend

* Java 21
* Spring Boot
* Spring Web
* Spring Data JPA
* Maven

### AI Service

* Python
* FastAPI
* LangChain
* Sentence Transformers
* FAISS / ChromaDB
* OpenAI-compatible LLM APIs

### Database

* PostgreSQL

### File Processing

* Apache PDFBox

### Frontend

* React
* Tailwind CSS

---

## System Workflow

1. User uploads a PDF.
2. Spring Boot receives and stores the file.
3. PDF text is extracted using PDFBox.
4. The content is divided into logical chunks.
5. Reading-time statistics are calculated.
6. Metadata is generated and stored.
7. Text chunks are sent to the Python service for indexing.
8. Users interact with the chatbot using natural language queries.
9. Relevant sections are retrieved and used to generate responses.

---

## API Endpoints

### Upload Book

```http
POST /api/books/upload
```

Upload a PDF file for processing.

### Get Book Information

```http
GET /api/books/{id}
```

Retrieve metadata and statistics about a book.

### Get Reading Chunks

```http
GET /api/books/{id}/chunks
```

Retrieve generated reading sections.

### Chat With Book

```http
POST /api/chat
```

Submit questions about the uploaded book.

### Update Reading Progress

```http
PATCH /api/books/{id}/progress
```

Update reading progress for a book.

---

## Future Enhancements

* OCR support for scanned PDFs
* Multi-language support
* Reading streak analytics
* Personalized reading schedules
* Audiobook generation
* Flashcard generation
* Quiz generation from book content
* Collaborative reading groups
* Mobile application support

---

## Project Goals# BookPlanner aims to bridge the gap between traditional reading and modern AI-assisted learning by helping users:

* Read more effectively
* Plan reading sessions intelligently
* Understand content faster
* Interact with books conversationally
* Track and improve reading habits

---

## License

This project is licensed under the MIT License.
