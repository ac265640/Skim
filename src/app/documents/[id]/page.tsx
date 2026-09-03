// PDF viewer (auth-gated by middleware)

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

interface ShareLink {
  id: string;
  token: string;
  url: string;
  createdAt: string;
  revoked: boolean;
}

type SidebarTab = "comments" | "chat";

// ─── Share Link Manager Modal ──────────────────────────────────────────────
function ShareModal({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/share?documentId=${documentId}`);
      const data = await res.json();
      setLinks(data.shareLinks || []);
    } finally {
      setLoadingLinks(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (data.shareLink) {
        setLinks((prev) => [{ ...data.shareLink, url: data.url }, ...prev]);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setRevoking(linkId);
    try {
      await fetch(`/api/share?id=${linkId}`, { method: "DELETE" });
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, revoked: true } : l))
      );
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = (link: ShareLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatRelative = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  const activeLinks = links.filter((l) => !l.revoked);
  const revokedLinks = links.filter((l) => l.revoked);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(28,20,9,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(540px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          background: "#fff",
          border: "2.5px solid var(--cream-darker)",
          borderRadius: "20px",
          boxShadow: "8px 8px 0 var(--cream-darker)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "2px solid var(--cream-darker)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#FEF0E0", border: "2px solid var(--cream-darker)" }}
            >
              <svg className="w-4 h-4" style={{ color: "var(--orange)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--ink)", fontFamily: "'Instrument Serif', serif", fontSize: "1rem" }}>
                Manage Share Links
              </p>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                {activeLinks.length} active link{activeLinks.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="create-link-btn"
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              {creating ? (
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              )}
              New link
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--ink-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--cream)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
          {loadingLinks ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="shimmer rounded-xl h-16" style={{ border: "2px solid var(--cream-darker)" }} />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-10">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "#FEF0E0", border: "2px solid var(--cream-darker)" }}
              >
                <svg className="w-6 h-6" style={{ color: "var(--orange)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>No share links yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>Click &quot;New link&quot; to create your first share link</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Active links */}
              {activeLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                  style={{ background: "#FAFAF8", border: "2px solid var(--cream-darker)" }}
                >
                  {/* Active dot */}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.18)" }}
                  />

                  {/* URL + meta */}
                  <div className="flex-1 min-w-0">
                    <code
                      className="block text-xs truncate"
                      style={{ color: "var(--ink)", fontFamily: "monospace" }}
                    >
                      {link.url}
                    </code>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                      Created {formatRelative(link.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleCopy(link)}
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all"
                      style={{
                        background: copiedId === link.id ? "#22c55e" : "var(--cream)",
                        color: copiedId === link.id ? "#fff" : "var(--ink)",
                        border: "2px solid var(--cream-darker)",
                      }}
                    >
                      {copiedId === link.id ? "✓" : "Copy"}
                    </button>
                    <button
                      onClick={() => handleRevoke(link.id)}
                      disabled={revoking === link.id}
                      title="Revoke this link"
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1"
                      style={{
                        background: "transparent",
                        color: "#b53b1a",
                        border: "2px solid #f4b89a",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#fff0ea";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {revoking === link.id ? (
                        <div className="w-3 h-3 border-2 rounded-full animate-spin"
                          style={{ borderColor: "#f4b89a", borderTopColor: "#b53b1a" }} />
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Revoke
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* Revoked links section */}
              {revokedLinks.length > 0 && (
                <>
                  <p className="text-xs font-semibold mt-3 mb-1 px-0.5" style={{ color: "var(--ink-muted)" }}>
                    Revoked links
                  </p>
                  {revokedLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                      style={{ background: "#FAFAF8", border: "2px solid var(--cream-darker)", opacity: 0.55 }}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: "#94a3b8" }}
                      />
                      <div className="flex-1 min-w-0">
                        <code
                          className="block text-xs truncate line-through"
                          style={{ color: "var(--ink-muted)", fontFamily: "monospace" }}
                        >
                          {link.url}
                        </code>
                        <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                          Created {formatRelative(link.createdAt)} · revoked
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Document Page ────────────────────────────────────────────────────
export default function DocumentPage() {
  const { data: session } = useSession();
  const params = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [showShareModal, setShowShareModal] = useState(false);
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
    window.document.body.style.cursor = "col-resize";
    window.document.body.style.userSelect = "none";
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
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
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
      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          documentId={id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Navbar */}
      <nav className="z-40 flex-shrink-0 sticky top-0"
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
                onClick={() => setShowShareModal(true)}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            )}
          </div>
        </div>
      </nav>

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
          className="flex-1 py-2.5 text-sm font-semibold transition-colors"
          style={{
            color: mobileTab === "pdf" ? "var(--orange)" : "var(--ink-muted)",
            borderBottom: mobileTab === "pdf" ? "2px solid var(--orange)" : "2px solid transparent",
          }}
        >
          PDF
        </button>
        <button
          onClick={() => setMobileTab("sidebar")}
          className="flex-1 py-2.5 text-sm font-semibold transition-colors"
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
          style={{ width: sidebarWidth, background: "#fff", borderLeft: "2px solid var(--cream-darker)" }}>
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
