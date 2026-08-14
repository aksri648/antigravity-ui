import React, { useState } from "react";
import {
  FolderGit2,
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  PanelLeftClose,
  FolderPlus,
  Bot,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Key,
} from "lucide-react";
import type { Project, Conversation } from "../../types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface ProjectsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string, description: string) => Promise<void>;
  onUpdateProject: (projectId: string, name: string, description: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (convId: string) => void;
  onCreateConversation: (projectId?: string) => Promise<void>;
  onUpdateConversationTitle: (convId: string, title: string) => Promise<void>;
  onDeleteConversation: (convId: string) => Promise<void>;
  userId?: string;
  userEmail?: string;
  userName?: string;
  onOpenSettings?: () => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  onLogout?: () => void;
}

export const ProjectsSidebar: React.FC<ProjectsSidebarProps> = ({
  isOpen,
  onToggle,
  projects,
  activeProject,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onUpdateConversationTitle,
  onDeleteConversation,
  userId = "guest-user",
  userEmail,
  userName,
  onOpenSettings,
  onOpenAuth,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // Inline editing state for conversation title
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState("");

  // Inline editing state for project name
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState("");

  const handleStartEditConv = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingConvTitle(conv.title);
  };

  const handleSaveEditConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (editingConvTitle.trim()) {
      await onUpdateConversationTitle(convId, editingConvTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleCancelEditConv = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(null);
  };

  const handleDeleteConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this chat conversation?")) {
      await onDeleteConversation(convId);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsSubmittingProject(true);
    try {
      await onCreateProject(newProjectName.trim(), newProjectDesc.trim());
      setNewProjectName("");
      setNewProjectDesc("");
      setIsCreateProjectModalOpen(false);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleSaveProjectName = async () => {
    if (!activeProject || !editingProjectName.trim()) return;
    await onUpdateProject(activeProject.id, editingProjectName.trim(), activeProject.description || "");
    setIsEditingProject(false);
  };

  const handleDeleteActiveProject = async () => {
    if (!activeProject) return;
    if (activeProject.isDefault) {
      alert("The default workspace project cannot be deleted.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete project "${activeProject.name}" and all its chats?`)) {
      await onDeleteProject(activeProject.id);
      setIsProjectDropdownOpen(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`transition-all duration-300 ease-in-out border-r border-white/10 bg-[#0d0d11] flex flex-col flex-shrink-0 relative z-20 ${
          isOpen ? "w-72" : "w-0 border-r-0 overflow-hidden"
        }`}
      >
        {isOpen && (
          <div className="flex flex-col h-full w-72">
            {/* Header: Project Switcher & Collapse */}
            <div className="p-3 border-b border-white/10 bg-[#121216]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" /> Projects & Chats
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              {/* Active Project Card / Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <FolderGit2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">
                        {activeProject?.name || "Default Workspace"}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate font-mono">
                        {activeProject?.slug ? `projects/${activeProject.slug}` : "default"}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isProjectDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Project Dropdown Menu */}
                {isProjectDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#17171c] border border-white/15 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Select Project
                    </div>
                    <div className="space-y-0.5 my-1">
                      {projects.map((proj) => {
                        const isSelected = activeProject?.id === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              onSelectProject(proj);
                              setIsProjectDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                              isSelected
                                ? "bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30"
                                : "text-gray-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FolderGit2 className={`h-3.5 w-3.5 ${isSelected ? "text-emerald-400" : "text-gray-400"}`} />
                              <span className="truncate">{proj.name}</span>
                            </div>
                            {proj.isDefault && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-white/20 text-gray-400">
                                default
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/10 pt-1.5 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsProjectDropdownOpen(false);
                          setIsCreateProjectModalOpen(true);
                        }}
                        className="w-full justify-start text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 h-8 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create New Project
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Project Actions Bar */}
              {activeProject && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-400">
                  {isEditingProject ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="text"
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        className="flex-1 px-1.5 py-0.5 bg-black/40 border border-emerald-500/40 rounded text-xs text-white"
                        placeholder="Project name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveProjectName}
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Save name"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProject(false)}
                        className="p-1 text-gray-400 hover:text-white cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate max-w-[170px]" title={activeProject.folderPath}>
                        📁 {activeProject.folderPath.replace("/home/daytona/persist", "~")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProjectName(activeProject.name);
                            setIsEditingProject(true);
                          }}
                          className="p-1 hover:text-white text-gray-400 cursor-pointer"
                          title="Rename Project"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        {!activeProject.isDefault && (
                          <button
                            type="button"
                            onClick={handleDeleteActiveProject}
                            className="p-1 hover:text-red-400 text-gray-400 cursor-pointer"
                            title="Delete Project"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* "+ New Chat" Action & Search Bar */}
            <div className="p-3 space-y-2 border-b border-white/5">
              <Button
                onClick={() => onCreateConversation(activeProject?.id)}
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> New Chat
              </Button>

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats in project..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Conversations List (Multi-Chats) */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Conversations</span>
                <span className="font-mono">{filteredConversations.length}</span>
              </div>

              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="h-8 w-8 text-gray-600 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-gray-400 font-medium">No chats found</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Click "+ New Chat" to start an autonomous coding thread.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  const isEditing = editingConvId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-white/10 text-white font-medium border border-emerald-500/30 shadow-sm"
                          : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      {/* Left: Chat Icon & Title */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <Bot className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-emerald-400" : "text-gray-400"}`} />
                        {isEditing ? (
                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingConvTitle}
                              onChange={(e) => setEditingConvTitle(e.target.value)}
                              className="w-full px-1.5 py-0.5 bg-black/50 border border-emerald-500/50 rounded text-xs text-white focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEditConv(e as any, conv.id);
                                if (e.key === "Escape") handleCancelEditConv(e as any);
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveEditConv(e, conv.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditConv}
                              className="p-1 text-gray-400 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="truncate" title={conv.title}>
                            {conv.title}
                          </span>
                        )}
                      </div>

                      {/* Right: Message count or hover action buttons */}
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 group-hover:hidden font-mono">
                            {conv.messageCount || 0} msgs
                          </span>
                          <div className="hidden group-hover:flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleStartEditConv(e, conv)}
                              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                              title="Rename chat"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteConv(e, conv.id)}
                              className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                              title="Delete chat"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* User Account Settings Popover Menu */}
            {isUserMenuOpen && (
              <div className="mx-3 mb-2 p-2 rounded-xl bg-[#18181f] border border-white/15 shadow-2xl space-y-1 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 z-30">
                <div className="px-2 py-1.5 border-b border-white/10 flex items-center justify-between">
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{userName || (userEmail ? userEmail.split("@")[0] : "Guest User")}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{userEmail || userId}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${userEmail ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-300"}`}>
                    {userEmail ? "Pro User" : "Guest"}
                  </Badge>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-gray-400" />
                    <span>Account & Cloud Settings</span>
                  </button>
                )}

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                  >
                    <Key className="h-3.5 w-3.5 text-amber-400" />
                    <span>Daytona & Model API Keys</span>
                  </button>
                )}

                {!userEmail && onOpenAuth ? (
                  <div className="pt-1 border-t border-white/10 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuth("signin");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-blue-400 hover:bg-blue-950/40 transition-colors text-left cursor-pointer font-medium"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Log In to Account</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuth("signup");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-950/40 transition-colors text-left cursor-pointer font-medium"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Sign Up for DELTA Cloud</span>
                    </button>
                  </div>
                ) : onLogout ? (
                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (window.confirm("Are you sure you want to sign out?")) {
                          onLogout();
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors text-left cursor-pointer font-medium"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Sidebar Footer: User Avatar & Account Profile Setting Bar */}
            <div className="p-2.5 border-t border-white/10 bg-[#121216]/90 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 flex-1 min-w-0 p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left group"
              >
                {/* User Avatar Circle */}
                <div className="relative shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-black font-extrabold text-xs shadow-md shadow-emerald-500/20">
                    {userName
                      ? userName.substring(0, 2).toUpperCase()
                      : userEmail
                      ? userEmail.substring(0, 2).toUpperCase()
                      : "G"}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#121216] ${userEmail ? "bg-emerald-400" : "bg-amber-400"}`} />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {userName || (userEmail ? userEmail.split("@")[0] : "Guest User")}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">
                    {userEmail || "Guest Mode"}
                  </p>
                </div>

                <div className="text-gray-400 group-hover:text-white p-1">
                  {isUserMenuOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </div>
              </button>

              {/* Direct Settings Gear Icon Button */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Account & Cloud Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* New Project Modal */}
      {isCreateProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#16161c] border border-white/15 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Project</h3>
                  <p className="text-xs text-gray-400">Provisions an isolated folder in your Daytona persistent volume.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Project Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Next.js SaaS Dashboard, AI Chatbot..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Description <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateProjectModalOpen(false)}
                  className="border-white/15 text-gray-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingProject || !newProjectName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer gap-1.5"
                >
                  {isSubmittingProject ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-3.5 w-3.5" /> Create Project
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
