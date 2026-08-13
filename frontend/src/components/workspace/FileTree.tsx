import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText, FileJson, File } from "lucide-react";

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
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case "json":
      return <FileJson className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case "css":
    case "scss":
      return <FileText className="h-3.5 w-3.5 text-pink-400 shrink-0" />;
    case "html":
      return <FileCode className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    case "md":
    case "txt":
      return <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
    default:
      return <File className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  }
};

const FileTreeNode: React.FC<{
  node: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  level: number;
}> = ({ node, selectedPath, onSelectFile, level }) => {
  const [isOpen, setIsOpen] = useState(true);

  const isSelected = selectedPath === node.path;
  const paddingLeft = `${level * 12 + 8}px`;

  if (node.isDir) {
    return (
      <div className="select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft }}
          className="w-full text-left py-1 pr-2 rounded flex items-center gap-1.5 font-mono text-xs text-gray-300 hover:bg-[#2a2d2e] hover:text-white transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-400/90 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {isOpen && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => (
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
      style={{ paddingLeft: `${level * 12 + 20}px` }}
      className={`w-full text-left py-1 pr-2 rounded flex items-center gap-2 font-mono text-xs transition-colors select-none ${
        isSelected
          ? "bg-[#37373d] text-white font-semibold border-l-2 border-blue-500"
          : "text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200"
      }`}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ nodes, selectedPath, onSelectFile, level = 0 }) => {
  return (
    <div className="flex flex-col space-y-0.5">
      {nodes.map((node) => (
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
};
