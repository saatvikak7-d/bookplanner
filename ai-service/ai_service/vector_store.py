import os
import pickle
import re
from hashlib import blake2b

import numpy as np
import faiss

# Create a local store directory for the FAISS indices
STORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index_store")
os.makedirs(STORE_DIR, exist_ok=True)


class HashingEmbedder:
    """Small deterministic text embedder with no ML model dependency."""

    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def encode(self, texts: list[str], convert_to_numpy: bool = True):
        vectors = np.vstack([self._embed(text) for text in texts]).astype("float32")
        return vectors if convert_to_numpy else vectors.tolist()

    def _embed(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dimension, dtype=np.float32)
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]

        for feature in features:
            digest = blake2b(feature.encode("utf-8"), digest_size=8).digest()
            value = int.from_bytes(digest, "little", signed=False)
            index = value % self.dimension
            sign = 1.0 if (value >> 63) == 0 else -1.0
            vector[index] += sign

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector /= norm
        return vector


class VectorStoreManager:
    EMBEDDING_BACKEND = "hashing-v1"

    def __init__(self):
        self.dimension = 384
        self.model = HashingEmbedder(self.dimension)

    def _get_paths(self, book_id: int):
        index_path = os.path.join(STORE_DIR, f"book_{book_id}.index")
        meta_path = os.path.join(STORE_DIR, f"book_{book_id}.meta")
        return index_path, meta_path

    def _embeddings_for(self, texts: list[str]) -> np.ndarray:
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return np.ascontiguousarray(embeddings, dtype="float32")

    def _metadata_uses_current_backend(self, metadata: dict) -> bool:
        return all(
            info.get("_embedding_backend") == self.EMBEDDING_BACKEND
            for info in metadata.values()
        )

    def _rebuild_index_from_metadata(self, book_id: int, metadata: dict):
        texts = [metadata[i]["content"] for i in sorted(metadata.keys())]
        embeddings = self._embeddings_for(texts)
        index = faiss.IndexFlatL2(self.dimension)
        index.add(embeddings)
        for info in metadata.values():
            info["_embedding_backend"] = self.EMBEDDING_BACKEND
        index_path, meta_path = self._get_paths(book_id)
        faiss.write_index(index, index_path)
        with open(meta_path, "wb") as f:
            pickle.dump(metadata, f)
        return index, metadata

    def index_book(self, book_id: int, chunks: list):
        """Embed and index chunks for a book.

        Each chunk is a dictionary with keys: chunk_id, content, title, start_page, end_page
        """
        if not chunks:
            return False
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self._embeddings_for(texts)
        index = faiss.IndexFlatL2(self.dimension)
        index.add(embeddings)
        metadata = {
            i: {
                "chunk_id": chunk["chunk_id"],
                "chunk_index": chunk["chunk_index"],
                "title": chunk["title"],
                "content": chunk["content"],
                "start_page": chunk["start_page"],
                "end_page": chunk["end_page"],
                "completed": False,
                "_embedding_backend": self.EMBEDDING_BACKEND,
            }
            for i, chunk in enumerate(chunks)
        }
        index_path, meta_path = self._get_paths(book_id)
        faiss.write_index(index, index_path)
        with open(meta_path, "wb") as f:
            pickle.dump(metadata, f)
        return True

    def get_chunks(self, book_id: int) -> list:
        """Retrieve stored chunk metadata for a given book."""
        _, meta_path = self._get_paths(book_id)
        if not os.path.exists(meta_path):
            return []
        with open(meta_path, "rb") as f:
            metadata = pickle.load(f)
        chunks = []
        for i in sorted(metadata.keys()):
            info = metadata[i]
            chunks.append({
                "id": info["chunk_id"],
                "chunkIndex": info["chunk_index"],
                "title": info["title"],
                "content": info["content"],
                "startPage": info["start_page"],
                "endPage": info["end_page"],
                "completed": info.get("completed", False),
            })
        return chunks

    def search(self, book_id: int, query: str, top_k: int = 3):
        """Search the vector index of a book for the most similar chunks."""
        index_path, meta_path = self._get_paths(book_id)
        if not os.path.exists(index_path) or not os.path.exists(meta_path):
            return []
        index = faiss.read_index(index_path)
        with open(meta_path, "rb") as f:
            metadata = pickle.load(f)
        if index.d != self.dimension or not self._metadata_uses_current_backend(metadata):
            index, metadata = self._rebuild_index_from_metadata(book_id, metadata)
        query_vector = self._embeddings_for([query])
        distances, indices = index.search(query_vector, top_k)
        results = []
        for i, idx in enumerate(indices[0]):
            if idx == -1 or idx not in metadata:
                continue
            chunk_info = metadata[idx]
            results.append({
                "chunk_id": chunk_info["chunk_id"],
                "chunk_index": chunk_info["chunk_index"],
                "title": chunk_info["title"],
                "content": chunk_info["content"],
                "start_page": chunk_info["start_page"],
                "end_page": chunk_info["end_page"],
                "score": float(distances[0][i]),
            })
        return results

# Global singleton
vector_store_manager = VectorStoreManager()
