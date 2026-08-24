"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  filename: string;
  storageUrl: string;
  summary: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const fetchDocuments = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents${q ? `?search=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      console.error("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const needsPolling = documents.some((d) => d.summary === null);
    if (!needsPolling) return;
    const interval = setInterval(() => fetchDocuments(search), 5000);
    return () => clearInterval(interval);
  }, [documents, search, fetchDocuments]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchDocuments(e.target.value);
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are accepted.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      setDocuments((prev) => [data.document, ...prev]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b"
        style={{ background: "rgba(253,244,231,0.93)", backdropFilter: "blur(12px)", borderColor: "var(--cream-darker)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#1C1409", border: "2px solid #2E1F0A" }}>
              <svg className="w-4 h-4" style={{ color: "#E8823A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>Skim</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block" style={{ color: "var(--ink-muted)" }}>
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>
              My Documents
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search */}
          <div className="relative sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--ink-muted)" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="search-input"
              type="text"
              className="input pl-9 py-2"
              placeholder="Search documents…"
              value={search}
              onChange={handleSearch}
            />
          </div>
        </div>

        {/* Upload zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center mb-8 transition-all duration-200 cursor-pointer`}
          style={{
            borderColor: dragOver ? "var(--orange)" : "var(--cream-darker)",
            background: dragOver ? "rgba(232,130,58,0.06)" : "#fff",
            boxShadow: dragOver ? "4px 4px 0 var(--orange-light)" : "4px 4px 0 var(--cream-darker)",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileInput}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
                style={{ borderColor: "var(--cream-darker)", borderTopColor: "var(--orange)" }} />
              <p style={{ color: "var(--ink-muted)" }}>Uploading and processing…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: "#FEF0E0", border: "2px solid var(--cream-darker)" }}>
                <svg className="w-7 h-7" style={{ color: "var(--orange)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: "var(--ink)" }}>Drop a PDF here, or click to browse</p>
              <p className="text-sm" style={{ color: "var(--ink-muted)" }}>PDF files only</p>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="mb-6 p-3 rounded-xl text-sm font-medium"
            style={{ background: "#fff0ea", border: "2px solid #f4b89a", color: "#b53b1a", boxShadow: "3px 3px 0 #f4b89a" }}>
            {uploadError}
          </div>
        )}

        {/* Documents grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer rounded-2xl h-52"
                style={{ border: "2.5px solid var(--cream-darker)" }} />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#fff", border: "2.5px solid var(--cream-darker)", boxShadow: "4px 4px 0 var(--cream-darker)" }}>
              <svg className="w-8 h-8" style={{ color: "var(--cream-darker)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--ink)", fontFamily: "'Instrument Serif', serif" }}>
              {search ? "No documents match your search" : "No documents yet"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
              {search ? "Try a different search term" : "Upload your first PDF to get started"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc) => (
              <div key={doc.id}
                className="group flex flex-col rounded-2xl p-5 transition-all duration-150 bg-white"
                style={{ border: "2.5px solid var(--cream-darker)", boxShadow: "5px 5px 0px var(--cream-darker)" }}>
                {/* File icon + name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#FEF0E0", border: "2px solid var(--cream-darker)" }}>
                    <svg className="w-5 h-5" style={{ color: "var(--orange)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight break-words line-clamp-2" style={{ color: "var(--ink)" }}>
                      {doc.filename}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>{formatDate(doc.createdAt)}</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex-1 mb-4">
                  {doc.summary === null ? (
                    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--orange)" }}>
                      <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--orange)" }} />
                      Generating AI summary…
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed line-clamp-4" style={{ color: "var(--ink-muted)" }}>
                      {doc.summary}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3"
                  style={{ borderTop: "2px solid var(--cream-dark)" }}>
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="btn-primary text-xs py-1.5 px-3 flex-1"
                  >
                    Open →
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="btn-danger"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
