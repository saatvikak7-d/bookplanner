# Code Review Guide: BookPlanner Architecture & Implementation

Use this document as a quick reference sheet during your code review. It explains how everything works under the hood, why key architectural decisions were made, and provides strong talking points.

---

## 1. The 30-Second Elevator Pitch
> *"BookPlanner is a decoupled, multi-service reading assistant that parses uploaded PDF books, splits them into optimal 10-minute reading chunks (calculated via words-per-minute), tracks reading progress dynamically in a local database, and provides an AI chatbot using Retrieval-Augmented Generation (RAG) over the book's text."*

---

## 2. High-Level System Architecture & Data Flow

```
[React Frontend (Vite)] ──(1. Upload PDF)──> [Spring Boot (Java)]
                                                    │
                                           (2. Parse & Chunk Text)
                                                    │
                                           (3. Persist to H2/Postgres)
                                                    │
                                           (4. Index Payload)
                                                    ▼
[OpenRouter API] <──(6. Chat RAG Request)── [FastAPI (Python)]
                                                    │
                                          (5. Local FAISS Search)
```

1. **Upload & Processing**: The user uploads a PDF on the React frontend. The Spring Boot backend receives the file, extracts the text using Apache PDFBox 3.0, splits it into ~2000-word logical chunks, estimates reading times, and saves the `Book` and `ReadingChunk` entities to an in-memory H2 database.
2. **Indexing**: Once saved, the backend triggers an asynchronous REST call to the Python FastAPI service containing the text chunks and their database IDs.
3. **Embedding & Vector Search**: The AI Service generates deterministic 384-dimensional hashed text vectors for each chunk and loads them into a local **FAISS (Facebook AI Similarity Search)** index file.
4. **RAG Chat Query**: When the user asks a question, the request goes from React to Spring Boot, which proxies it to the Python service. The Python service embeds the question, queries the local FAISS index for the top-3 closest matching text chunks, appends them as prompt context, and queries **OpenRouter** (defaulting to Llama-3-8B Free) to synthesize the answer.
5. **Response & Citations**: The AI response flows back to the frontend with specific citations mapping chunk IDs and page ranges, allowing the user to click a source and immediately view the corresponding text in the reader modal.

---

## 3. Key Architectural Decisions (The "Why")

Be ready to justify your engineering choices with these arguments:

*   **Q: Why separate Java (Backend) and Python (AI)?**
    *   *A:* **Separation of Concerns and Performance.** Java is highly suited for business logic, database transactions, file uploads, and standard REST gateways. Python is the industry standard for ML. By keeping them separate, we prevent heavy machine-learning processes (like generating embeddings on CPU) from blocking the web server threads.
*   **Q: Why use FAISS with local hashed text vectors instead of a cloud database (like Pinecone)?**
    *   *A:* **Cost and Latency.** Pushing embeddings to a cloud database adds network overhead and database hosting costs. Generating deterministic local vectors and searching them with FAISS is fast, completely free, requires zero server setup, avoids heavyweight model dependencies, and allows the RAG database to scale dynamically as static files in local storage.
*   **Q: Why replace Lombok in the Java entities?**
    *   *A:* **Build Stability.** Lombok relies on annotation processing during compilation, which frequently breaks across different IDE versions, Maven setups, and CI/CD pipelines. Writing standard POJO builders and getters/setters guarantees compile-time safety and cross-platform compatibility.
*   **Q: Why OpenRouter instead of OpenAI?**
    *   *A:* **Model Flexibility and Cost.** OpenRouter acts as a unified gateway. If we want to switch models (from Llama-3 to Gemini, Claude, or GPT-4), we only change the environment variable name (`OPENROUTER_MODEL`). It also allows us to utilize free, high-performance open-source models without vendor lock-in.

---

## 4. Key Files and Code Highlights

If asked to show code, open and explain these files:

### A. The Chunking Engine: [PdfProcessingService.java](file:///Users/saatvikak/.gemini/antigravity-ide/scratch/bookplanner/backend/src/main/java/com/bookplanner/service/PdfProcessingService.java)
*   **How PDFBox works:** Line 62 uses `Loader.loadPDF(bytes)` to load the document in memory safely. We loop page-by-page to extract text boundaries.
*   **Chapter Detection:** Line 74 compiles a regex pattern `(?i)^\\s*(Chapter|Section|Part)\\s+(\\d+|[IVXLCDM]+)\\b` to look for chapter titles in the top 5 lines of each page.
*   **Chunk boundary:** If a chapter is detected OR the chunk exceeds `TARGET_WORDS_PER_CHUNK` (~2000 words), we write the chunk to the DB and start a new one. This ensures we don't sever paragraphs mid-thought.

### B. The Vector Store: [vector_store.py](file:///Users/saatvikak/.gemini/antigravity-ide/scratch/bookplanner/ai-service/vector_store.py)
*   **Embedding Model:** `HashingEmbedder` creates deterministic 384-dimensional vectors locally without downloading or importing transformer models.
*   **Index Creation:** Line 34 builds the FAISS index: `index = faiss.IndexFlatL2(self.dimension)`. We add the query vectors and save the index to disk as `.index` and `.meta` files mapped by `book_id`.
*   **Similarity Search:** Line 82 runs `index.search(query_vector, top_k)`. This does high-speed Euclidean distance calculation in vector space to find the most semantically relevant text chunks.

### C. The OpenRouter & Fallback Gateway: [main.py](file:///Users/saatvikak/.gemini/antigravity-ide/scratch/bookplanner/ai-service/main.py)
*   **API Client:** Line 19 sets up a custom OpenAI client pointing to OpenRouter's URL `https://openrouter.ai/api/v1` with mandatory referer headers.
*   **Offline Mode:** If `OPENROUTER_API_KEY` is not present, line 114 catches the condition and runs `generate_offline_answer()`. It returns a summary snippet of the top search results to ensure the product remains interactive even without internet or keys.

### D. The React Client: [App.tsx](file:///Users/saatvikak/.gemini/antigravity-ide/scratch/bookplanner/frontend/src/App.tsx)
*   **Clean State Management:** Tracks `books`, `selectedBook`, `chunks`, and `messages` arrays.
*   **Inline Reader Modal:** Active chunk content is loaded dynamically in a modal overlay, allowing the user to mark it completed directly.
*   **Source Citations:** Assistant responses append clickable citation buttons that link to source chunk IDs.

---

## 5. Technical Talking Points & Buzzwords

Sprinkle these phrases into your explanations:
1.  **"Decoupled Microservices"**: *"We chose a decoupled model, using Spring Boot for REST API routing and file handling, and FastAPI for our ML pipeline."*
2.  **"Retrieval-Augmented Generation (RAG)"**: *"Instead of fine-tuning a model on the book, we utilize RAG. We index chunks locally, fetch context semantically, and pipe it to the LLM to get factual, hallucination-free answers."*
3.  **"Local FAISS Vector Indexing"**: *"We store embeddings in local FAISS files using L2 (Euclidean) distance, mapping them to DB IDs. It's incredibly light and runs completely in memory."*
4.  **"Deterministic Chunking Algorithm"**: *"Our chunking script uses a hybrid approach: chapter boundaries are prioritized via regex detection, with a sliding word-count ceiling of 2000 words to keep reading sessions around 10 minutes."*
