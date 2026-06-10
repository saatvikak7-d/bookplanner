import os
import pickle
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# Create a local store directory for the FAISS indices
STORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index_store")
os.makedirs(STORE_DIR, exist_ok=True)

class VectorStoreManager:
    def __init__(self):
        # Using a small, fast local embedding model (384 dimensions)
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.dimension = 384

    def _get_paths(self, book_id: int):
        index_path = os.path.join(STORE_DIR, f"book_{book_id}.index")
        meta_path = os.path.join(STORE_DIR, f"book_{book_id}.meta")
        return index_path, meta_path

    def index_book(self, book_id: int, chunks: list):
        """
        Embed and index chunks for a book.
        Each chunk is a dictionary with keys: chunk_id, content, title, start_page, end_page
        """
        if not chunks:
            return False

        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.model.encode(texts, convert_to_numpy=True)

        # Initialize a standard FAISS index (L2 distance)
        index = faiss.IndexFlatL2(self.dimension)
        index.add(embeddings)

        # Save metadata mapping vector index to chunk details
        metadata = {
            i: {
                "chunk_id": chunk["chunk_id"],
                "chunk_index": chunk["chunk_index"],
                "title": chunk["title"],
                "content": chunk["content"],
                "start_page": chunk["start_page"],
                "end_page": chunk["end_page"]
            }
            for i, chunk in enumerate(chunks)
        }

        # Save FAISS index and metadata to disk
        index_path, meta_path = self._get_paths(book_id)
        faiss.write_index(index, index_path)
        with open(meta_path, "wb") as f:
            pickle.dump(metadata, f)

        return True

    def search(self, book_id: int, query: str, top_k: int = 3):
        """
        Search the vector index of a book for the most similar chunks.
        """
        index_path, meta_path = self._get_paths(book_id)

        if not os.path.exists(index_path) or not os.path.exists(meta_path):
            return []

        # Load index and metadata
        index = faiss.read_index(index_path)
        with open(meta_path, "rb") as f:
            metadata = pickle.load(f)

        # Embed query
        query_vector = self.model.encode([query], convert_to_numpy=True)

        # Search index
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
                "score": float(distances[0][i])
            })

        return results

# Initialize a global singleton manager
vector_store_manager = VectorStoreManager()
