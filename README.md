# Skim — PDF Intelligence & Collaboration System

A full-stack web application for uploading PDFs, getting AI-powered summaries, chatting with documents in natural language, and collaborating via comments and shared links.

**Live URL**: _[Add after deployment]_

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| Auth | NextAuth.js (Credentials) + bcrypt |
| File Storage | Supabase Storage |
| PDF Extraction | `pdf-parse` (Node.js) |
| PDF Rendering | `react-pdf` (pdf.js) |
| AI / LLM | Google Gemini (`gemini-1.5-flash`) |
| Deployment | Vercel + Supabase |

---

## Getting Started (Local)

### 1. Clone and install

```bash
git clone https://github.com/ac265640/Skim.git
cd Skim
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (from Supabase → Settings → Database) |
| `NEXTAUTH_URL` | `http://localhost:3000` locally; your Vercel URL in prod |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only, never exposed to client) |
| `GOOGLE_API_KEY` | Google Gemini API key (from Google AI Studio) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` (for client-side SDK) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |

### 3. Set up Supabase Storage

In your Supabase project, go to **Storage** and create a bucket named **`pdfs`**. Set it as **public** (so signed URLs work) or configure RLS policies accordingly.

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## AI Design Decisions

### Summary Generation

The summary prompt is deliberately structured — not a generic "summarize this" instruction. Key design choices:

- **Exactly 3–5 sentences enforced**: Prevents vague summaries and forces precision.
- **Document-type identification**: The model names the type ("employment contract", "lease agreement") when inferable from context.
- **Surfaces the single most important fact**: Obligation, date, or number — not generic restatements.
- **No filler allowed**: "This document discusses..." is explicitly forbidden in the prompt.
- **Explicit non-speculation rule**: Model cannot infer things not present in the text.

**Long document strategy for summaries (map-reduce)**:  
If extracted text exceeds ~15,000 tokens (≈60,000 characters), the text is chunked into 12,000-character windows with 500-character overlaps. Each chunk is sent to Gemini to extract its 2–3 most important facts. The resulting fact extracts are then passed to the final summarizer as input. This avoids context window overflow while preserving the most important information across the full document.

### Chat Grounding

The chat system prompt explicitly restricts Gemini to answering **only from the document context**. If the answer isn't in the document, the model is instructed to say so explicitly — it cannot speculate or draw on outside knowledge. The last 5 turns (10 messages) of conversation history are included to support natural follow-up questions.

**Long document strategy for chat (Option A — lightweight retrieval)**:  
If the document is too long to pass in full (~15k token threshold), the text is chunked and each chunk is first evaluated for relevance to the user's question. Chunks marked as relevant are passed to the answer model. If no chunk is marked relevant, the first 3 chunks are used as a fallback. This is a lightweight two-step retrieval pattern that avoids needing vector embeddings while still handling long documents correctly.

**Streaming**: Chat responses are streamed token-by-token via Server-Sent Events (SSE) using Gemini's `generateContentStream` API, giving users instant feedback rather than waiting for the full response.

---

## Features Implemented

### Must-Haves ✅
- [x] User signup and authentication (NextAuth + bcrypt 12 rounds)
- [x] PDF upload with format validation (MIME type + magic bytes)
- [x] Supabase Storage (private bucket, scoped to userId)
- [x] Dashboard with filename search
- [x] AI-generated PDF summaries (Gemini, structured prompt, map-reduce for long docs)
- [x] PDF viewer (react-pdf with page navigation and zoom)
- [x] Shareable links (UUID tokens, no auth required for invitees)
- [x] Invited user access (server-side token validation)
- [x] Comments (owner + invited users, threaded replies)
- [x] AI chat (grounded, 5-turn context, chunked long docs, SSE streaming)
- [x] Security: no API keys in client bundle, bcrypt passwords, server-side access control on every route

### Good-to-Haves ✅
- [x] Streaming AI chat responses (token-by-token via SSE)
- [x] Threaded comment replies (parentCommentId in schema and UI)
- [ ] Email on share (skipped — Resend integration out of scope for timeline)
- [ ] Semantic search (skipped — would require embedding storage; TF-IDF fallback is Option A's job)
- [ ] Password reset (skipped — low priority per assignment guidance)

---

## Security Notes

- Passwords are bcrypt-hashed with 12 rounds, never logged or returned to clients
- `SUPABASE_SERVICE_KEY` and `GOOGLE_API_KEY` are server-side only; no `NEXT_PUBLIC_` prefix
- Every API route that touches documents, comments, or chat validates ownership or a valid non-revoked share token **server-side** — the UI cannot bypass these checks
- `.env` is gitignored; confirmed via `git log -p | grep -i api_key` style check before pushing

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/         # NextAuth + signup
│   │   ├── documents/    # CRUD + upload
│   │   ├── share/        # Share link CRUD + token resolver
│   │   ├── comments/     # Comments with access control
│   │   └── chat/         # Streaming AI chat
│   ├── dashboard/        # Protected dashboard
│   ├── documents/[id]/   # PDF viewer (owner)
│   ├── shared/[token]/   # PDF viewer (invited)
│   ├── login/
│   └── signup/
├── components/
│   ├── PDFViewer.tsx     # react-pdf with navigation + zoom
│   ├── ChatPanel.tsx     # SSE streaming chat UI
│   └── CommentsPanel.tsx # Threaded comments
├── lib/
│   ├── prisma.ts         # Prisma singleton
│   ├── supabase.ts       # Supabase clients (admin + public)
│   └── gemini.ts         # AI: summary + chat + chunking
└── types/
    └── next-auth.d.ts    # Session type augmentation
```
