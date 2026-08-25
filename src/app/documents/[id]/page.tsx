"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import CommentsPanel from "@/components/CommentsPanel";
import ChatPanel from "@/components/ChatPanel";

const PDFViewer = dynamic(() => import("@/components/PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full" style={{ background: "var(--cream)" }}>
      <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
        style={{ borderColor: "var(--cream-darker)", borderTopColor: "var(--orange)" }} />
    </div>
  ),
});

interface Document {
  id: string;
  filename: string;
  storageUrl: string;
  summary: string | null;
  createdAt: string;
  ownerName: string;
}

type SidebarTab = "comments" | "chat";

export default function DocumentPage() {
  const { data: session } = useSession();
  const params = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [mobileTab, setMobileTab] = useState<"pdf" | "sidebar">("pdf");
  const [sidebarWidth, setSidebarWidth] = useState(384); // default lg:w-96
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(384);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(700, Math.max(280, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const id = params.id as string;

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) {
          setError(res.status === 403 ? "Access denied" : "Document not found");
          return;
        }
        const data = await res.json();
        setDocument(data.document);
        setIsOwner(data.isOwner);
      } catch {
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [id]);

  const generateShareLink = async () => {
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      const data = await res.json();
      setShareUrl(data.url);
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{ borderColor: "var(--cream-darker)", borderTopColor: "var(--orange)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--cream)" }}>
        <p className="text-lg font-bold" style={{ color: "#b53b1a" }}>{error}</p>
        <Link href="/dashboard" className="btn-secondary text-sm">← Back to dashboard</Link>
      </div>
    );
  }

  if (!document) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      {/* Navbar */}
      <nav className="z-50 flex-shrink-0 sticky top-0"
        style={{ background: "rgba(253,244,231,0.95)", backdropFilter: "blur(12px)", borderBottom: "2px solid var(--cream-darker)" }}>
        <div className="h-14 px-4 flex items-center gap-3">
          <Link href="/dashboard" className="transition-colors flex-shrink-0 p-1.5 rounded-lg hover:bg-white"
            style={{ color: "var(--ink-muted)" }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm truncate" style={{ color: "var(--ink)" }}>{document.filename}</h1>
            <p className="text-xs truncate" style={{ color: "var(--ink-muted)" }}>
              {document.ownerName} ·{" "}
              {new Date(document.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Summary button */}
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="btn-secondary text-xs py-1.5 px-3 hidden sm:flex"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Summary
            </button>

            {/* Share button (owner only) */}
            {isOwner && (
              <button
                id="share-btn"
                onClick={generateShareLink}
                disabled={sharing}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {sharing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                Share
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Share link banner */}
      {shareUrl && (
        <div className="px-4 py-2.5 flex items-center gap-3 flex-shrink-0"
          style={{ background: "#FEF0E0", borderBottom: "2px solid var(--orange-light)" }}>
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--orange-dark)" }}>Share link:</span>
          <code className="flex-1 text-xs px-2 py-1 rounded-lg truncate min-w-0"
            style={{ background: "#fff", border: "1.5px solid var(--cream-darker)", color: "var(--ink)" }}>
            {shareUrl}
          </code>
          <button onClick={copyShareUrl} className="btn-primary text-xs py-1 px-3 flex-shrink-0">
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button
            onClick={() => setShareUrl("")}
            title="Dismiss"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--orange-dark)", background: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Summary banner */}
      {showSummary && (
        <div className="px-4 py-3 flex-shrink-0"
          style={{ background: "#fff", borderBottom: "2px solid var(--cream-darker)" }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "var(--orange)", border: "2px solid var(--orange-dark)" }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              {document.summary ? (
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{document.summary}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full pulse-dot" style={{ background: "var(--orange)" }} />
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>AI summary is still being generated…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="flex sm:hidden flex-shrink-0"
        style={{ borderBottom: "2px solid var(--cream-darker)", background: "#fff" }}>
        <button
          onClick={() => setMobileTab("pdf")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors`}
          style={{
            color: mobileTab === "pdf" ? "var(--orange)" : "var(--ink-muted)",
            borderBottom: mobileTab === "pdf" ? "2px solid var(--orange)" : "2px solid transparent",
          }}
        >
          PDF
        </button>
        <button
          onClick={() => setMobileTab("sidebar")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors`}
          style={{
            color: mobileTab === "sidebar" ? "var(--orange)" : "var(--ink-muted)",
            borderBottom: mobileTab === "sidebar" ? "2px solid var(--orange)" : "2px solid transparent",
          }}
        >
          Chat & Comments
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF area */}
        <div className={`flex-1 overflow-hidden ${mobileTab === "sidebar" ? "hidden sm:flex" : "flex"} flex-col`}
          style={{ background: "var(--cream-dark)" }}>
          <PDFViewer url={document.storageUrl} />
        </div>

        {/* Drag handle — desktop only */}
        <div
          className="hidden sm:flex items-center justify-center flex-shrink-0 cursor-col-resize group"
          style={{ width: 8, background: "var(--cream-darker)", transition: "background 0.15s" }}
          onMouseDown={onDragStart}
        >
          <div className="w-0.5 h-8 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--orange)" }} />
        </div>

        {/* Right sidebar */}
        <div
          className={`w-full flex flex-col flex-shrink-0 ${mobileTab === "pdf" ? "hidden sm:flex" : "flex"}`}
          style={{ width: typeof window !== "undefined" && window.innerWidth >= 640 ? sidebarWidth : undefined, background: "#fff", borderLeft: "2px solid var(--cream-darker)" }}>
          {/* Tabs */}
          <div className="flex flex-shrink-0" style={{ borderBottom: "2px solid var(--cream-darker)" }}>
            {(["chat", "comments"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-3 text-sm font-semibold capitalize transition-colors"
                style={{
                  color: activeTab === tab ? "var(--orange)" : "var(--ink-muted)",
                  borderBottom: activeTab === tab ? "2.5px solid var(--orange)" : "2.5px solid transparent",
                  background: "transparent",
                }}
              >
                {tab === "chat" ? "💬 AI Chat" : "🗨 Comments"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" ? (
              <ChatPanel documentId={id} />
            ) : (
              <CommentsPanel
                documentId={id}
                isOwner={isOwner}
                sessionUserName={session?.user?.name || undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
