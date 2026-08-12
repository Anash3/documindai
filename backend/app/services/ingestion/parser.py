import os
from typing import List, Dict, Any
import pymupdf
import docx

class DocumentParser:
    @staticmethod
    def extract_from_pdf(file_path: str) -> List[Dict[str, Any]]:
        """Extract text from PDF page by page using PyMuPDF."""
        pages_data = []
        doc = pymupdf.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            if text.strip():
                pages_data.append({
                    "page_number": page_num + 1,
                    "text": text.strip()
                })
        doc.close()
        return pages_data

    @staticmethod
    def extract_from_docx(file_path: str) -> List[Dict[str, Any]]:
        """Extract paragraphs and headings from DOCX using python-docx."""
        doc = docx.Document(file_path)
        paragraphs_data = []
        current_section = "General"
        
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            if p.style and p.style.name.startswith("Heading"):
                current_section = text
            paragraphs_data.append({
                "page_number": None,
                "section_title": current_section,
                "text": text
            })
        return paragraphs_data

    @classmethod
    def parse(cls, file_path: str, file_type: str) -> List[Dict[str, Any]]:
        """Parse file based on file_type extension ('pdf' or 'docx')."""
        if file_type.lower() == "pdf":
            return cls.extract_from_pdf(file_path)
        elif file_type.lower() in ["docx", "doc"]:
            return cls.extract_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
