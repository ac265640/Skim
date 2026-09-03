{/* Landing page (static, no auth required) */}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="gradient-bg min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center fade-in">
        {/* Logo */}
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "#1C1409", border: "2.5px solid #2E1F0A", boxShadow: "4px 4px 0 #2E1F0A" }}>
            <svg className="w-8 h-8" style={{ color: "#E8823A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-4xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "#1A1108" }}>
            Skim
          </span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Instrument Serif', serif", color: "#1A1108" }}>
          Your PDFs,{" "}
          <span style={{ color: "#E8823A", fontStyle: "italic" }}>intelligently.</span>
        </h1>

        <p className="text-lg mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: "#7A5C38" }}>
          Upload documents, get AI-powered summaries, ask questions in natural
          language, and collaborate with your team — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup" className="btn-primary text-base px-8 py-3">
            Get started free →
          </Link>
          <Link href="/login" className="btn-secondary text-base px-8 py-3">
            Sign in
          </Link>
        </div>

        {/* Feature pills */}
        <div className="mt-16 flex flex-wrap gap-3 justify-center">
          {[
            "🤖 AI Summaries",
            "💬 Chat with PDFs",
            "🔗 Shareable Links",
            "💭 Team Comments",
            "🔒 Secure Access Control",
            "⚡ Streaming Responses",
          ].map((f) => (
            <span
              key={f}
              className="text-sm px-4 py-1.5 rounded-full font-medium"
              style={{ background: "#fff", border: "2px solid #EDD5A9", color: "#7A5C38", boxShadow: "2px 2px 0 #EDD5A9" }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
