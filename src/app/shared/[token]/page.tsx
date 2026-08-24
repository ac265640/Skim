"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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

interface SharedDocument {
  id: string;
  filename: string;
  storageUrl: string;
  summary: string | null;
  createdAt: string;
  ownerName: string;
}

type SidebarTab = "chat" | "comments";

export default function SharedPage() {
  const params = useParams();
  const token = params.token as string;
  const [doc, setDoc] = useState<SharedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [showSummary, setShowSummary] = useState(false);
  const [mobileTab, setMobileTab] = useState<"pdf" | "sidebar">("pdf");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          setError("This link is invalid or has been revoked.");
          return;
        }
        const data = await res.json();
        setDoc(data.document);
      } catch {
        setError("Failed to load document.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-gray-950 gradient-bg flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-full bg-red-900/40 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Link Unavailable</h1>
        <p className="text-gray-400 text-center max-w-sm">
          {error || "This shared link is invalid or has expired."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Navbar */}
      <nav className="glass border-b border-gray-800/60 z-50 flex-shrink-0">
        <div className="h-14 px-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-white text-sm truncate">{doc.filename}</h1>
            <p className="text-xs text-gray-500">
              Shared by {doc.ownerName} · <span className="badge-violet text-xs">Invited View</span>
            </p>
          </div>

          <button
            onClick={() => setShowSummary(!showSummary)}
            className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 hidden sm:flex"
          >
            Summary
          </button>
        </div>
      </nav>

      {/* Summary banner */}
      {showSummary && doc.summary && (
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-gray-300 leading-relaxed">{doc.summary}</p>
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
        {/* PDF */}
        <div className={`flex-1 overflow-hidden ${mobileTab === "sidebar" ? "hidden sm:flex" : "flex"} flex-col`}>
          <PDFViewer url={doc.storageUrl} />
        </div>

        {/* Sidebar */}
        <div className={`w-full sm:w-80 lg:w-96 flex flex-col border-l border-gray-800 flex-shrink-0
          ${mobileTab === "pdf" ? "hidden sm:flex" : "flex"}`}>
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
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" ? (
              <ChatPanel documentId={doc.id} shareToken={token} />
            ) : (
              <CommentsPanel
                documentId={doc.id}
                shareToken={token}
                isOwner={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
