"""
App Developer Agent
Uses OpenAI API / OpenAI Agents SDK architecture to interview requirements, create blueprints, and control the underlying Coding CLI Driver.
"""

from typing import Dict, Any, List
from .drivers import CodingCliDriver, AgyCliDriver


class AppDeveloperAgent:
    """App Developer Agent with human-in-the-loop interview and architecture planning."""

    DOC_URLS = {
        "vite": "https://vite.dev/guide/",
        "react": "https://react.dev/reference/react",
        "tailwind": "https://tailwindcss.com/docs",
        "gin": "https://gin-gonic.com/docs/",
        "fastapi": "https://fastapi.tiangolo.com/",
    }

    def __init__(self, driver: CodingCliDriver = None, openai_api_key: str = None):
        self.driver = driver or AgyCliDriver()
        self.openai_api_key = openai_api_key

    def get_system_prompt(self) -> str:
        return f"""You are the App Developer Agent, an expert full-stack software architect and engineer.
Your goal is to turn high-level user ideas into clean, functional, production-ready codebases with live previews.

Core Guidelines:
1. Requirements Interview: If details are underspecified, pose 2-4 structured questions (domain, stack, styling, auth/db).
2. Blueprint First: Create a file structure outline and component hierarchy before code generation.
3. Heavy Lifting Delegation: Use your Coding CLI Driver to build files inside ~/workspace.
4. Official Documentation References:
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
