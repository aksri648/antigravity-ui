import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Brain, Wrench, Sparkles, Trash2, Loader2, Code2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export type ChatMessage = {
  id: string;
  sender: "user" | "agy";
  text: string;
  thoughts?: string[];
  tools?: { name: string; path?: string; status?: "running" | "done" }[];
  timestamp: number;
};

interface ChatPaneProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isProcessing: boolean;
  onClearChat: () => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  onSendMessage,
  isProcessing,
  onClearChat,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-col bg-card/60 border-r border-border">
      {/* Chat Pane Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-card/90">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Bot className="h-4 w-4 text-blue-400" />
          <span>AGY Assistant</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono text-muted-foreground">
            30% width
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-white"
          onClick={onClearChat}
          title="Clear chat thread"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400 mb-3 border border-blue-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-xs font-medium text-white mb-1">AGY Cloud Agent Ready</p>
            <p className="text-[11px] leading-relaxed max-w-xs mb-4">
              Enter a prompt to create code, run dev servers, and live preview your web application inside Daytona.
            </p>

            <div className="w-full space-y-2 text-left">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Suggested Prompts:</p>
              {[
                "Build a modern React Counter App with Tailwind",
                "Create a REST API endpoint in Node.js",
                "Build a Vite + Tailwind Dashboard with charts",
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(s)}
                  className="w-full text-left text-xs bg-black/40 hover:bg-accent border border-border/80 rounded-md p-2 transition-colors text-muted-foreground hover:text-white"
                >
                  ✨ {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* Sender Tag */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                {msg.sender === "user" ? (
                  <>
                    <span>You</span> <User className="h-3 w-3 text-blue-400" />
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 text-emerald-400" /> <span>agy agent</span>
                  </>
                )}
              </div>

              {/* Reasoning / Thoughts Section */}
              {msg.thoughts && msg.thoughts.length > 0 && (
                <div className="w-full rounded-md border border-purple-500/30 bg-purple-950/20 p-2.5 space-y-1.5 text-xs text-purple-200">
                  <div className="flex items-center gap-1.5 font-semibold text-[11px] text-purple-300">
                    <Brain className="h-3.5 w-3.5" /> AGY Reasoning
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-purple-300/80 leading-relaxed">
                    {msg.thoughts.map((thought, i) => (
                      <p key={i}>💭 {thought}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Executed Tools Chips */}
              {msg.tools && msg.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 my-1">
                  {msg.tools.map((tool, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="gap-1 text-[10px] bg-black/50 border-emerald-500/30 text-emerald-400 font-mono py-0.5"
                    >
                      <Wrench className="h-3 w-3" /> {tool.name} {tool.path ? `(${tool.path})` : ""}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Message Bubble Content */}
              <div
                className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed max-w-[95%] whitespace-pre-wrap font-mono ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none shadow-md"
                    : "bg-black/60 border border-border text-gray-200 rounded-bl-none shadow"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-950/20 border border-blue-500/30 rounded-md p-2.5 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>AGY executing inside Daytona sandbox...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card/90 space-y-2">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type prompt to generate code & preview... (Cmd+Enter to send)"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-black/50 p-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 className="h-3 w-3" /> Cmd+Enter to send
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isProcessing}
            className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Prompt
          </Button>
        </div>
      </form>
    </div>
  );
};
