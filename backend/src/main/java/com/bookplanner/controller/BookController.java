package com.bookplanner.controller;

import com.bookplanner.model.Book;
import com.bookplanner.model.ReadingChunk;
import com.bookplanner.repository.BookRepository;
import com.bookplanner.repository.ReadingChunkRepository;
import com.bookplanner.service.PdfProcessingService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allows calls from any local development origin (React dev server)
public class BookController {

    private final PdfProcessingService pdfProcessingService;
    private final BookRepository bookRepository;
    private final ReadingChunkRepository readingChunkRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public BookController(PdfProcessingService pdfProcessingService,
                          BookRepository bookRepository,
                          ReadingChunkRepository readingChunkRepository) {
        this.pdfProcessingService = pdfProcessingService;
        this.bookRepository = bookRepository;
        this.readingChunkRepository = readingChunkRepository;
        this.restTemplate = new RestTemplate();
    }

    // List all uploaded books
    @GetMapping("/books")
    public ResponseEntity<List<Book>> getAllBooks() {
        return ResponseEntity.ok(bookRepository.findAll());
    }

    // Get specific book metadata
    @GetMapping("/books/{id}")
    public ResponseEntity<Book> getBookById(@PathVariable Long id) {
        return bookRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Get chunks for a specific book
    @GetMapping("/books/{id}/chunks")
    public ResponseEntity<List<ReadingChunk>> getBookChunks(@PathVariable Long id) {
        List<ReadingChunk> chunks = readingChunkRepository.findByBookIdOrderByChunkIndexAsc(id);
        if (chunks.isEmpty() && !bookRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(chunks);
    }

    // Upload a book in PDF format
    @PostMapping("/books/upload")
    public ResponseEntity<?> uploadBook(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }
        if (!"application/pdf".equals(file.getContentType())) {
            return ResponseEntity.badRequest().body("Only PDF files are supported");
        }

        try {
            Book savedBook = pdfProcessingService.processPdf(file);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedBook);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error processing PDF: " + e.getMessage());
        }
    }

    // Mark a reading chunk as completed/uncompleted
    @PatchMapping("/books/{id}/chunks/{chunkId}")
    public ResponseEntity<?> updateChunkStatus(
            @PathVariable Long id,
            @PathVariable Long chunkId,
            @RequestBody Map<String, Boolean> statusUpdate) {

        Optional<Book> bookOpt = bookRepository.findById(id);
        Optional<ReadingChunk> chunkOpt = readingChunkRepository.findById(chunkId);

        if (bookOpt.isEmpty() || chunkOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Boolean completed = statusUpdate.get("completed");
        if (completed == null) {
            return ResponseEntity.badRequest().body("Missing 'completed' field in request body");
        }

        ReadingChunk chunk = chunkOpt.get();
        chunk.setCompleted(completed);
        readingChunkRepository.save(chunk);

        // Recalculate book completion percentage
        Book book = bookOpt.get();
        List<ReadingChunk> chunks = readingChunkRepository.findByBookIdOrderByChunkIndexAsc(id);
        
        long completedCount = chunks.stream().filter(ReadingChunk::isCompleted).count();
        double progressPercentage = chunks.isEmpty() ? 0.0 : ((double) completedCount / chunks.size()) * 100.0;
        
        // Round to two decimal places
        progressPercentage = Math.round(progressPercentage * 100.0) / 100.0;
        book.setReadingProgress(progressPercentage);
        
        Book updatedBook = bookRepository.save(book);

        Map<String, Object> response = new HashMap<>();
        response.put("chunkId", chunk.getId());
        response.put("completed", chunk.isCompleted());
        response.put("readingProgress", updatedBook.getReadingProgress());

        return ResponseEntity.ok(response);
    }

    // Relay chatbot queries to the Python AI service
    @PostMapping("/chat")
    public ResponseEntity<?> chatWithBook(@RequestBody Map<String, Object> chatRequest) {
        Object bookId = chatRequest.get("bookId");
        Object question = chatRequest.get("question");

        if (bookId == null || question == null) {
            return ResponseEntity.badRequest().body("Missing 'bookId' or 'question' in request body");
        }

        String url = aiServiceUrl + "/api/chat";

        Map<String, Object> body = new HashMap<>();
        body.put("book_id", bookId);
        body.put("question", question);

        try {
            // Forward the query to the FastAPI Python service
            ResponseEntity<Map> aiResponse = restTemplate.postForEntity(url, body, Map.class);
            return ResponseEntity.ok(aiResponse.getBody());
        } catch (Exception e) {
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "AI Service unavailable");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errResponse);
        }
    }
}
