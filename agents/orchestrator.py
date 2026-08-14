"""
Agent Orchestrator
Central dispatch layer using OpenAI Agents SDK architecture to route user requests to specialized agents.
"""

from typing import Dict, Any, Optional
from .drivers import CodingCliDriver, AgyCliDriver, OpenCodeCliDriver, ClaudeCodeCliDriver
from .app_developer import AppDeveloperAgent
from .llm_deployer import LLMDeployerAgent
from .app_deployer import AppDeployerAgent
from .app_maintainer import AppMaintainerAgent


class AgentOrchestrator:
    """Orchestrates multi-agent execution with pluggable coding CLI drivers."""

    def __init__(self, driver_name: str = "agy", openai_api_key: Optional[str] = None):
        self.driver = self._resolve_driver(driver_name)
        self.openai_api_key = openai_api_key

        self.app_developer = AppDeveloperAgent(driver=self.driver, openai_api_key=self.openai_api_key)
        self.llm_deployer = LLMDeployerAgent(driver=self.driver, openai_api_key=self.openai_api_key)
        self.app_deployer = AppDeployerAgent(driver=self.driver, openai_api_key=self.openai_api_key)
        self.app_maintainer = AppMaintainerAgent(driver=self.driver, openai_api_key=self.openai_api_key)

    def _resolve_driver(self, name: str) -> CodingCliDriver:
        drivers = {
            "agy": AgyCliDriver,
            "opencode": OpenCodeCliDriver,
            "claude-code": ClaudeCodeCliDriver,
        }
        driver_cls = drivers.get(name.lower(), AgyCliDriver)
        return driver_cls()

    async def dispatch(
        self,
        agent_mode: str,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        repo_url: Optional[str] = None,
        traffic_profile: str = "sporadic",
        server_url: str = "https://app.daytona.io/api",
    ) -> Dict[str, Any]:
        """Routes task to the target specialized agent."""
        mode = agent_mode.lower().replace("_", "-")
        if mode == "app-developer":
            return await self.app_developer.execute_task(prompt, sandbox_id, api_key, server_url)
        elif mode == "llm-deployer":
            return await self.llm_deployer.execute_task(prompt, sandbox_id, api_key, traffic_profile, server_url)
        elif mode == "app-deployer":
            return await self.app_deployer.execute_task(prompt, sandbox_id, api_key, server_url)
        elif mode == "app-maintainer":
            return await self.app_maintainer.execute_task(prompt, sandbox_id, api_key, repo_url, server_url)
        else:
            # Default to app-developer
            return await self.app_developer.execute_task(prompt, sandbox_id, api_key, server_url)
