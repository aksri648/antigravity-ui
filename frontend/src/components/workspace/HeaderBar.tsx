import React from "react";
import { Sparkles, Cpu, ShieldCheck, Settings, Layers, LogOut, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface HeaderBarProps {
  sandboxId?: string;
  userId: string;
  onOpenSettings: () => void;
  onExitWorkspace: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  sandboxId,
  userId,
  onOpenSettings,
  onExitWorkspace,
}) => {
  return (
    <header className="h-13 border-b border-border bg-card px-4 flex items-center justify-between">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">AGY Cloud Workspace</h1>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-blue-500/40 text-blue-400">
              Daytona Powered
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">AGY CLI + Cloud Sandboxing + Live App Preview</p>
        </div>
      </div>

      {/* Status Badges & Controls */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="success" className="gap-1 text-[11px] py-0.5">
            <Cpu className="h-3 w-3" /> Sandbox: {sandboxId ? sandboxId.substring(0, 14) : "Initializing..."}
          </Badge>
          <Badge variant="default" className="gap-1 text-[11px] py-0.5">
            <ShieldCheck className="h-3 w-3" /> User: {userId.substring(0, 10)}
          </Badge>
          <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-mono text-muted-foreground">
            <Layers className="h-3 w-3" /> Vol (~/.gemini)
          </Badge>
        </div>

        {/* Settings Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 gap-1.5 text-xs border-border hover:bg-accent text-white font-medium"
          title="Open Workspace Settings & Environment Configuration"
        >
          <Settings className="h-3.5 w-3.5 text-blue-400" /> Settings
        </Button>

        {/* Exit Workspace */}
        <Button
          variant="destructive"
          size="sm"
          onClick={onExitWorkspace}
          className="h-8 gap-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30"
          title="Exit workspace and return to home page"
        >
          <LogOut className="h-3.5 w-3.5" /> Exit App
        </Button>
      </div>
    </header>
  );
};

