"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="text-sm text-gray-400 min-w-[80px] text-center">
          {pageNumber} / {numPages || "—"}
        </span>
        <button
          onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          disabled={pageNumber >= numPages}
          className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
        >
          Next ›
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="btn-secondary py-1 px-2 text-xs"
        >
          −
        </button>
        <span className="text-xs text-gray-400 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          className="btn-secondary py-1 px-2 text-xs"
        >
          +
        </button>
      </div>

      {/* PDF area */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Loading PDF…</p>
            </div>
          }
          error={
            <div className="text-center p-8 text-red-400">
              <p className="font-medium">Failed to load PDF</p>
              <p className="text-sm text-red-400/70 mt-1">The file may be unavailable or corrupted.</p>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={Math.min(containerWidth, 900)}
            className="shadow-2xl shadow-black/50 rounded"
          />
        </Document>
      </div>
    </div>
  );
}
