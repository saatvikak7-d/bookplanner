package com.bookplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "reading_chunks")
public class ReadingChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    @JsonIgnore
    private Book book;

    private int chunkIndex;
    private String title;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String content;

    private int startPage;
    private int endPage;
    private int wordCount;
    private int estimatedReadingTime; // in minutes
    private boolean completed;

    public ReadingChunk() {
    }

    public ReadingChunk(Long id, Book book, int chunkIndex, String title, String content, int startPage, int endPage, int wordCount, int estimatedReadingTime, boolean completed) {
        this.id = id;
        this.book = book;
        this.chunkIndex = chunkIndex;
        this.title = title;
        this.content = content;
        this.startPage = startPage;
        this.endPage = endPage;
        this.wordCount = wordCount;
        this.estimatedReadingTime = estimatedReadingTime;
        this.completed = completed;
    }

    // Builder Pattern Helper
    public static ReadingChunkBuilder builder() {
        return new ReadingChunkBuilder();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Book getBook() { return book; }
    public void setBook(Book book) { this.book = book; }

    public int getChunkIndex() { return chunkIndex; }
    public void setChunkIndex(int chunkIndex) { this.chunkIndex = chunkIndex; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; return; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public int getStartPage() { return startPage; }
    public void setStartPage(int startPage) { this.startPage = startPage; }

    public int getEndPage() { return endPage; }
    public void setEndPage(int endPage) { this.endPage = endPage; }

    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }

    public int getEstimatedReadingTime() { return estimatedReadingTime; }
    public void setEstimatedReadingTime(int estimatedReadingTime) { this.estimatedReadingTime = estimatedReadingTime; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public static class ReadingChunkBuilder {
        private Long id;
        private Book book;
        private int chunkIndex;
        private String title;
        private String content;
        private int startPage;
        private int endPage;
        private int wordCount;
        private int estimatedReadingTime;
        private boolean completed;

        public ReadingChunkBuilder id(Long id) { this.id = id; return this; }
        public ReadingChunkBuilder book(Book book) { this.book = book; return this; }
        public ReadingChunkBuilder chunkIndex(int chunkIndex) { this.chunkIndex = chunkIndex; return this; }
        public ReadingChunkBuilder title(String title) { this.title = title; return this; }
        public ReadingChunkBuilder content(String content) { this.content = content; return this; }
        public ReadingChunkBuilder startPage(int startPage) { this.startPage = startPage; return this; }
        public ReadingChunkBuilder endPage(int endPage) { this.endPage = endPage; return this; }
        public ReadingChunkBuilder wordCount(int wordCount) { this.wordCount = wordCount; return this; }
        public ReadingChunkBuilder estimatedReadingTime(int estimatedReadingTime) { this.estimatedReadingTime = estimatedReadingTime; return this; }
        public ReadingChunkBuilder completed(boolean completed) { this.completed = completed; return this; }

        public ReadingChunk build() {
            // Fix double return type compile errors
            return new ReadingChunk(id, book, chunkIndex, title, content, startPage, endPage, wordCount, estimatedReadingTime, completed);
        }
    }
}
