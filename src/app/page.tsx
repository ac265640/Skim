import Link from "next/link";

export default function HomePage() {
  return (
    <main className="gradient-bg min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center fade-in">
        {/* Logo */}
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">Skim</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight">
          Your PDFs,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">
            intelligently
          </span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Upload documents, get AI-powered summaries, ask questions in natural
          language, and collaborate with your team — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup" className="btn-primary text-base px-8 py-3 shadow-lg shadow-violet-900/40">
            Get started free
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
            <span key={f} className="badge-violet text-sm px-3 py-1">
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
