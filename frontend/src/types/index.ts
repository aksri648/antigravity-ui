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
