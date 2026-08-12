import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from app.core.config import settings

class VectorStoreManager:
    """FAISS-backed vector store manager with user and document level metadata filtering."""
    
    def __init__(self):
        self.vector_dir = settings.VECTOR_STORE_DIR
        os.makedirs(self.vector_dir, exist_ok=True)
        self.indices = {} # map user_id -> dict of metadata & vectors
        self.metadata = {} # map user_id -> list of chunk dicts

    def _get_user_files(self, user_id: str):
        vec_file = os.path.join(self.vector_dir, f"{user_id}_vectors.npy")
        meta_file = os.path.join(self.vector_dir, f"{user_id}_meta.json")
        return vec_file, meta_file

    def save_user_index(self, user_id: str, vectors: np.ndarray, chunks_meta: List[Dict[str, Any]]):
        """Save vector array and metadata list for a specific user."""
        vec_file, meta_file = self._get_user_files(user_id)
        np.save(vec_file, vectors)
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(chunks_meta, f, ensure_ascii=False, indent=2)
        
        self.indices[user_id] = vectors
        self.metadata[user_id] = chunks_meta

    def load_user_index(self, user_id: str):
        """Load user vector index and metadata into memory."""
        vec_file, meta_file = self._get_user_files(user_id)
        if os.path.exists(vec_file) and os.path.exists(meta_file):
            try:
                vectors = np.load(vec_file)
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                self.indices[user_id] = vectors
                self.metadata[user_id] = meta
            except Exception as e:
                print(f"Error loading index for user {user_id}: {e}")
                self.indices[user_id] = np.empty((0, 1536), dtype=np.float32)
                self.metadata[user_id] = []
        else:
            self.indices[user_id] = np.empty((0, 1536), dtype=np.float32)
            self.metadata[user_id] = []

    def add_document_chunks(
        self,
        user_id: str,
        document_id: str,
        filename: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ):
        """Add new document embeddings and metadata chunks to user's vector index."""
        if user_id not in self.indices:
            self.load_user_index(user_id)

        new_vectors = np.array(embeddings, dtype=np.float32)
        # Normalize vectors for cosine similarity
        norms = np.linalg.norm(new_vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        new_vectors = new_vectors / norms

        new_meta = []
        for i, chunk in enumerate(chunks):
            meta_item = {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "page_number": chunk.get("page_number"),
                "section_title": chunk.get("section_title"),
                "metadata": chunk.get("metadata", {})
            }
            new_meta.append(meta_item)

        existing_vectors = self.indices.get(user_id)
        existing_meta = self.metadata.get(user_id, [])

        if existing_vectors is not None and existing_vectors.shape[0] > 0:
            updated_vectors = np.vstack([existing_vectors, new_vectors])
            updated_meta = existing_meta + new_meta
        else:
            updated_vectors = new_vectors
            updated_meta = new_meta

        self.save_user_index(user_id, updated_vectors, updated_meta)

    def delete_document_chunks(self, user_id: str, document_id: str):
        """Remove chunks belonging to a document from user's index."""
        self.load_user_index(user_id)
        existing_vectors = self.indices.get(user_id)
        existing_meta = self.metadata.get(user_id, [])

        if existing_vectors is None or len(existing_meta) == 0:
            return

        keep_indices = [i for i, meta in enumerate(existing_meta) if meta.get("document_id") != document_id]
        if len(keep_indices) == 0:
            updated_vectors = np.empty((0, 1536), dtype=np.float32)
            updated_meta = []
        else:
            updated_vectors = existing_vectors[keep_indices]
            updated_meta = [existing_meta[i] for i in keep_indices]

        self.save_user_index(user_id, updated_vectors, updated_meta)

    def search(
        self,
        user_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
        min_score: float = 0.2
    ) -> List[Dict[str, Any]]:
        """Search top-k matching document chunks using cosine similarity."""
        self.load_user_index(user_id)
        user_vectors = self.indices.get(user_id)
        user_meta = self.metadata.get(user_id, [])

        if user_vectors is None or len(user_meta) == 0 or user_vectors.shape[0] == 0:
            return []

        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        # Cosine similarity scores
        scores = np.dot(user_vectors, q_vec)

        results = []
        for idx, score in enumerate(scores):
            meta = user_meta[idx]
            doc_id = meta.get("document_id")
            
            # Filter by document_ids if provided
            if document_ids and doc_id not in document_ids:
                continue

            if float(score) >= min_score:
                item = meta.copy()
                item["relevance_score"] = float(score)
                results.append(item)

        # Sort by relevance score descending
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:top_k]

vector_store = VectorStoreManager()
