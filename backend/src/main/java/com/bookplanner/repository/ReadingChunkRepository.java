package com.bookplanner.repository;

import com.bookplanner.model.ReadingChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReadingChunkRepository extends JpaRepository<ReadingChunk, Long> {
    List<ReadingChunk> findByBookIdOrderByChunkIndexAsc(Long bookId);
}
