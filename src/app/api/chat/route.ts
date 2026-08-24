import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamChatWithDocument } from "@/lib/gemini";

// Helper: verify access (owner or valid share token)
async function verifyAccess(
  documentId: string,
  userId: string | undefined,
  shareToken: string | null
) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { shareLinks: { where: { revoked: false } } },
  });
  if (!doc) return null;
  const isOwner = userId === doc.ownerId;
  const hasToken = shareToken && doc.shareLinks.some((l) => l.token === shareToken);
  if (!isOwner && !hasToken) return null;
  return doc;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { documentId, question, sessionId, shareToken } = await req.json();

  if (!documentId || !question?.trim()) {
    return NextResponse.json({ error: "documentId and question required" }, { status: 400 });
  }

  const doc = await verifyAccess(documentId, session?.user?.id, shareToken || null);
  if (!doc) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!doc.extractedText) {
    return NextResponse.json(
      { error: "Document text not yet processed. Please wait a moment and try again." },
      { status: 422 }
    );
  }

  const chatSessionId = sessionId || `anon-${Date.now()}`;

  // Fetch last 5 turns (10 messages) of conversation history
  const recentMessages = await prisma.chatMessage.findMany({
    where: { documentId, sessionId: chatSessionId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = recentMessages
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Save user message
  await prisma.chatMessage.create({
    data: {
      documentId,
      sessionId: chatSessionId,
      role: "user",
      content: question.trim(),
    },
  });

  // Stream the response
  const encoder = new TextEncoder();
  let fullAnswer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamChatWithDocument(
          doc.extractedText!,
          question.trim(),
          history,
          (chunk) => {
            fullAnswer += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
        );

        // Save assistant message after streaming completes
        await prisma.chatMessage.create({
          data: {
            documentId,
            sessionId: chatSessionId,
            role: "assistant",
            content: fullAnswer,
          },
        });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, sessionId: chatSessionId })}\n\n`)
        );
        controller.close();
      } catch (error) {
        console.error("Chat streaming error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "An error occurred while generating a response" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// GET: fetch chat history for a session
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");
  const sessionId = searchParams.get("sessionId");
  const shareToken = searchParams.get("token");

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const doc = await verifyAccess(documentId, session?.user?.id, shareToken);
  if (!doc) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      documentId,
      ...(sessionId ? { sessionId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}
