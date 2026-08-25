# Skim — PDF Intelligence & Collaboration System

> SpotDraft AI Intern Take-Home Assignment

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://skim-five.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat&logo=prisma)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=flat&logo=google)](https://deepmind.google/technologies/gemini)

**Live URL**: [https://skim-five.vercel.app](https://skim-five.vercel.app)<br>
**Video Walkthrough**: [https://www.loom.com/share/5a9d9d625c2545c0a138bf03590eb444](https://www.loom.com/share/5a9d9d625c2545c0a138bf03590eb444)
---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Getting Started (Local)](#getting-started-local)
- [Environment Variables](#environment-variables)
- [AI Design Decisions](#ai-design-decisions)
  - [Summary Prompt Design](#1-summary-prompt-design)
  - [Chat Grounding](#2-chat-grounding)
  - [Long Document Strategy](#3-long-document-strategy)
  - [Streaming Responses](#4-streaming-responses)
- [Security](#security)
- [Good-to-Haves: What Was Implemented vs. Skipped](#good-to-haves-what-was-implemented-vs-skipped)
- [Commit History](#commit-history)
- [Known Deviations from Spec](#known-deviations-from-spec)
- [Project Structure](#project-structure)

---

## Overview

**Skim** is a full-stack PDF intelligence and collaboration system. Users can upload PDF documents, receive instant AI-generated summaries, ask natural-language questions about their documents via a streaming AI chat interface, and share documents with others via tokenized links — all without requiring invited users to create accounts.

The application is built as a single deployable Next.js repository covering both frontend and backend API routes, deployed on Vercel with PostgreSQL (Supabase) and file storage (Supabase Storage).

---

## Features

### ✅ Must-Have Features (All Implemented)

| Feature | Description |
|---|---|
| **User Authentication** | Secure signup + login with email/password. Passwords bcrypt-hashed (12 rounds). Sessions managed via NextAuth.js JWT. |
| **PDF Upload & Validation** | MIME type check + `%PDF` magic byte validation. Files stored in Supabase Storage under a private per-user path. |
| **Dashboard** | Lists all uploaded PDFs with filename, upload date, and AI summary. Supports case-insensitive filename search. Live polling while summary generates. |
| **AI-Powered Summary** | Automatically generates a 3–5 sentence structured summary on upload, using a precision-engineered prompt. Map-reduce strategy for long documents. |
| **PDF Viewer** | Embedded native PDF viewer with zoom controls and open-in-tab capability. |
| **Shareable Links** | Owners generate unique UUID tokens that produce `/shared/[token]` URLs. No login required for invitees. Links can be revoked. |
| **Invited User Access** | Invited users access shared PDFs without an account. Server-side token validation on every request. |
| **Comments & Collaboration** | Owners and invited users can comment on documents. Threaded reply support. Guest name required for anonymous commenters. Live polling every 10 seconds. |
| **AI Chat (Conversational)** | Grounded AI chat interface supporting multi-turn conversation. Available to both owners and invited users. |
| **Streaming Chat Responses** | Chat answers stream token-by-token via Server-Sent Events (SSE). |

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Framework** | Next.js 14 (App Router) + TypeScript | Single deployable repo for frontend + API routes; zero-config Vercel deployment |
| **Styling** | Tailwind CSS | Rapid, utility-first responsive design |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` | Type-safe DB access; driver adapter required for Prisma 7 in serverless |
| **Database** | PostgreSQL via Supabase | Managed Postgres with built-in file storage, avoids wiring S3 separately |
| **Auth** | NextAuth.js (Credentials provider) | Industry-standard session management; bcrypt integration built-in |
| **File Storage** | Supabase Storage | Co-located with DB; signed URL support |
| **PDF Extraction** | `pdf-parse@1.1.1` | Stable CJS module for serverless-safe Node.js text extraction |
| **PDF Rendering** | Native `<iframe>` with zoom controls | Browser's built-in PDF renderer avoids `pdfjs-dist` canvas worker crash in Next.js 14 |
| **AI / LLM** | Google Gemini 2.5 Flash | See [Known Deviations](#known-deviations-from-spec) |
| **Deployment** | Vercel | Zero-config Next.js deployment with edge middleware support |

---

## Architecture

```
Browser
  │
  ├── Next.js Pages (App Router)
  │     ├── /                     → Landing page
  │     ├── /signup               → Registration form
  │     ├── /login                → Login form (NextAuth)
  │     ├── /dashboard            → Protected: document list + upload
  │     ├── /documents/[id]       → Protected: PDF viewer + Chat + Comments
  │     └── /shared/[token]       → Public: invited user PDF viewer
  │
  └── Next.js API Routes (/api)
        ├── /auth/signup          → POST: create user, bcrypt hash password
        ├── /auth/[...nextauth]   → NextAuth credentials provider
        ├── /documents            → GET: list, DELETE: remove
        ├── /documents/upload     → POST: upload PDF → extract text → async summarize
        ├── /documents/[id]       → GET: fetch single doc (with ownership check)
        ├── /share                → POST: generate token, GET/DELETE: manage
        ├── /share/[token]        → GET: resolve token → return document
        ├── /comments             → GET: list (tree), POST: create
        └── /chat                 → POST: stream SSE response

Background Processing (non-blocking):
  After upload returns 201, a background async chain runs:
    pdf-parse → extracted text → Gemini summary → DB update
  Dashboard polls /api/documents until summary appears.
```

---

## Data Model

```prisma
model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String                           // bcrypt 12 rounds, never returned to client
  createdAt    DateTime   @default(now())
  documents    Document[]
}

model Document {
  id            String       @id @default(cuid())
  ownerId       String
  filename      String
  storageUrl    String                           // Supabase Storage public URL
  extractedText String?      @db.Text           // null until background extraction completes
  summary       String?      @db.Text           // null until Gemini summary completes
  createdAt     DateTime     @default(now())
  shareLinks    ShareLink[]
  comments      Comment[]
  chatMessages  ChatMessage[]
}

model ShareLink {
  id         String   @id @default(cuid())
  documentId String
  token      String   @unique                   // Random UUID, used in /shared/[token]
  createdAt  DateTime @default(now())
  revoked    Boolean  @default(false)           // Revoke to cut off access
}

model Comment {
  id              String    @id @default(cuid())
  documentId      String
  authorName      String                         // Guest name if no account
  authorUserId    String?                        // null for invited/anonymous
  body            String    @db.Text
  parentCommentId String?                        // null for root comments; enables threading
  replies         Comment[] @relation("CommentReplies")
  createdAt       DateTime  @default(now())
}

model ChatMessage {
  id         String   @id @default(cuid())
  documentId String
  sessionId  String                              // Groups one conversation
  role       String                              // "user" | "assistant"
  content    String   @db.Text
  createdAt  DateTime @default(now())
}
```

---

## Getting Started (Local)

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is sufficient)
- A Google AI Studio API key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Clone

```bash
git clone https://github.com/ac265640/Skim.git
cd Skim
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env` (see [Environment Variables](#environment-variables) below).

### 3. Set up Supabase Storage

In your Supabase project dashboard:
- Go to **Storage** → Create bucket → name it **`pdfs`**
- Set it to **Public** (the app uses public URLs to serve PDFs to the browser)

### 4. Push database schema

```bash
npx prisma db push
npx prisma generate
```

> **Note**: The `DATABASE_URL` must point to your Supabase session pooler (port 5432), not the transaction pooler (port 6543), because Prisma migrations require session mode.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env` and populate all values:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Use the **session pooler** from Supabase → Settings → Database. Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| `NEXTAUTH_URL` | ✅ | Full URL of your app. `http://localhost:3000` locally; your Vercel URL in production |
| `NEXTAUTH_SECRET` | ✅ | Random secret for JWT signing. Generate with `openssl rand -base64 32` |
| `SUPABASE_URL` | ✅ | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key — used in client-side SDK |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key — **server-side only**, never expose to client. Used for admin storage operations |
| `GOOGLE_API_KEY` | ✅ | Google Gemini API key from [Google AI Studio](https://aistudio.google.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Same as `SUPABASE_URL` — exposes the project URL to the browser (not a secret) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same as `SUPABASE_ANON_KEY` — the anon key is safe to expose client-side |

> ⚠️ **`SUPABASE_SERVICE_KEY` and `GOOGLE_API_KEY` must never have a `NEXT_PUBLIC_` prefix**. They are server-only and must not appear in any client bundle.

---

## AI Design Decisions

This section covers the most important AI implementation choices in the project. These were treated as first-class engineering decisions, not afterthoughts.

### 1. Summary Prompt Design

The goal is to produce a summary useful enough that someone can decide **in 10 seconds** whether to open the full document — not a generic restatement.

**The system prompt is:**
```
You are an expert document analyst. You will be given the raw extracted
text of a PDF. Produce a summary that would let someone decide in 10 seconds
whether they need to open the full document.

Rules:
- Write exactly 3 to 5 sentences, no more, no fewer
- Name the document type if inferable (e.g. "This is an employment
  contract between X and Y")
- Surface the single most important obligation, date, or number if
  the document contains one
- No generic filler like "This document discusses..." — lead with
  concrete content
- Do not speculate about anything not present in the text
- Be specific: use names, figures, and dates when available
```

**Why this design:**
- **Sentence count is enforced** (3–5): prevents vague one-liners and forces the model to be precise
- **Document type identification**: helps the reader instantly categorize without reading
- **Surface the single most important fact**: an employment contract at $250/hr is immediately more useful than "a document about employment"
- **No filler language is explicitly banned**: reduces the hallucination-adjacent generic summaries LLMs default to without instruction
- **Non-speculation rule**: the model cannot invent information; if a fact isn't there, it must not surface it

**Edge case handling:**
- If extracted text is under 200 characters (likely a scanned/image-only PDF with no embedded text), a specific message is stored: *"Automated text extraction was limited for this document (likely a scanned or image-only PDF)."* — no silent failure.

---

### 2. Chat Grounding

The chat system prompt strictly constrains the model to the document:

```
You are answering questions about a specific document.
Only use information present in the document context below. If the answer
is not in the document, say so explicitly: "I couldn't find that information
in the document."
Keep answers concise and cite the relevant section or fact when possible.
Never fabricate information or draw on outside knowledge.
```

**Why this matters:** Without explicit grounding instructions, LLMs will freely draw on their training data to answer questions that look like they have obvious general answers. The explicit "say so explicitly" instruction forces the model to be honest about gaps rather than fabricating plausible-sounding answers.

**Multi-turn context:** The last 5 turns (10 messages: 5 user + 5 assistant) of `ChatMessage` history are prepended to every request, enabling natural follow-up questions without re-reading earlier exchanges.

---

### 3. Long Document Strategy

**Option A — Lightweight Retrieval (what was shipped):**

Threshold: `~15,000 tokens ≈ 60,000 characters` (assuming ~4 chars/token).

**For Summaries (Map-Reduce):**
1. Split text into overlapping 12,000-character chunks (500-character overlap to preserve context at boundaries)
2. Send each chunk to Gemini asking: *"Extract the 2–3 most important facts, obligations, dates, or numbers from this excerpt"*
3. Combine the extracted facts across all chunks into a single input
4. Pass the combined facts to the final summarizer with the full structured prompt

This ensures facts from page 47 aren't lost just because page 1 was all that fit in context.

**For Chat (Two-Step Retrieval):**
1. Split document into chunks
2. For each chunk, ask the model: *"Does this excerpt contain information relevant to answering this question? YES or NO"*
3. Take all chunks marked YES (up to 4); fall back to the first 3 chunks if none are marked relevant
4. Pass only the relevant chunks as context to the answer model

This is a lightweight retrieval step that avoids needing vector embeddings or a separate vector database, while still correctly handling documents that exceed the context window.

**Why Option A over Option B (embedding-based retrieval):**
- Zero additional API dependency or infrastructure (no vector DB needed)
- Sufficient for the assignment's evaluation criteria
- Faster to implement correctly — Option B can be added later with an embedding API call at upload time
- Option B is noted in the README as the natural next upgrade if time allowed

---

### 4. Streaming Responses

Chat answers are streamed token-by-token using Gemini's `generateContentStream` API delivered over Server-Sent Events (SSE).

The API route yields chunks in the format:
```
data: {"text":"Frank"}\n\n
data: {"text":" Rosen"}\n\n
data: {"done":true}\n\n
```

The ChatPanel client reads the stream incrementally with `ReadableStream.getReader()` and appends tokens to the rendered message as they arrive. This gives users instant visual feedback rather than waiting for the full response — which is particularly noticeable on long answers.

---

## Security

| Measure | Implementation |
|---|---|
| **Password hashing** | bcrypt with 12 rounds. Hash is stored in `passwordHash`, never returned in API responses or logged |
| **No secrets in client bundle** | `GOOGLE_API_KEY` and `SUPABASE_SERVICE_KEY` have no `NEXT_PUBLIC_` prefix — verified not present in any client-facing file |
| **`.env` never committed** | Gitignored. Verified via `git log -p | grep -i api_key` — only `.env.example` placeholder strings appear in git history |
| **Server-side access control** | Every API route that touches documents, comments, or chat validates either: (a) session ownership matches `document.ownerId`, or (b) a non-revoked `ShareLink.token` was provided in the request |
| **Share link revocation** | Setting `ShareLink.revoked = true` immediately denies all subsequent access; server checks on every request |
| **File path scoping** | PDFs are stored in Supabase Storage under `{userId}/{timestamp}_{filename}` — no cross-user path guessing possible |

---

## Good-to-Haves: What Was Implemented vs. Skipped

| Feature | Status | Notes |
|---|---|---|
| **Streaming AI chat responses** | ✅ Implemented | Token-by-token SSE streaming with `generateContentStream` |
| **Threaded comment replies** | ✅ Implemented | `parentCommentId` in schema and UI; replies nested under root comments |
| **Share link revocation** | ✅ Implemented | Owners can revoke; server-side check on every access |
| **Password reset** | ❌ Skipped | Lowest priority per the spec's own suggested order. Would require an email provider (e.g. Resend). Not worth the time investment given the 4-day deadline |
| **Email notification on share** | ❌ Skipped | Would require Resend or SendGrid integration. Skipped in favour of getting all must-haves to work reliably in production |
| **Semantic search** | ❌ Skipped | Would require storing embeddings at upload time and a vector similarity query at search time. The current filename search works well for the scope of this assignment; the architecture is ready to add an embedding column to `Document` if needed |

---

## Commit History

The project was built incrementally with 20 commits following conventional commit message format:

```
a79de17 test: add comprehensive end-to-end integration test suite (15/15 passing)
90e6def fix: resolve PDF viewer canvas worker and fix pdf-parse text extraction
e152659 feat: upgrade Gemini model to gemini-2.5-flash for summaries and chat
4de18f4 docs: write comprehensive README with setup, architecture, and AI design notes
f1edf4b feat: AI chat panel with SSE streaming, 5-turn context, and grounding
4695a16 feat: comments panel with threaded replies and guest support
51923fb feat: invited user shared document view without login
197a760 feat: shareable link generation, revocation, and token resolution
c6155ae feat: document viewer page with tabs and access control
aaea047 feat: PDF viewer component with react-pdf navigation and zoom
95fb773 feat: dashboard document list with search, delete, and status polling
86a4050 feat: PDF upload with magic byte validation and async AI summarization
4bdba70 feat: Google Gemini integration for summaries and chat
dee7123 feat: Supabase client and storage integration
4e3c1ae feat: auth-protected dashboard and route middleware
d530dfc feat: NextAuth credentials provider and JWT session handling
f800d48 feat: user signup API and bcrypt password hashing
63f44d9 chore: add Prisma schema and PostgreSQL configuration
ad2882d chore: initial Next.js + TypeScript + Tailwind scaffold and env setup
ebbe505 Initial commit from Create Next App
```

---

## Known Deviations from Spec

### LLM: Google Gemini instead of Anthropic Claude

The assignment spec recommends Anthropic Claude (`claude-sonnet-4-6`). This project uses **Google Gemini 2.5 Flash** instead.

**Reason**: The API key provided was a Google Gemini key. An Anthropic key was not available. The prompt design, grounding strategy, and long-document chunking are identical in structure to what the spec describes — the LLM provider is swapped but the AI engineering decisions are the same.

**Impact**: Gemini 2.5 Flash produces high-quality responses comparable to Claude Sonnet for document summarization and grounded Q&A. The `@google/generative-ai` SDK was used directly; swapping to `@anthropic-ai/sdk` with the same prompts would require only a thin adapter in `src/lib/gemini.ts`.

---

## Project Structure

```
skim/
├── prisma/
│   └── schema.prisma           # Full data model (User, Document, ShareLink, Comment, ChatMessage)
├── prisma.config.ts            # Prisma 7 config with datasource URL
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts   # NextAuth HTTP handlers
│   │   │   │   └── signup/route.ts          # POST: create user with bcrypt hash
│   │   │   ├── documents/
│   │   │   │   ├── route.ts                 # GET: list, DELETE: remove
│   │   │   │   ├── upload/route.ts          # POST: upload + async text extract + AI summary
│   │   │   │   └── [id]/route.ts            # GET: single document with access check
│   │   │   ├── share/
│   │   │   │   ├── route.ts                 # POST: generate token, DELETE: revoke
│   │   │   │   └── [token]/route.ts         # GET: resolve token to document
│   │   │   ├── comments/route.ts            # GET: threaded list, POST: create
│   │   │   └── chat/route.ts                # POST: SSE streaming grounded AI chat
│   │   ├── dashboard/page.tsx               # Protected: upload + document cards
│   │   ├── documents/[id]/page.tsx          # Protected: PDF viewer + sidebar tabs
│   │   ├── shared/[token]/page.tsx          # Public: invited user viewer
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── layout.tsx
│   │   └── providers.tsx                    # SessionProvider wrapper
│   ├── components/
│   │   ├── PDFViewer.tsx                    # Native iframe PDF renderer with zoom controls
│   │   ├── ChatPanel.tsx                    # SSE streaming chat UI with message history
│   │   └── CommentsPanel.tsx                # Threaded comments with guest name support
│   ├── lib/
│   │   ├── auth.ts                          # NextAuth authOptions (credentials + JWT callbacks)
│   │   ├── gemini.ts                        # AI: generateSummary, chatWithDocument, streamChatWithDocument
│   │   ├── prisma.ts                        # Prisma singleton with @prisma/adapter-pg
│   │   └── supabase.ts                      # Supabase admin + public clients
│   ├── middleware.ts                         # Protects /dashboard/* and /documents/*
│   └── types/
│       └── next-auth.d.ts                   # Session type augmentation (adds user.id)
├── scratch/
│   └── test_e2e.js                          # Automated E2E integration test suite (15/15 passing)
├── .env.example                             # Placeholder env template
├── .gitignore
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```
