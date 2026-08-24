"use client";

import { useState, useEffect } from "react";
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{ borderColor: "var(--cream-darker)", borderTopColor: "var(--orange)" }} />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: "var(--cream)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "#fff0ea", border: "2.5px solid #f4b89a", boxShadow: "4px 4px 0 #f4b89a" }}>
          <svg className="w-7 h-7" style={{ color: "#b53b1a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>
          Link Unavailable
        </h1>
        <p className="text-center max-w-sm" style={{ color: "var(--ink-muted)" }}>
          {error || "This shared link is invalid or has expired."}
        </p>
        <Link href="/" className="btn-secondary text-sm">← Back to home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      {/* Navbar */}
      <nav className="z-50 flex-shrink-0 sticky top-0"
        style={{ background: "rgba(253,244,231,0.95)", backdropFilter: "blur(12px)", borderBottom: "2px solid var(--cream-darker)" }}>
        <div className="h-14 px-4 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "#1C1409", border: "2px solid #2E1F0A" }}>
              <svg className="w-3.5 h-3.5" style={{ color: "#E8823A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-base hidden sm:block"
              style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>Skim</span>
          </Link>

          <div className="w-px h-6 flex-shrink-0" style={{ background: "var(--cream-darker)" }} />

          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm truncate" style={{ color: "var(--ink)" }}>{doc.filename}</h1>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Shared by <span className="font-semibold">{doc.ownerName}</span>
              {" · "}
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: "#FEF0E0", color: "var(--orange-dark)", border: "1px solid var(--orange-light)" }}>
                Invited View
              </span>
            </p>
          </div>

          <button
            onClick={() => setShowSummary(!showSummary)}
            className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 hidden sm:flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Summary
          </button>
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
              {doc.summary ? (
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{doc.summary}</p>
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
        {/* PDF */}
        <div className={`flex-1 overflow-hidden ${mobileTab === "sidebar" ? "hidden sm:flex" : "flex"} flex-col`}
          style={{ background: "var(--cream-dark)" }}>
          <PDFViewer url={doc.storageUrl} />
        </div>

        {/* Sidebar */}
        <div className={`w-full sm:w-80 lg:w-96 flex flex-col flex-shrink-0
          ${mobileTab === "pdf" ? "hidden sm:flex" : "flex"}`}
          style={{ borderLeft: "2px solid var(--cream-darker)", background: "#fff" }}>
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
