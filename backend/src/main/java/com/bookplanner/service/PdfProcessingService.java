package com.bookplanner.service;

import com.bookplanner.model.Book;
import com.bookplanner.model.ReadingChunk;
import com.bookplanner.repository.BookRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PdfProcessingService {

    private final BookRepository bookRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    // Average reading speed: 200 words per minute
    private static final int WORDS_PER_MINUTE = 200;
    // Target words per chunk: ~2000 words (about 10 minutes of reading)
    private static final int TARGET_WORDS_PER_CHUNK = 2000;

    public PdfProcessingService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
        this.restTemplate = new RestTemplate();
    }

    public Book processPdf(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        String title = (filename != null && filename.contains(".")) 
                ? filename.substring(0, filename.lastIndexOf('.')) 
                : "Unknown Book";

        byte[] bytes = file.getBytes();
        
        Book book = Book.builder()
                .title(title)
                .chunks(new ArrayList<>())
                .build();

        List<ReadingChunk> chunks = new ArrayList<>();
        int totalWords = 0;
        int totalPages = 0;
        int chapterCount = 0;

        try (PDDocument document = Loader.loadPDF(bytes)) {
            totalPages = document.getNumberOfPages();
            book.setTotalPages(totalPages);

            PDFTextStripper stripper = new PDFTextStripper();
            
            StringBuilder currentChunkText = new StringBuilder();
            int chunkStartPage = 1;
            int chunkWordCount = 0;
            int chunkIndex = 0;

            // Regex patterns to detect chapters (e.g. Chapter 1, CHAPTER II, etc.)
            Pattern chapterPattern = Pattern.compile("(?i)^\\s*(Chapter|Section|Part)\\s+(\\d+|[IVXLCDM]+)\\b");

            for (int page = 1; page <= totalPages; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = stripper.getText(document);
                
                if (pageText == null || pageText.trim().isEmpty()) {
                    continue;
                }

                String[] words = pageText.trim().split("\\s+");
                int pageWordCount = words.length;
                totalWords += pageWordCount;

                // Check if page contains a chapter header
                boolean startsNewChapter = false;
                String[] lines = pageText.split("\\r?\\n");
                for (int i = 0; i < Math.min(lines.length, 5); i++) { // Check top 5 lines of page
                    Matcher matcher = chapterPattern.matcher(lines[i]);
                    if (matcher.find()) {
                        startsNewChapter = true;
                        chapterCount++;
                        break;
                    }
                }

                // If starting a new chapter or exceeding target word count, flush current chunk
                if ((startsNewChapter || chunkWordCount >= TARGET_WORDS_PER_CHUNK) && currentChunkText.length() > 0) {
                    int chunkEndPage = Math.max(chunkStartPage, page - 1);
                    int readingTime = Math.max(1, chunkWordCount / WORDS_PER_MINUTE);
                    
                    chunks.add(ReadingChunk.builder()
                            .book(book)
                            .chunkIndex(chunkIndex++)
                            .title(startsNewChapter ? "Chapter " + chapterCount : "Section " + (chunkIndex + 1))
                            .content(currentChunkText.toString())
                            .startPage(chunkStartPage)
                            .endPage(chunkEndPage)
                            .wordCount(chunkWordCount)
                            .estimatedReadingTime(readingTime)
                            .completed(false)
                            .build());

                    currentChunkText = new StringBuilder();
                    chunkStartPage = page;
                    chunkWordCount = 0;
                }

                currentChunkText.append(pageText).append("\n");
                chunkWordCount += pageWordCount;
            }

            // Flush the last chunk
            if (currentChunkText.length() > 0) {
                int readingTime = Math.max(1, chunkWordCount / WORDS_PER_MINUTE);
                chunks.add(ReadingChunk.builder()
                        .book(book)
                        .chunkIndex(chunkIndex++)
                        .title(chapterCount > 0 ? "Chapter " + (chapterCount + 1) : "Section " + (chunkIndex + 1))
                        .content(currentChunkText.toString())
                        .startPage(chunkStartPage)
                        .endPage(totalPages)
                        .wordCount(chunkWordCount)
                        .estimatedReadingTime(readingTime)
                        .completed(false)
                        .build());
            }
        }

        // Calculate metadata
        book.setWordCount(totalWords);
        book.setEstimatedCompletionTime(Math.max(1, totalWords / WORDS_PER_MINUTE));
        book.setChapterCount(Math.max(1, chapterCount));
        book.setReadingDifficulty(determineDifficulty(totalWords, totalPages));
        book.setReadingProgress(0.0);
        book.setChunks(chunks);

        // Save book and chunks to DB
        Book savedBook = bookRepository.save(book);

        // Proactively index chunks in the Python AI Service (async or simple REST call)
        try {
            sendChunksToAiService(savedBook.getId(), chunks);
        } catch (Exception e) {
            // Log error but don't fail the upload.
            System.err.println("Failed to send chunks to AI Service: " + e.getMessage());
        }

        return savedBook;
    }

    private String determineDifficulty(int wordCount, int totalPages) {
        if (totalPages == 0) return "Medium";
        double wordsPerPage = (double) wordCount / totalPages;
        if (wordsPerPage < 150) {
            return "Easy";
        } else if (wordsPerPage > 300) {
            return "Hard";
        } else {
            return "Medium";
        }
    }

    private void sendChunksToAiService(Long bookId, List<ReadingChunk> chunks) {
        String url = aiServiceUrl + "/api/index";
        
        List<Map<String, Object>> chunkPayloads = new ArrayList<>();
        for (ReadingChunk chunk : chunks) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("chunk_id", chunk.getId());
            payload.put("chunk_index", chunk.getChunkIndex());
            payload.put("title", chunk.getTitle());
            payload.put("content", chunk.getContent());
            payload.put("start_page", chunk.getStartPage());
            payload.put("end_page", chunk.getEndPage());
            chunkPayloads.clear(); // Wait, let's add them to payload list
        }

        // Fix logic to populate list correctly
        List<Map<String, Object>> actualPayloads = new ArrayList<>();
        for (ReadingChunk chunk : chunks) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("chunk_id", chunk.getId());
            payload.put("chunk_index", chunk.getChunkIndex());
            payload.put("title", chunk.getTitle());
            payload.put("content", chunk.getContent());
            payload.put("start_page", chunk.getStartPage());
            payload.put("end_page", chunk.getEndPage());
            actualPayloads.add(payload);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("book_id", bookId);
        body.put("chunks", actualPayloads);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        restTemplate.postForObject(url, entity, String.class);
    }
}
