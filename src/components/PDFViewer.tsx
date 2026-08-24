"use client";

import { useState } from "react";

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--cream-dark)" }}>
      {/* PDF Controls Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background: "var(--cream)", borderBottom: "2px solid var(--cream-darker)" }}>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="btn-secondary py-1 px-2.5 text-xs font-bold"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-semibold min-w-[48px] text-center"
            style={{ color: "var(--ink)" }}>
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="btn-secondary py-1 px-2.5 text-xs font-bold"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom(100)}
            className="btn-secondary py-1 px-2 text-xs ml-1"
            title="Reset zoom"
            style={{ color: "var(--ink-muted)" }}
          >
            Reset
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="hidden sm:inline">Open in tab</span>
          </a>

          {/* Download */}
          <a
            href={url}
            download
            className="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>

      {/* PDF Viewport */}
      <div className="flex-1 overflow-auto p-2 sm:p-4 flex items-start justify-center"
        style={{ background: "var(--cream-dark)" }}>
        <div
          className="w-full h-full max-w-5xl transition-all duration-150 rounded-xl overflow-hidden shadow-lg"
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: "top center",
            border: "2.5px solid var(--cream-darker)",
            boxShadow: "6px 6px 0 var(--cream-darker)",
            background: "#fff",
          }}
        >
          <iframe
            src={`${url}#toolbar=1&navpanes=1`}
            title="PDF Document"
            className="w-full h-full border-0 min-h-[600px]"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}
