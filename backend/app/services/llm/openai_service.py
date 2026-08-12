import os
from typing import List, Dict, Any, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings

class OpenAIService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        self.embedding_model = settings.EMBEDDING_MODEL
        self.llm_model = settings.LLM_MODEL
        self._client = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            if not self.api_key:
                raise ValueError("OPENAI_API_KEY is not set. Please configure it in your environment or .env file.")
            self._client = AsyncOpenAI(api_key=self.api_key)
        return self._client

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of text strings using OpenAI Embeddings API."""
        if not texts:
            return []
        
        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1500
    ) -> str:
        """Generate text completion from OpenAI Chat API."""
        response = await self.client.chat.completions.create(
            model=self.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content or ""

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1500
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens from OpenAI Chat API."""
        response = await self.client.chat.completions.create(
            model=self.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def rewrite_query_for_search(self, user_query: str, history: List[Dict[str, str]]) -> str:
        """Rewrite user query using past context to create a standalone search query."""
        if not history:
            return user_query
            
        system_prompt = (
            "Given the following conversation history and a follow-up question, "
            "rephrase the follow-up question to be a standalone question that can be searched "
            "in a document database. Return ONLY the rewritten question string."
        )
        
        prompt_messages = [{"role": "system", "content": system_prompt}]
        for turn in history[-4:]:
            prompt_messages.append({"role": turn["role"], "content": turn["content"]})
        prompt_messages.append({"role": "user", "content": user_query})

        try:
            rewritten = await self.generate_response(prompt_messages, temperature=0.1, max_tokens=150)
            return rewritten.strip() if rewritten.strip() else user_query
        except Exception:
            return user_query

openai_service = OpenAIService()
