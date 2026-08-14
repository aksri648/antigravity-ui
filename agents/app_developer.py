"""
App Developer Agent
Uses OpenAI API / OpenAI Agents SDK architecture to interview requirements, create blueprints, and control the underlying Coding CLI Driver.
"""

from typing import Dict, Any, List
from .drivers import CodingCliDriver, AgyCliDriver


class AppDeveloperAgent:
    """App Developer Agent with human-in-the-loop interview and architecture planning."""

    DOC_URLS = {
        # Core Web & API Frameworks
        "vite": "https://vite.dev/guide/",
        "react": "https://react.dev/reference/react",
        "tailwind": "https://tailwindcss.com/docs",
        "gin": "https://gin-gonic.com/docs/",
        "fastapi": "https://fastapi.tiangolo.com/",
        # Gen AI, RAG & Vector Stores
        "langchain_langgraph": "https://python.langchain.com/docs/ | https://langchain-ai.github.io/langgraph/",
        "llamaindex_rag": "https://docs.llamaindex.ai/en/stable/",
        "pgvector": "https://github.com/pgvector/pgvector",
        "qdrant_vector_db": "https://qdrant.tech/documentation/",
        # Model Providers, Function Calling & Structured Outputs
        "openai_structured_outputs": "https://platform.openai.com/docs/guides/structured-outputs",
        "openai_function_calling": "https://platform.openai.com/docs/guides/function-calling",
        "anthropic_tool_use": "https://docs.anthropic.com/en/docs/build-with-claude/tool-use",
        "gemini_function_calling": "https://ai.google.dev/gemini-api/docs/function-calling",
        # Observability & Inference Engines
        "langfuse_observability": "https://langfuse.com/docs",
        "vllm_inference": "https://docs.vllm.ai/",
    }

    def __init__(self, driver: CodingCliDriver = None, openai_api_key: str = None):
        self.driver = driver or AgyCliDriver()
        self.openai_api_key = openai_api_key

    def get_system_prompt(self) -> str:
        return f"""You are the App Developer Agent, an expert full-stack and Generative AI software architect.
Your goal is to turn high-level user ideas into clean, functional, production-ready full-stack applications, RAG pipelines, and conversational AI systems.

Core Engineering Guidelines:
1. Requirements & AI Scoping:
   - Clarify domain goal, tech stack, data persistence, and AI architecture (RAG vector pipeline vs direct streaming LLM vs agentic tool calling).
2. Production RAG Architecture:
   - Chunking (recursive character/semantic), embeddings (text-embedding-3/BGE), vector stores (pgvector with HNSW indexes, Qdrant).
   - Hybrid retrieval (BM25 + dense vector similarity) and cross-encoder reranking (Cohere Rerank) to ensure grounded top-k context.
   - Context fencing (`<context>...</context>`) and anti-hallucination source attribution.
3. Enterprise Chatbots & Agents:
   - Server-Sent Events (SSE) / WebSocket chunk streaming.
   - Session memory buffers, structured JSON Schemas (Pydantic / Zod models), and safe tool invocation dispatch loops.
   - LLM observability (Langfuse / OpenTelemetry) and prompt injection guardrails.
4. Blueprint First:
   - Create a file structure outline, API schemas, and component hierarchy before code generation.
5. Coding CLI Execution:
   - Dispatch instructions to your Coding CLI Driver to build modular, type-safe files inside the project folder.
6. Official Documentation References:
{chr(10).join([f"- {k}: {v}" for k, v in self.DOC_URLS.items()])}
"""

    async def execute_task(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
    ) -> Dict[str, Any]:
        """Orchestrates the app developer workflow using the CLI driver."""
        task_prompt = f"Activate skill 'app-developer'. Goal: {prompt}"
        return await self.driver.execute_prompt(
            prompt=task_prompt,
            sandbox_id=sandbox_id,
            api_key=api_key,
            server_url=server_url,
        )
