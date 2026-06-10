package com.bookplanner.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private int totalPages;
    private int wordCount;
    private int estimatedCompletionTime; // in minutes
    private int chapterCount;
    private String readingDifficulty;
    private double readingProgress; // percentage (0.0 to 100.0)

    @OneToMany(mappedBy = "book", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ReadingChunk> chunks = new ArrayList<>();

    public Book() {
    }

    public Book(Long id, String title, int totalPages, int wordCount, int estimatedCompletionTime, int chapterCount, String readingDifficulty, double readingProgress, List<ReadingChunk> chunks) {
        this.id = id;
        this.title = title;
        this.totalPages = totalPages;
        this.wordCount = wordCount;
        this.estimatedCompletionTime = estimatedCompletionTime;
        this.chapterCount = chapterCount;
        this.readingDifficulty = readingDifficulty;
        this.readingProgress = readingProgress;
        this.chunks = chunks != null ? chunks : new ArrayList<>();
    }

    // Builder Pattern Helper
    public static BookBuilder builder() {
        return new BookBuilder();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getTotalPages() { return totalPages; }
    public void setTotalPages(int totalPages) { this.totalPages = totalPages; }

    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }

    public int getEstimatedCompletionTime() { return estimatedCompletionTime; }
    public void setEstimatedCompletionTime(int estimatedCompletionTime) { this.estimatedCompletionTime = estimatedCompletionTime; }

    public int getChapterCount() { return chapterCount; }
    public void setChapterCount(int chapterCount) { this.chapterCount = chapterCount; }

    public String getReadingDifficulty() { return readingDifficulty; }
    public void setReadingDifficulty(String readingDifficulty) { this.readingDifficulty = readingDifficulty; }

    public double getReadingProgress() { return readingProgress; }
    public void setReadingProgress(double readingProgress) { this.readingProgress = readingProgress; }

    public List<ReadingChunk> getChunks() { return chunks; }
    public void setChunks(List<ReadingChunk> chunks) { this.chunks = chunks; }

    public static class BookBuilder {
        private Long id;
        private String title;
        private int totalPages;
        private int wordCount;
        private int estimatedCompletionTime;
        private int chapterCount;
        private String readingDifficulty;
        private double readingProgress;
        private List<ReadingChunk> chunks = new ArrayList<>();

        public BookBuilder id(Long id) { this.id = id; return this; }
        public BookBuilder title(String title) { this.title = title; return this; }
        public BookBuilder totalPages(int totalPages) { this.totalPages = totalPages; return this; }
        public BookBuilder wordCount(int wordCount) { this.wordCount = wordCount; return this; }
        public BookBuilder estimatedCompletionTime(int estimatedCompletionTime) { this.estimatedCompletionTime = estimatedCompletionTime; return this; }
        public BookBuilder chapterCount(int chapterCount) { this.chapterCount = chapterCount; return this; }
        public BookBuilder readingDifficulty(String readingDifficulty) { this.readingDifficulty = readingDifficulty; return this; }
        public BookBuilder readingProgress(double readingProgress) { this.readingProgress = readingProgress; return this; }
        public BookBuilder chunks(List<ReadingChunk> chunks) { this.chunks = chunks; return this; }

        public Book build() {
            return new Book(id, title, totalPages, wordCount, estimatedCompletionTime, chapterCount, readingDifficulty, readingProgress, chunks);
        }
    }
}
