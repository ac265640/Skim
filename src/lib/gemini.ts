import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Use gemini-3.6-flash — confirmed working with @google/generative-ai v0.24.x
const SUMMARY_MODEL = "gemini-3.6-flash";
const CHAT_MODEL = "gemini-3.6-flash";

// 200,000 characters ≈ 50,000 tokens — easily fits in Gemini 1.5's 1,000,000 token context window
const SINGLE_PASS_MAX_CHARS = 200000;

/**
 * Helper to call Gemini API with exponential backoff for rate limits (429 errors).
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 2500): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const errorString = String(err);
    const isRateLimit = errorString.includes("429") || errorString.includes("Quota") || errorString.includes("RESOURCE_EXHAUSTED");
    if (retries > 0 && isRateLimit) {
      console.warn(`Gemini rate limited (429). Retrying in ${delayMs}ms... (${retries} retries left)`);
      await new Promise((r) => setTimeout(r, delayMs));
      return callWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
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

  // Gemini 1.5 Flash has a 1,000,000 token context window.
  // We can safely process up to 200,000 characters (~50k tokens) in a single request.
  // If the document is even larger, we take a representative sample (beginning, middle, end)
  // to avoid sending dozens of parallel API calls that trigger rate limits.
  let textToSummarize = extractedText;

  if (extractedText.length > SINGLE_PASS_MAX_CHARS) {
    const start = extractedText.slice(0, 90000);
    const midPoint = Math.floor(extractedText.length / 2);
    const middle = extractedText.slice(midPoint - 30000, midPoint + 30000);
    const end = extractedText.slice(-40000);

    textToSummarize = `${start}\n\n[... Middle Excerpt ...]\n\n${middle}\n\n[... Final Excerpt ...]\n\n${end}`;
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

  return callWithRetry(async () => {
    const result = await model.generateContent(
      `Document text:\n\n${textToSummarize}`
    );
    return result.response.text().trim();
  });
}

/**
 * Answer a user question about a PDF document.
 * Implements grounding: model is restricted to document context only.
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

  if (extractedText.length > SINGLE_PASS_MAX_CHARS) {
    const start = extractedText.slice(0, 100000);
    const end = extractedText.slice(-100000);
    documentContext = `${start}\n\n[... Excerpt ...]\n\n${end}`;
  }

  const recentHistory = history.slice(-10);
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Document context:
${documentContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ""}
User: ${question}`;

  return callWithRetry(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  });
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

  if (extractedText.length > SINGLE_PASS_MAX_CHARS) {
    const start = extractedText.slice(0, 100000);
    const end = extractedText.slice(-100000);
    documentContext = `${start}\n\n[... Excerpt ...]\n\n${end}`;
  }

  const recentHistory = history.slice(-10);
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Document context:
${documentContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ""}
User: ${question}`;

  return callWithRetry(async () => {
    const result = await model.generateContentStream(prompt);
    let fullText = "";

    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      onChunk(text);
    }

    return fullText;
  });
}
