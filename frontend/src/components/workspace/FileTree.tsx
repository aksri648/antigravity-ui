import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  FileType,
  Settings,
  Image,
} from "lucide-react";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  level?: number;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const name = filename.toLowerCase();

  // Special file names
  if (name === "package.json" || name === "tsconfig.json")
    return <FileJson className="h-4 w-4 text-green-400 shrink-0" />;
  if (name === "vite.config.ts" || name === "vite.config.js")
    return <Settings className="h-4 w-4 text-purple-400 shrink-0" />;
  if (name === ".gitignore" || name === ".env")
    return <Settings className="h-4 w-4 text-gray-500 shrink-0" />;

  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className="h-4 w-4 text-blue-400 shrink-0" />;
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-yellow-400 shrink-0" />;
    case "json":
      return <FileJson className="h-4 w-4 text-amber-400 shrink-0" />;
    case "css":
    case "scss":
    case "less":
      return <FileType className="h-4 w-4 text-pink-400 shrink-0" />;
    case "html":
      return <FileCode className="h-4 w-4 text-orange-400 shrink-0" />;
    case "md":
    case "mdx":
      return <FileText className="h-4 w-4 text-sky-300 shrink-0" />;
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "ico":
      return <Image className="h-4 w-4 text-emerald-400 shrink-0" />;
    case "txt":
    case "log":
      return <FileText className="h-4 w-4 text-gray-400 shrink-0" />;
    default:
      return <File className="h-4 w-4 text-gray-500 shrink-0" />;
  }
};

const FileTreeNode: React.FC<{
  node: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  level: number;
}> = ({ node, selectedPath, onSelectFile, level }) => {
  const [isOpen, setIsOpen] = useState(level < 1);

  const isSelected = selectedPath === node.path;
  const indent = level * 16;

  if (node.isDir) {
    const sortedChildren = [...(node.children || [])].sort((a, b) => {
      // Directories first, then files, alphabetical within each group
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left h-[26px] flex items-center gap-1 font-sans text-[13px] text-[#cccccc] hover:bg-[#2a2d2e] transition-colors relative group"
          style={{ paddingLeft: `${indent + 4}px` }}
        >
          {/* Indent guides */}
          {Array.from({ length: level }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[#404040] group-hover:bg-[#505050]"
              style={{ left: `${i * 16 + 12}px` }}
            />
          ))}
          <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#c5c5c5]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#c5c5c5]" />
            )}
          </span>
          {isOpen ? (
            <FolderOpen className="h-4 w-4 text-[#dcb67a] shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-[#dcb67a] shrink-0" />
          )}
          <span className="truncate ml-0.5 font-medium">{node.name}</span>
        </button>

        {isOpen && sortedChildren.length > 0 && (
          <div>
            {sortedChildren.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full text-left h-[26px] flex items-center gap-1.5 font-sans text-[13px] transition-colors relative group ${
        isSelected
          ? "bg-[#04395e] text-white"
          : "text-[#cccccc] hover:bg-[#2a2d2e]"
      }`}
      style={{ paddingLeft: `${indent + 22}px` }}
    >
      {/* Indent guides */}
      {Array.from({ length: level }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 w-px bg-[#404040] group-hover:bg-[#505050]"
          style={{ left: `${i * 16 + 12}px` }}
        />
      ))}
      {/* Active indicator */}
      {isSelected && (
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0078d4]" />
      )}
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  selectedPath,
  onSelectFile,
  level = 0,
}) => {
  // Sort nodes: directories first, then files, alphabetical within each group
  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col">
      {sortedNodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          level={level}
        />
      ))}
    </div>
  );
}
