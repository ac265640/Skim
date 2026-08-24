"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import CommentsPanel from "@/components/CommentsPanel";
import ChatPanel from "@/components/ChatPanel";

const PDFViewer = dynamic(() => import("@/components/PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-lg font-medium">{error}</p>
        <Link href="/dashboard" className="btn-secondary text-sm">← Back to dashboard</Link>
      </div>
    );
  }

  if (!document) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Navbar */}
      <nav className="glass border-b border-gray-800/60 z-50 flex-shrink-0">
        <div className="h-14 px-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-white text-sm truncate">{document.filename}</h1>
            <p className="text-xs text-gray-500 truncate">
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
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        <div className="bg-violet-950/60 border-b border-violet-800/40 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-violet-300 flex-shrink-0">Share link:</span>
          <code className="flex-1 text-xs bg-gray-900 px-2 py-1 rounded text-gray-300 truncate min-w-0">
            {shareUrl}
          </code>
          <button onClick={copyShareUrl} className="btn-secondary text-xs py-1 px-3 flex-shrink-0">
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* Summary banner */}
      {showSummary && document.summary && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-violet-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{document.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="flex sm:hidden border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => setMobileTab("pdf")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors
            ${mobileTab === "pdf" ? "text-white border-b-2 border-violet-500" : "text-gray-500"}`}
        >
          PDF
        </button>
        <button
          onClick={() => setMobileTab("sidebar")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors
            ${mobileTab === "sidebar" ? "text-white border-b-2 border-violet-500" : "text-gray-500"}`}
        >
          Chat & Comments
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF area */}
        <div className={`flex-1 overflow-hidden ${mobileTab === "sidebar" ? "hidden sm:flex" : "flex"} flex-col`}>
          <PDFViewer url={document.storageUrl} />
        </div>

        {/* Right sidebar */}
        <div className={`w-full sm:w-80 lg:w-96 flex flex-col border-l border-gray-800 flex-shrink-0
          ${mobileTab === "pdf" ? "hidden sm:flex" : "flex"}`}>
          {/* Tabs */}
          <div className="flex border-b border-gray-800 flex-shrink-0">
            {(["chat", "comments"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
                  ${activeTab === tab
                    ? "text-white border-b-2 border-violet-500"
                    : "text-gray-500 hover:text-gray-300"
                  }`}
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
