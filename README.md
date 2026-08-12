# DocuMind AI

DocuMind AI is an enterprise-grade document analysis and RAG (Retrieval-Augmented Generation) Q&A application powered by the **OpenAI SDK**, **FastAPI**, **Next.js**, and **Vector Search**.

---

## 🏗️ Repository Project Structure

```
documindai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth.py         # Authentication (JWT register, login, me)
│   │   │       ├── documents.py    # Document upload, listing & deletion
│   │   │       └── chat.py         # RAG Q&A chat & conversation history
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic Settings & environment config
│   │   │   ├── database.py     # SQLAlchemy ORM session & engine setup
│   │   │   └── security.py     # Password hashing & JWT token management
│   │   ├── models/
│   │   │   └── models.py       # User, Document, DocumentChunk, Conversation, Message
│   │   ├── schemas/
│   │   │   └── schemas.py      # Pydantic request & response models
│   │   ├── services/
│   │   │   ├── ingestion/
│   │   │   │   ├── parser.py   # PDF (PyMuPDF) and DOCX (python-docx) extraction
│   │   │   │   └── chunker.py  # Structure-aware document chunking algorithm
│   │   │   ├── llm/
│   │   │   │   └── openai_service.py # OpenAI SDK wrapper for embeddings & chat
│   │   │   ├── retrieval/
│   │   │   │   └── vector_store.py  # Cosine similarity vector search manager
│   │   │   └── chat/
│   │   │       └── chat_engine.py   # RAG engine: query rewrite, context, citations
│   │   └── main.py             # FastAPI entrypoint & CORS middleware
│   ├── tests/
│   │   └── test_main.py        # Backend API health tests
│   ├── Dockerfile              # Docker container setup for FastAPI backend
│   └── requirements.txt        # Python dependencies (fastapi, openai, pymupdf, etc.)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css     # Tailwind CSS & Glassmorphic theme design system
│   │   │   ├── layout.tsx      # Next.js root layout
│   │   │   └── page.tsx        # Responsive Document Q&A & Upload interface
│   │   └── lib/
│   │       └── api.ts          # Axios client API service wrapper
│   ├── next.config.mjs
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile              # Docker container setup for Next.js frontend
├── docker-compose.yml          # Multi-container local orchestration
├── .env.example                # Environment variables template
├── .gitignore
└── README.md
```

---

## ⚡ Quick Start

### 1. Environment Setup
Copy `.env.example` to `.env` and set your `OPENAI_API_KEY`:
```bash
cp .env.example .env
```

### 2. Run with Docker Compose
```bash
docker-compose up --build
```
- **Frontend App**: `http://localhost:3000`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`

---

## 🚀 Features

- **Document Extraction**: Seamlessly extracts text from **PDF** (`PyMuPDF`) and **DOCX** (`python-docx`).
- **Structure-Aware Chunking**: Preserves section headings, page numbers, and context boundaries.
- **OpenAI Embeddings**: Converts document text chunks into embeddings using `text-embedding-3-small` via the **OpenAI SDK**.
- **Semantic Vector Search**: High-performance cosine similarity retrieval per user and selected documents.
- **Context-Aware Conversational RAG**: Uses `gpt-4o-mini` with follow-up query rewriting, full context assembly, and exact page/document citations.
# documindai
# documindai
