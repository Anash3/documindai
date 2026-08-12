from typing import List, Dict, Any, Optional, Tuple
from app.services.llm.openai_service import openai_service
from app.services.retrieval.vector_store import vector_store
from app.schemas.schemas import Citation

class RAGChatEngine:
    """Core RAG engine managing context retrieval, query rewriting, and LLM synthesis."""

    async def answer_question(
        self,
        user_id: str,
        question: str,
        history: List[Dict[str, str]],
        document_ids: Optional[List[str]] = None,
        top_k: int = 5
    ) -> Tuple[str, List[Citation]]:
        """
        Process user question with document retrieval and conversation context.
        Returns generated answer and list of source citations.
        """
        # Step 1: Rewrite follow-up question if history exists
        search_query = await openai_service.rewrite_query_for_search(question, history)

        # Step 2: Generate embedding for rewritten search query
        query_embeddings = await openai_service.get_embeddings([search_query])
        if not query_embeddings:
            return "Unable to process query embedding.", []

        # Step 3: Retrieve top matching chunks from vector store
        retrieved_chunks = vector_store.search(
            user_id=user_id,
            query_embedding=query_embeddings[0],
            top_k=top_k,
            document_ids=document_ids
        )

        # Step 4: Build context and citations
        citations: List[Citation] = []
        context_blocks = []

        for chunk in retrieved_chunks:
            citation = Citation(
                document_id=chunk["document_id"],
                filename=chunk["filename"],
                chunk_index=chunk["chunk_index"],
                page_number=chunk.get("page_number"),
                section_title=chunk.get("section_title"),
                snippet=chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"],
                relevance_score=round(chunk["relevance_score"], 4)
            )
            citations.append(citation)

            doc_ref = f"[Doc: {chunk['filename']}"
            if chunk.get("page_number"):
                doc_ref += f", Page: {chunk['page_number']}"
            if chunk.get("section_title"):
                doc_ref += f", Section: {chunk['section_title']}"
            doc_ref += "]"

            context_blocks.append(f"{doc_ref}\n{chunk['content']}")

        # Step 5: Construct system prompt and LLM messages
        if context_blocks:
            formatted_context = "\n\n---\n\n".join(context_blocks)
            system_prompt = (
                "You are DocuMind AI, an intelligent document analysis assistant.\n"
                "Answer the user's question accurately using ONLY the provided document context below.\n"
                "If the context does not contain enough information to answer the question, state clearly:\n"
                "'I couldn't find sufficient information in the selected documents to answer your question.'\n"
                "Always cite your sources clearly when using document facts.\n\n"
                f"=== DOCUMENT CONTEXT ===\n{formatted_context}\n========================="
            )
        else:
            system_prompt = (
                "You are DocuMind AI, an intelligent document assistant.\n"
                "The user has not selected any documents or no relevant document content was found.\n"
                "Politely inform the user to upload or select a relevant document to ask questions about it."
            )

        messages = [{"role": "system", "content": system_prompt}]
        for turn in history[-4:]:
            messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": question})

        # Step 6: Generate response via OpenAI Chat API
        answer = await openai_service.generate_response(messages)
        return answer, citations

chat_engine = RAGChatEngine()
