"""
Modular Coding CLI Driver Interface
Decouples agent reasoning from underlying coding CLIs (Antigravity 'agy', OpenCode, Claude Code).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import httpx
import os


class CodingCliDriver(ABC):
    """Abstract interface for any coding CLI execution driver."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the CLI driver (e.g. 'agy', 'opencode', 'claude-code')."""
        pass

    @abstractmethod
    async def execute_prompt(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
        workspace_path: str = "/home/daytona/persist/workspace",
        env_vars: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Executes a coding instruction in the designated sandbox environment."""
        pass


class AgyCliDriver(CodingCliDriver):
    """Antigravity CLI ('agy') Driver executing inside Daytona Sandbox."""

    @property
    def name(self) -> str:
        return "agy"

    async def execute_prompt(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
        workspace_path: str = "/home/daytona/persist/workspace",
        env_vars: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        bash_script = f"""#!/usr/bin/env bash
mkdir -p {workspace_path} /home/daytona/persist/gemini
[ -f /home/daytona/persist/gemini/.env ] && set -a && . /home/daytona/persist/gemini/.env && set +a 2>/dev/null || true
export PATH="/usr/local/bin:/home/daytona/.local/bin:$PATH"
cd {workspace_path}

if command -v agy >/dev/null 2>&1; then
  agy --print {prompt!r} --output-format stream-json --print-timeout 15m --dangerously-skip-permissions
else
  echo "AGY CLI not found"
fi
"""
        url = f"{server_url.rstrip('/')}/sandbox/{sandbox_id}/process"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=900.0) as client:
            resp = await client.post(url, headers=headers, json={"command": bash_script})
            return {
                "driver": self.name,
                "status_code": resp.status_code,
                "output": resp.text,
            }


class OpenCodeCliDriver(CodingCliDriver):
    """Plug & Play Driver for OpenCode CLI (Future Ready)."""

    @property
    def name(self) -> str:
        return "opencode"

    async def execute_prompt(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
        workspace_path: str = "/home/daytona/persist/workspace",
        env_vars: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        bash_script = f"""#!/usr/bin/env bash
cd {workspace_path}
opencode run {prompt!r}
"""
        url = f"{server_url.rstrip('/')}/sandbox/{sandbox_id}/process"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=900.0) as client:
            resp = await client.post(url, headers=headers, json={"command": bash_script})
            return {"driver": self.name, "output": resp.text}


class ClaudeCodeCliDriver(CodingCliDriver):
    """Plug & Play Driver for Claude Code CLI (Future Ready)."""

    @property
    def name(self) -> str:
        return "claude-code"

    async def execute_prompt(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        server_url: str = "https://app.daytona.io/api",
        workspace_path: str = "/home/daytona/persist/workspace",
        env_vars: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        bash_script = f"""#!/usr/bin/env bash
cd {workspace_path}
claude -p {prompt!r}
"""
        url = f"{server_url.rstrip('/')}/sandbox/{sandbox_id}/process"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=900.0) as client:
            resp = await client.post(url, headers=headers, json={"command": bash_script})
            return {"driver": self.name, "output": resp.text}
