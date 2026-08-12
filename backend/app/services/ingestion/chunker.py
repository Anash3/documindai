from typing import List, Dict, Any

class DocumentChunker:
    def __init__(self, target_chunk_size: int = 500, chunk_overlap: int = 50):
        self.target_chunk_size = target_chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_extracted_data(self, extracted_elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes extracted elements (pages or paragraphs) and produces chunks with metadata.
        """
        chunks = []
        chunk_index = 0

        for element in extracted_elements:
            text = element["text"]
            page_number = element.get("page_number")
            section_title = element.get("section_title")
            
            # Simple word-based token estimation (~1.3 words per token)
            words = text.split()
            max_words = int(self.target_chunk_size * 0.75)
            overlap_words = int(self.chunk_overlap * 0.75)

            if len(words) <= max_words:
                chunks.append({
                    "chunk_index": chunk_index,
                    "content": text,
                    "page_number": page_number,
                    "section_title": section_title,
                    "metadata": {
                        "page_number": page_number,
                        "section_title": section_title,
                        "word_count": len(words)
                    }
                })
                chunk_index += 1
            else:
                # Sliding window chunking
                start = 0
                while start < len(words):
                    end = min(start + max_words, len(words))
                    chunk_text = " ".join(words[start:end])
                    chunks.append({
                        "chunk_index": chunk_index,
                        "content": chunk_text,
                        "page_number": page_number,
                        "section_title": section_title,
                        "metadata": {
                            "page_number": page_number,
                            "section_title": section_title,
                            "word_count": len(words[start:end])
                        }
                    })
                    chunk_index += 1
                    if end == len(words):
                        break
                    start += (max_words - overlap_words)

        return chunks
