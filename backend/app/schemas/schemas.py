from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, ConfigDict

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    created_at: datetime

# Document Schemas
class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int

# Citation Schema
class Citation(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    snippet: str
    relevance_score: float

# Chat & Conversation Schemas
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    document_ids: Optional[List[str]] = None

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender: str
    content: str
    sources: Optional[List[Citation]] = None
    created_at: datetime

class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageResponse

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = None

