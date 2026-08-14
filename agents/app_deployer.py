"""
App Deployer Agent
Uses OpenAI API / OpenAI Agents SDK architecture to dockerize workspaces and deploy containers to Azure VMs or Azure Container Apps.
"""

from typing import Dict, Any
from .drivers import CodingCliDriver, AgyCliDriver


class AppDeployerAgent:
    """App Deployer Agent handling containerization and Azure cloud provisioning."""

    DOC_URLS = {
        "docker_multistage": "https://docs.docker.com/build/building/multi-stage/",
        "azure_container_apps": "https://learn.microsoft.com/en-us/azure/container-apps/",
        "azure_cli": "https://learn.microsoft.com/en-us/cli/azure/",
        "azure_vms": "https://learn.microsoft.com/en-us/azure/virtual-machines/linux/",
    }

    def __init__(self, driver: CodingCliDriver = None, openai_api_key: str = None):
        self.driver = driver or AgyCliDriver()
        self.openai_api_key = openai_api_key

    async def execute_task(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
    ) -> Dict[str, Any]:
        """Dispatches containerization and cloud deployment instruction."""
        task_prompt = f"Activate skill 'app-deployer'. Task: {prompt}"
        return await self.driver.execute_prompt(
            prompt=task_prompt,
            sandbox_id=sandbox_id,
            api_key=api_key,
            server_url=server_url,
        )
