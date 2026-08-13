import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.models import User, Conversation, Message
from app.schemas.schemas import ChatRequest, ChatResponse, ConversationResponse, MessageResponse, Citation
from app.services.chat.chat_engine import chat_engine

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
async def chat_with_documents(
    chat_req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Get or create conversation
    conv_id = chat_req.conversation_id
    if conv_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found.")
    else:
        title = chat_req.message[:30] + ("..." if len(chat_req.message) > 30 else "")
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # 2. Get past message history for context
    past_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()

    history = [{"role": msg.sender, "content": msg.content} for msg in past_messages]

    # 3. Add user message to DB
    user_msg_db = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        sender="user",
        content=chat_req.message
    )
    db.add(user_msg_db)
    db.commit()

    # 4. Generate RAG answer & citations via Chat Engine (OpenAI SDK + Vector Store)
    answer_text, citations = await chat_engine.answer_question(
        user_id=current_user.id,
        question=chat_req.message,
        history=history,
        document_ids=chat_req.document_ids,
        system_prompt=chat_req.system_prompt
    )


    # 5. Save assistant message to DB
    sources_dict = [c.dict() for c in citations] if citations else None
    assistant_msg_db = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        sender="assistant",
        content=answer_text,
        sources_json=sources_dict
    )
    db.add(assistant_msg_db)
    db.commit()
    db.refresh(assistant_msg_db)

    msg_resp = MessageResponse(
        id=assistant_msg_db.id,
        sender=assistant_msg_db.sender,
        content=assistant_msg_db.content,
        sources=citations,
        created_at=assistant_msg_db.created_at
    )

    return ChatResponse(conversation_id=conversation.id, message=msg_resp)

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    convs = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()).all()
    return convs

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return None
