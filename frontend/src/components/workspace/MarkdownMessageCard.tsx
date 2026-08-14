import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  Code2,
  Bot,
  Sparkles,
  ExternalLink,
  Terminal,
  Cpu,
  Server,
  GitPullRequest,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { AgentMode, ChatMessage } from "./ChatPane";

interface MarkdownMessageCardProps {
  message: ChatMessage;
  isProcessing?: boolean;
}

export const MarkdownMessageCard: React.FC<MarkdownMessageCardProps> = ({
  message,
  isProcessing = false,
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const getPersonaBadge = (mode?: AgentMode) => {
    switch (mode) {
      case "app-developer":
        return {
          label: "App Developer",
          icon: Code2,
          color: "bg-blue-950/60 text-blue-300 border-blue-500/40",
        };
      case "llm-deployer":
        return {
          label: "LLM Deployer",
          icon: Cpu,
          color: "bg-purple-950/60 text-purple-300 border-purple-500/40",
        };
      case "app-deployer":
        return {
          label: "App Deployer",
          icon: Server,
          color: "bg-emerald-950/60 text-emerald-300 border-emerald-500/40",
        };
      case "app-maintainer":
        return {
          label: "App Maintainer",
          icon: GitPullRequest,
          color: "bg-amber-950/60 text-amber-300 border-amber-500/40",
        };
      default:
        return {
          label: "Antigravity FDE",
          icon: Sparkles,
          color: "bg-emerald-950/60 text-emerald-300 border-emerald-500/40",
        };
    }
  };

  const persona = getPersonaBadge(message.agentMode);
  const PersonaIcon = persona.icon;

  if (message.sender === "user") {
    return (
      <div className="w-full flex justify-end group py-1.5">
        <div className="max-w-[88%] rounded-2xl sm:rounded-[22px] bg-[#2a2a34] hover:bg-[#30303c] transition-colors text-white px-4.5 py-3 shadow-lg border border-white/12 space-y-1">
          <p className="text-[14.5px] sm:text-[15px] leading-relaxed whitespace-pre-wrap font-sans selection:bg-purple-500/40 selection:text-white">
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-[#15151a] border border-white/10 shadow-xl overflow-hidden group transition-all hover:border-white/20">
      {/* Assistant Card Header */}
      <div className="px-4 py-2.5 bg-[#1a1a22] border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide">AGY Agent</span>
          <Badge
            variant="outline"
            className={`gap-1 text-[10px] font-mono py-0 px-2 rounded-md ${persona.color}`}
          >
            <PersonaIcon className="h-2.5 w-2.5" />
            {persona.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyMessage}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white rounded-md hover:bg-white/10"
            title="Copy response markdown"
          >
            {copiedMessage ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Markdown Content Body with Claude-Style Generous Spacing */}
      <div className="p-5 text-[14.5px] sm:text-[15px] text-gray-200 leading-relaxed space-y-4 font-sans selection:bg-emerald-500/30 selection:text-white">
        {!message.text && isProcessing ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm italic py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            Generating response & executing actions...
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h1: ({ children }) => (
                <h1 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-4 mb-2.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-bold text-emerald-300 border-b border-white/5 pb-1.5 mt-3.5 mb-2">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-[15px] font-bold text-blue-300 mt-3 mb-1.5">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-xs font-semibold text-gray-300 mt-2 mb-1">{children}</h4>
              ),
              // Paragraphs
              p: ({ children }) => <p className="leading-relaxed my-1 text-gray-200">{children}</p>,
              // Lists
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 my-1.5 text-gray-300 pl-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 my-1.5 text-gray-300 pl-1">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              // Blockquote / Alerts
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-emerald-500 bg-emerald-950/20 px-3.5 py-2 my-2 rounded-r-xl text-emerald-200 text-xs italic">
                  {children}
                </blockquote>
              ),
              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto my-3 rounded-xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-xs text-left">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-white/5 font-semibold text-white">{children}</thead>,
              tbody: ({ children }) => <tbody className="divide-y divide-white/5">{children}</tbody>,
              tr: ({ children }) => <tr className="hover:bg-white/[0.03] transition-colors">{children}</tr>,
              th: ({ children }) => <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider">{children}</th>,
              td: ({ children }) => <td className="px-3 py-2 text-gray-300 font-mono text-[11px]">{children}</td>,
              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  {children}
                  <ExternalLink className="h-2.5 w-2.5 inline ml-0.5 opacity-70" />
                </a>
              ),
              // Strong / Bold
              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
              // Horizontal Rule
              hr: () => <hr className="border-white/10 my-3" />,
              // Code Blocks & Inline Code
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");

                if (!inline && (match || codeString.includes("\n"))) {
                  return (
                    <CodeBlockCard
                      language={match ? match[1] : "bash"}
                      code={codeString}
                    />
                  );
                }

                return (
                  <code
                    className="px-1.5 py-0.5 rounded-md bg-white/10 text-emerald-300 font-mono text-[11px] border border-white/10"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

interface CodeBlockCardProps {
  language: string;
  code: string;
}

const CodeBlockCard: React.FC<CodeBlockCardProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl bg-[#0d0d10] border border-white/10 overflow-hidden shadow-lg">
      {/* Code Header Toolbar */}
      <div className="px-3 py-1.5 bg-[#16161b] border-b border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5 text-gray-300">
          <Terminal className="h-3 w-3 text-emerald-400" />
          <span className="uppercase font-semibold tracking-wider text-emerald-400">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-3 overflow-x-auto text-[11px] font-mono text-emerald-300/90 leading-relaxed scrollbar-thin">
        <pre className="m-0 whitespace-pre">{code}</pre>
      </div>
    </div>
  );
};
