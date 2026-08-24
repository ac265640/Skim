"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // Auto-redirect to login after success
      router.push("/login?signup=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "#1C1409", border: "2px solid #2E1F0A", boxShadow: "3px 3px 0 #2E1F0A" }}>
              <svg className="w-5 h-5" style={{ color: "#E8823A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>Skim</span>
          </Link>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>Create your account</h1>
          <p className="mt-1" style={{ color: "var(--ink-muted)" }}>Start working with your PDFs intelligently</p>
        </div>

        <div className="card-light">
          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm font-medium"
              style={{ background: "#fff0ea", border: "2px solid #f4b89a", color: "#b53b1a", boxShadow: "3px 3px 0 #f4b89a" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              id="signup-submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account →"
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--ink-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--orange)" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
