import React from "react";
import { Sparkles, Cpu, ShieldCheck, Settings, Layers, LogOut, User } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface HeaderBarProps {
  sandboxId?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  onOpenSettings: () => void;
  onExitWorkspace: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  sandboxId,
  userId,
  userEmail,
  userName,
  onOpenSettings,
  onExitWorkspace,
}) => {
  const displayName = userName || (userEmail ? userEmail.split("@")[0] : userId.substring(0, 8));

  return (
    <header className="h-13 border-b border-border bg-card px-4 flex items-center justify-between">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">AGY Cloud SaaS</h1>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-blue-500/40 text-blue-400">
              Daytona Multi-User
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Autonomous Code Agent + MicroVM Sandboxes</p>
        </div>
      </div>

      {/* Status Badges & Controls */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="success" className="gap-1 text-[11px] py-0.5">
            <Cpu className="h-3 w-3" /> Sandbox: {sandboxId ? sandboxId.substring(0, 14) : "Initializing..."}
          </Badge>
          
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2 py-0.5 rounded-full text-[11px] text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <User className="h-3 w-3 text-blue-400" />
            <span className="font-medium">{displayName}</span>
          </div>

          <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-mono text-muted-foreground">
            <Layers className="h-3 w-3" /> Persistent SQLite
          </Badge>
        </div>

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
          title="Exit workspace immediately"
        >
          <LogOut className="h-3.5 w-3.5" /> Exit App
        </Button>
      </div>
    </header>
  );
};


