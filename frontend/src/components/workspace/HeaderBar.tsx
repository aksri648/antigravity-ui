import React from "react";
import { Sparkles, Cpu, Settings, Layers, LogOut, User, LogIn, UserPlus, PanelLeft, PanelLeftClose, FolderGit2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface HeaderBarProps {
  sandboxId?: string;
  isProvisioning?: boolean;
  userId: string;
  userEmail?: string;
  userName?: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeProjectName?: string;
  onOpenSettings: () => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  onStartSandbox?: () => void;
  onExitWorkspace: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  sandboxId,
  isProvisioning,
  userId,
  userEmail,
  userName,
  isSidebarOpen = true,
  onToggleSidebar,
  activeProjectName,
  onOpenSettings,
  onOpenAuth,
  onStartSandbox,
  onExitWorkspace,
}) => {
  const displayName = userName || (userEmail ? userEmail.split("@")[0] : userId.substring(0, 8));
  const isGuest = !userEmail && !userName;

  return (
    <header className="h-14 border-b border-white/10 bg-[#121216] px-3 sm:px-5 flex items-center justify-between">
      {/* Brand & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title={isSidebarOpen ? "Collapse Projects & Chats Sidebar" : "Expand Projects & Chats Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        )}

        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-black shadow-md shadow-emerald-500/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold tracking-tight text-white font-mono">DELTA</h1>
            <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/40 text-emerald-400 font-mono">
              SaaS IDE
            </Badge>
            {activeProjectName && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-[10px] py-0 px-2 border-white/15 bg-white/5 text-gray-300">
                <FolderGit2 className="h-3 w-3 text-emerald-400" /> {activeProjectName}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-gray-400">Autonomous Code Agents • Daytona MicroVMs</p>
        </div>
      </div>

      {/* Status Badges & SaaS Account Controls */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-2">
          {/* Dynamic Sandbox Status / Start Button */}
          {sandboxId ? (
            <Badge variant="success" className="gap-1.5 text-[11px] py-0.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Cpu className="h-3 w-3 text-emerald-400" /> {sandboxId.substring(0, 14)}
            </Badge>
          ) : isProvisioning ? (
            <Badge variant="default" className="gap-1.5 text-[11px] py-0.5 bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse">
              <Cpu className="h-3 w-3 text-blue-400 animate-spin" /> Provisioning Sandbox...
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[11px] py-0.5 text-amber-300/80 border-amber-500/30 bg-amber-500/5">
                <Cpu className="h-3 w-3 mr-1 text-amber-400" /> Sandbox: Stopped
              </Badge>
              {onStartSandbox && (
                <Button
                  size="sm"
                  onClick={onStartSandbox}
                  className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1 shadow-sm shadow-emerald-600/20 cursor-pointer"
                  title="Launch or provision your isolated Daytona sandbox microVM"
                >
                  <Sparkles className="h-3 w-3" /> Start Sandbox
                </Button>
              )}
            </div>
          )}
          
          {/* User Account / Profile Badge */}
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-0.5 rounded-full text-[11px] text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <User className="h-3 w-3 text-blue-400" />
            <span className="font-medium">{displayName}</span>
            {isGuest && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500/40 text-amber-300">
                Guest
              </Badge>
            )}
          </div>

          <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-mono text-muted-foreground">
            <Layers className="h-3 w-3" /> Persistent SQLite
          </Badge>
        </div>

        {/* If Guest, show prominent Sign In / Sign Up buttons */}
        {isGuest && onOpenAuth && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenAuth("signin")}
              className="h-8 gap-1 text-xs border-border text-white hover:bg-accent cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5 text-blue-400" /> Log In
            </Button>
            <Button
              size="sm"
              onClick={() => onOpenAuth("signup")}
              className="h-8 gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm shadow-blue-600/20"
            >
              <UserPlus className="h-3.5 w-3.5" /> Sign Up
            </Button>
          </div>
        )}

        {/* Settings Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 gap-1.5 text-xs border-border hover:bg-accent text-white font-medium transition-all"
          title="Open Workspace Settings & Environment Configuration"
        >
          <Settings className="h-3.5 w-3.5 text-blue-400" /> Settings
        </Button>

        {/* Exit Workspace / Sign Out — Instant response */}
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onExitWorkspace();
          }}
          className="h-8 gap-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 active:scale-95 transition-all cursor-pointer"
          title="Exit workspace immediately and return to SaaS Home"
        >
          <LogOut className="h-3.5 w-3.5" /> Exit App
        </Button>
      </div>
    </header>
  );
};
