export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string;
  folderPath: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  projectId: string;
  sandboxId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface LLMDeployment {
  id: string;
  userId: string;
  projectId?: string;
  sandboxId?: string;
  modelName: string;
  provider: string;
  endpointUrl: string;
  gpuType: string;
  trafficProfile: string;
  costEstimate: string;
  status: "RUNNING" | "PROVISIONING" | "STOPPED" | "FAILED" | string;
  latencyMs: number;
  throughputTps: number;
  contextLength: number;
  quantization: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppDeployment {
  id: string;
  userId: string;
  projectId?: string;
  sandboxId?: string;
  appName: string;
  provider: string;
  publicUrl: string;
  port: number;
  imageTag: string;
  instanceType: string;
  status: "DEPLOYED" | "BUILDING" | "HEALTHY" | "FAILED" | string;
  sslEnabled: boolean;
  replicas: number;
  cpuUtilization: number;
  memoryUtilization: number;
  uptime: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentSummary {
  totalLlmDeployments: number;
  activeLlmCount: number;
  totalAppDeployments: number;
  activeAppCount: number;
  llmDeployments: LLMDeployment[];
  appDeployments: AppDeployment[];
}
