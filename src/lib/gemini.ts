import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const SUMMARY_MODEL = "gemini-2.5-flash";
const CHAT_MODEL = "gemini-2.5-flash";

// ~15k tokens ≈ 60k characters at ~4 chars/token
const MAX_FULL_TEXT_CHARS = 60000;
const CHUNK_SIZE_CHARS = 12000;
const CHUNK_OVERLAP_CHARS = 500;

/**
 * Chunk text into overlapping windows for long document processing.
 */
export function chunkText(text: string): string[] {
  if (text.length <= MAX_FULL_TEXT_CHARS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE_CHARS));
    start += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

/**
 * Generate a structured AI summary for a PDF's extracted text.
 * Uses a carefully designed prompt that forces document-type identification
 * and surfaces the single most important fact — NOT a generic restatement.
 */
export async function generateSummary(extractedText: string): Promise<string> {
  if (!extractedText || extractedText.trim().length < 200) {
    return "Automated text extraction was limited for this document (likely a scanned or image-only PDF). The content cannot be summarized without OCR processing.";
  }

  // For very long docs, use a map-reduce strategy:
  // 1. Summarize each chunk individually
  // 2. Combine chunk summaries into a final summary
  let textToSummarize = extractedText;

  if (extractedText.length > MAX_FULL_TEXT_CHARS) {
    const chunks = chunkText(extractedText);
    const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });

    // Map: get a brief summary of each chunk
    const chunkSummaries = await Promise.all(
      chunks.map((chunk) =>
        model
          .generateContent(
            `Extract the 2-3 most important facts, obligations, dates, or numbers from this document excerpt:\n\n${chunk}`
          )
          .then((r) => r.response.text())
          .catch(() => "")
      )
    );

    // Reduce: use chunk summaries as input to final summarizer
    textToSummarize = chunkSummaries.filter(Boolean).join("\n\n---\n\n");
  }

  const model = genAI.getGenerativeModel({
    model: SUMMARY_MODEL,
    systemInstruction: `You are an expert document analyst. You will be given the raw extracted text of a PDF. Produce a summary that would let someone decide in 10 seconds whether they need to open the full document.

Rules:
- Write exactly 3 to 5 sentences, no more, no fewer
- Name the document type if inferable (e.g. "This is an employment contract between X and Y")
- Surface the single most important obligation, date, or number if the document contains one
- No generic filler like "This document discusses..." — lead with concrete content
- Do not speculate about anything not present in the text
- Be specific: use names, figures, and dates when available`,
  });

  const result = await model.generateContent(
    `Document text:\n\n${textToSummarize.slice(0, MAX_FULL_TEXT_CHARS)}`
  );
  return result.response.text().trim();
}

/**
 * Answer a user question about a PDF document.
 * Implements grounding: model is restricted to document context only.
 * For long docs: uses a two-step retrieval — first ask Gemini to pull relevant
 * passages, then answer using those passages.
 */
export async function chatWithDocument(
  extractedText: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: `You are answering questions about a specific document.
Only use information present in the document context below. If the answer is not in the document, say so explicitly: "I couldn't find that information in the document."
Keep answers concise and cite the relevant section or fact when possible.
Never fabricate information or draw on outside knowledge.`,
  });

  let documentContext = extractedText;

  // Long document strategy (Option A): if too long, do a lightweight retrieval pass first
  if (extractedText.length > MAX_FULL_TEXT_CHARS) {
    const chunks = chunkText(extractedText);
    const retrievalModel = genAI.getGenerativeModel({ model: CHAT_MODEL });

    // Ask Gemini to identify which chunks are relevant to the question
    const relevanceChecks = await Promise.all(
      chunks.map((chunk, i) =>
        retrievalModel
          .generateContent(
            `Question: "${question}"\n\nDocument excerpt ${i + 1}:\n${chunk}\n\nDoes this excerpt contain information relevant to answering the question? Reply with only "YES" or "NO".`
          )
          .then((r) => ({ chunk, relevant: r.response.text().trim().startsWith("YES") }))
          .catch(() => ({ chunk, relevant: false }))
      )
    );

    const relevantChunks = relevanceChecks
      .filter((c) => c.relevant)
      .map((c) => c.chunk);

    // Fall back to first 3 chunks if nothing marked relevant
    documentContext =
      relevantChunks.length > 0
        ? relevantChunks.slice(0, 4).join("\n\n---\n\n")
        : chunks.slice(0, 3).join("\n\n---\n\n");
  }

  // Build conversation history for multi-turn context (last 5 turns)
  const recentHistory = history.slice(-10); // 5 turns = 10 messages
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Document context:
${documentContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ""}
User: ${question}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Stream a chat response token-by-token using Gemini's streaming API.
 */
export async function streamChatWithDocument(
  extractedText: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  onChunk: (text: string) => void
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: `You are answering questions about a specific document.
Only use information present in the document context below. If the answer is not in the document, say so explicitly: "I couldn't find that information in the document."
Keep answers concise and cite the relevant section or fact when possible.
Never fabricate information or draw on outside knowledge.`,
  });

  let documentContext = extractedText;

  if (extractedText.length > MAX_FULL_TEXT_CHARS) {
    const chunks = chunkText(extractedText);
    const retrievalModel = genAI.getGenerativeModel({ model: CHAT_MODEL });

    const relevanceChecks = await Promise.all(
      chunks.map((chunk, i) =>
        retrievalModel
          .generateContent(
            `Question: "${question}"\n\nDocument excerpt ${i + 1}:\n${chunk}\n\nDoes this excerpt contain information relevant to answering the question? Reply with only "YES" or "NO".`
          )
          .then((r) => ({ chunk, relevant: r.response.text().trim().startsWith("YES") }))
          .catch(() => ({ chunk, relevant: false }))
      )
    );

    const relevantChunks = relevanceChecks.filter((c) => c.relevant).map((c) => c.chunk);
    documentContext =
      relevantChunks.length > 0
        ? relevantChunks.slice(0, 4).join("\n\n---\n\n")
        : chunks.slice(0, 3).join("\n\n---\n\n");
  }

  const recentHistory = history.slice(-10);
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Document context:
${documentContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ""}
User: ${question}`;

  const result = await model.generateContentStream(prompt);
  let fullText = "";

  for await (const chunk of result.stream) {
    const text = chunk.text();
    fullText += text;
    onChunk(text);
  }

  return fullText;
}
