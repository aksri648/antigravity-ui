"""
App Maintainer Agent
Uses OpenAI API / OpenAI Agents SDK architecture to clone GitHub repositories, implement fixes/features on dedicated branches, and create Pull Requests.
"""

from typing import Dict, Any, Optional
from .drivers import CodingCliDriver, AgyCliDriver


class AppMaintainerAgent:
    """App Maintainer Agent for repository maintenance, branch management, and Pull Requests."""

    DOC_URLS = {
        "gh_cli": "https://cli.github.com/manual/",
        "gh_pulls": "https://docs.github.com/en/rest/pulls",
        "git_branching": "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging",
    }

    def __init__(self, driver: CodingCliDriver = None, openai_api_key: str = None):
        self.driver = driver or AgyCliDriver()
        self.openai_api_key = openai_api_key

    async def execute_task(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        repo_url: Optional[str] = None,
        server_url: str = "https://app.daytona.io/api",
    ) -> Dict[str, Any]:
        """Dispatches git repo ingestion and PR generation instruction."""
        if repo_url:
            task_prompt = f"Activate skill 'app-maintainer'. Target repository: {repo_url}. Task: {prompt}"
        else:
            task_prompt = f"Activate skill 'app-maintainer'. Task: {prompt}"

        return await self.driver.execute_prompt(
            prompt=task_prompt,
            sandbox_id=sandbox_id,
            api_key=api_key,
            server_url=server_url,
        )
