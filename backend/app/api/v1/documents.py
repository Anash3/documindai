import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal

from app.core.config import settings
from app.api.v1.auth import get_current_user
from app.models.models import User, Document, DocumentChunk
from app.schemas.schemas import DocumentResponse, DocumentListResponse, BuildVectorDBRequest, VectorDBStatusResponse

from app.services.ingestion.parser import DocumentParser
from app.services.ingestion.chunker import DocumentChunker
from app.services.llm.openai_service import openai_service
from app.services.retrieval.vector_store import vector_store

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB limit

async def process_document_background(document_id: str, file_path: str, file_type: str, user_id: str, filename: str):
    """Background ingestion pipeline: Parse -> Chunk -> Embed (OpenAI SDK) -> Vector Store -> DB Update."""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        # Step 1: Extract text elements
        extracted = DocumentParser.parse(file_path, file_type)
        if not extracted:
            raise ValueError("No text content could be extracted from document.")

        # Step 2: Create chunks
        chunker = DocumentChunker()
        chunks = chunker.chunk_extracted_data(extracted)
        if not chunks:
            raise ValueError("Document yielded no valid text chunks.")

        # Step 3: Generate OpenAI Embeddings
        chunk_texts = [c["content"] for c in chunks]
        embeddings = await openai_service.get_embeddings(chunk_texts)

        # Step 4: Save chunk metadata in Database
        db_chunks = []
        for idx, chunk in enumerate(chunks):
            db_chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                document_id=document_id,
                chunk_index=chunk["chunk_index"],
                content=chunk["content"],
                page_number=chunk.get("page_number"),
                section_title=chunk.get("section_title"),
                metadata_json=chunk.get("metadata", {})
            )
            db_chunks.append(db_chunk)
        
        db.add_all(db_chunks)

        # Step 5: Save in Vector Store
        vector_store.add_document_chunks(
            user_id=user_id,
            document_id=document_id,
            filename=filename,
            chunks=chunks,
            embeddings=embeddings
        )

        doc.status = "ready"
        doc.chunk_count = len(chunks)
        doc.error_message = None
        db.commit()

    except Exception as e:
        print(f"[Ingestion Error] Document {document_id}: {e}")
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)
                db.commit()
        except Exception as db_err:
            print(f"[DB Exception] {db_err}")
    finally:
        db.close()

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read content to check size
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds maximum allowed size of 25MB.")

    doc_id = str(uuid.uuid4())
    save_filename = f"{doc_id}_{file.filename}"
    file_path = os.path.join(settings.STORAGE_DIR, save_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    document = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_type=ext,
        file_size=file_size,
        status="processing"
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Trigger background ingestion pipeline
    background_tasks.add_task(
        process_document_background,
        document_id=doc_id,
        file_path=file_path,
        file_type=ext,
        user_id=current_user.id,
        filename=file.filename
    )

    return document

@router.get("", response_model=DocumentListResponse)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(documents=docs, total=len(docs))

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove original file
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    # Remove from vector store
    vector_store.delete_document_chunks(current_user.id, document_id)

    # Delete DB records
    db.delete(doc)
    db.commit()
    return None

@router.post("/build-vector-db", response_model=VectorDBStatusResponse)
def build_vector_db_for_selected(
    req: BuildVectorDBRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.document_ids:
        raise HTTPException(status_code=400, detail="No document IDs provided for vector DB creation.")

    docs = db.query(Document).filter(
        Document.id.in_(req.document_ids),
        Document.user_id == current_user.id
    ).all()

    if not docs:
        raise HTTPException(status_code=404, detail="No matching documents found for current user.")

    ready_docs = [d for d in docs if d.status == "ready"]
    failed_docs = [d for d in docs if d.status == "failed"]

    if not ready_docs and failed_docs:
        raise HTTPException(
            status_code=400,
            detail=f"Selected document(s) failed ingestion: {failed_docs[0].error_message}"
        )

    total_chunks = sum(d.chunk_count for d in ready_docs)

    return VectorDBStatusResponse(
        status="ready" if ready_docs else "processing",
        indexed_documents_count=len(ready_docs),
        total_chunks=total_chunks,
        vector_model=settings.EMBEDDING_MODEL,
        vector_dimensions=1536,
        document_ids=[d.id for d in ready_docs]
    )

@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document_ingestion(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc.status = "processing"
    doc.error_message = None
    db.commit()

    background_tasks.add_task(
        process_document_background,
        document_id=doc.id,
        file_path=doc.file_path,
        file_type=doc.file_type,
        user_id=current_user.id,
        filename=doc.filename
    )

    return doc


