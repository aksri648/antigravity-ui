"""
LLM Deployer Agent
Uses OpenAI API / OpenAI Agents SDK architecture to profile traffic, recommend architectures (RunPod Serverless vs Azure AI vs Spot GPU), and generate post-deployment connection packages.
"""

from typing import Dict, Any, Optional
from .drivers import CodingCliDriver, AgyCliDriver


class LLMDeployerAgent:
    """LLM Deployer Agent with traffic profiling and post-deployment client code generation."""

    DOC_URLS = {
        "runpod_serverless": "https://docs.runpod.io/serverless/",
        "runpod_vllm": "https://docs.runpod.io/serverless/workers/vllm/",
        "vllm_engine": "https://docs.vllm.ai/en/latest/",
        "azure_ai_studio": "https://learn.microsoft.com/en-us/azure/ai-studio/how-to/deploy-models-open",
        "azure_ml_endpoints": "https://learn.microsoft.com/en-us/azure/machine-learning/how-to-deploy-online-endpoints",
        "huggingface_tgi": "https://huggingface.co/docs/text-generation-inference/",
    }

    def __init__(self, driver: CodingCliDriver = None, openai_api_key: str = None):
        self.driver = driver or AgyCliDriver()
        self.openai_api_key = openai_api_key

    def recommend_deployment_target(self, traffic_type: str, budget_priority: bool = False) -> Dict[str, str]:
        """Heuristic rule engine recommending production architecture based on traffic profile."""
        traffic = traffic_type.lower()
        if "steady" in traffic or "enterprise" in traffic or "high" in traffic:
            return {
                "platform": "Azure Kubernetes Service (AKS) / Azure AI Managed Online Endpoint",
                "engine": "vLLM / Triton",
                "scaling": "Autoscaling dedicated GPU instances",
                "rationale": "High throughput, SLA guarantees, dedicated GPU memory, and Entra ID security.",
            }
        elif "dev" in traffic or "spot" in traffic or budget_priority:
            return {
                "platform": "RunPod Dedicated Spot GPU Pod",
                "engine": "vLLM / Ollama",
                "scaling": "Single spot instance (Lowest $/hr)",
                "rationale": "Cost-optimized for batch training, testing, or internal experimentation.",
            }
        else:
            return {
                "platform": "RunPod Serverless with vLLM Worker",
                "engine": "vLLM with FlashAttention-2",
                "scaling": "Scale-to-zero serverless worker (Pay per millisecond)",
                "rationale": "Zero idle costs for sporadic/bursty workloads with sub-second cold starts.",
            }

    def generate_connection_package(self, base_url: str, api_key: str, model_id: str) -> Dict[str, str]:
        """Generates ready-to-run client integration code snippets."""
        python_snippet = f"""from openai import OpenAI

client = OpenAI(
    base_url="{base_url}",
    api_key="{api_key}",
)

response = client.chat.completions.create(
    model="{model_id}",
    messages=[{{"role": "user", "content": "Hello world!"}}],
    temperature=0.7,
)

print(response.choices[0].message.content)
"""
        curl_snippet = f"""curl -X POST "{base_url}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {api_key}" \\
  -d '{{"model": "{model_id}", "messages": [{{"role": "user", "content": "Hello!"}}]}}'
"""
        return {
            "base_url": base_url,
            "api_key": api_key,
            "model_id": model_id,
            "python_snippet": python_snippet,
            "curl_snippet": curl_snippet,
        }

    async def execute_task(
        self,
        prompt: str,
        sandbox_id: str,
        api_key: str,
        traffic_profile: str = "sporadic",
        server_url: str = "https://app.daytona.io/api",
    ) -> Dict[str, Any]:
        """Dispatches LLM deployment instruction to the CLI driver."""
        task_prompt = f"Activate skill 'llm-deployer'. [Traffic Profile: {traffic_profile.upper()}] Goal: {prompt}"
        return await self.driver.execute_prompt(
            prompt=task_prompt,
            sandbox_id=sandbox_id,
            api_key=api_key,
            server_url=server_url,
        )
