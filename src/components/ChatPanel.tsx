"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// Lightweight markdown renderer — handles bold, lists, paragraphs
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let last = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: "var(--ink)" }}>{match[1]}</strong>);
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i].trim();

    // Numbered list block
    if (/^\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\.\s/, "");
        items.push(
          <li key={i} style={{ marginBottom: "4px", paddingLeft: "4px" }}>
            {renderInline(text)}
          </li>
        );
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ listStyleType: "decimal", paddingLeft: "20px", margin: "8px 0", color: "var(--ink)" }}>
          {items}
        </ol>
      );
      continue;
    }

    // Bullet list block
    if (/^[-*]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^[-*]\s/, "");
        items.push(
          <li key={i} style={{ marginBottom: "4px", paddingLeft: "4px" }}>
            {renderInline(text)}
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ listStyleType: "disc", paddingLeft: "20px", margin: "8px 0", color: "var(--ink)" }}>
          {items}
        </ul>
      );
      continue;
    }

    // Empty line — skip
    if (line === "") {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: "0 0 8px 0", lineHeight: "1.65", color: "var(--ink)" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div style={{ fontSize: "0.875rem" }}>{elements}</div>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ChatPanelProps {
  documentId: string;
  shareToken?: string;
}

export default function ChatPanel({ documentId, shareToken }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(`chat-session-${documentId}`) ||
        (() => {
          const id = uuidv4();
          localStorage.setItem(`chat-session-${documentId}`, id);
          return id;
        })()
      : uuidv4()
  );
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const params = new URLSearchParams({ documentId, sessionId });
      if (shareToken) params.set("token", shareToken);
      const res = await fetch(`/api/chat?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length) {
          setMessages(
            data.messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      }
    };
    loadHistory();
  }, [documentId, sessionId, shareToken]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);

    // Add user message immediately
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder for streaming assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question, sessionId, shareToken }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: err.error || "An error occurred.",
            streaming: false,
          };
          return updated;
        });
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + payload.text,
                    streaming: true,
                  };
                }
                return updated;
              });
            }
            if (payload.done) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = { ...last, streaming: false };
                }
                return updated;
              });
            }
            if (payload.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: payload.error,
                  streaming: false,
                };
                return updated;
              });
            }
          } catch {
            // malformed JSON chunk, skip
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Network error. Please try again.",
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    const newId = uuidv4();
    if (typeof window !== "undefined") {
      localStorage.setItem(`chat-session-${documentId}`, newId);
    }
    setSessionId(newId);
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#fff" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "#FEF0E0", border: "2px solid var(--cream-darker)", boxShadow: "3px 3px 0 var(--cream-darker)" }}>
              <svg className="w-6 h-6" style={{ color: "var(--orange)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Ask anything about this document</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>Answers are grounded in the PDF content</p>

            {/* Suggested questions */}
            <div className="mt-4 space-y-2">
              {[
                "What is this document about?",
                "What are the key obligations or dates?",
                "Summarize the main points",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="block w-full text-left text-xs rounded-xl px-3 py-2 transition-all"
                  style={{ background: "var(--cream)", border: "1.5px solid var(--cream-darker)", color: "var(--ink-muted)", boxShadow: "2px 2px 0 var(--cream-darker)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                style={{ background: "var(--orange)", border: "2px solid var(--orange-dark)" }}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
            )}

            <div
              className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
              style={msg.role === "user" ? {
                background: "var(--card-bg)",
                color: "var(--cream)",
                border: "2px solid var(--border)",
                borderTopRightRadius: "4px",
                boxShadow: "3px 3px 0 var(--border)",
                fontSize: "0.875rem",
                lineHeight: "1.6"
              } : {
                background: "var(--cream)",
                color: "var(--ink)",
                border: "2px solid var(--cream-darker)",
                borderTopLeftRadius: "4px",
                boxShadow: "2px 2px 0 var(--cream-darker)"
              }}
            >
              {msg.role === "user" ? (
                <span style={{ fontSize: "0.875rem", lineHeight: "1.6" }}>{msg.content}</span>
              ) : msg.content ? (
                <>
                  <MarkdownContent content={msg.content} />
                  {msg.streaming && (
                    <span className="inline-block w-0.5 h-4 animate-pulse align-middle" style={{ background: "var(--orange)", marginLeft: "2px" }} />
                  )}
                </>
              ) : (
                msg.streaming && (
                  <span className="flex gap-1 items-center py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--orange)", animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--orange)", animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--orange)", animationDelay: "300ms" }} />
                  </span>
                )
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "2px solid var(--cream-darker)" }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="input text-sm py-2 resize-none flex-1"
            rows={2}
            placeholder="Ask a question… (Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            id="chat-send-btn"
            className="btn-primary p-2.5 flex-shrink-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Enter ↵ send · Shift+Enter newline</p>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={loading}
              className="text-xs font-semibold flex items-center gap-1 transition-colors"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#b53b1a")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-muted)")}
              title="Clear chat history"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
