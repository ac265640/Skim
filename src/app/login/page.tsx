// Login form → calls next-auth signIn

"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react"; 
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const signupParam = searchParams.get("signup");
    const errParam = searchParams.get("error");

    if (signupParam === "1" && !errParam) {
      setSuccess("Account created! Sign in to get started.");
    }

    if (errParam) {
      setSuccess("");
      if (errParam === "CredentialsSignin" || errParam === "Configuration") {
        setError("Invalid email or password");
      } else {
        setError("Authentication failed. Please try again.");
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "CredentialsSignin" || result.error === "Configuration") {
        setError("Invalid email or password");
      } else {
        setError("Authentication failed. Please try again.");
      }
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="card-light">
      {success && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium"
          style={{ background: "#edfaf0", border: "2px solid #86efac", color: "#1a7a3a", boxShadow: "3px 3px 0 #86efac" }}>
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium"
          style={{ background: "#fff0ea", border: "2px solid #f4b89a", color: "#b53b1a", boxShadow: "3px 3px 0 #f4b89a" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          id="login-submit"
          disabled={loading}
          className="btn-primary w-full mt-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in →"
          )}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: "var(--ink-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold" style={{ color: "var(--orange)" }}>
          Sign up free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="gradient-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-in">
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
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Instrument Serif', serif", color: "var(--ink)" }}>Welcome back</h1>
          <p className="mt-1" style={{ color: "var(--ink-muted)" }}>Sign in to your account</p>
        </div>

        <Suspense fallback={<div className="shimmer rounded-2xl h-64" style={{ border: "2.5px solid var(--cream-darker)" }} />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
