import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper: verify the request has access to a document (owner or valid share token)
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
  const hasToken =
    shareToken && doc.shareLinks.some((l) => l.token === shareToken);

  if (!isOwner && !hasToken) return null;
  return doc;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");
  const shareToken = searchParams.get("token");

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const doc = await verifyAccess(documentId, session?.user?.id, shareToken);
  if (!doc) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { documentId, parentCommentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      replies: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  const { documentId, body: commentBody, authorName, shareToken, parentCommentId } = body;

  if (!documentId || !commentBody?.trim()) {
    return NextResponse.json({ error: "documentId and body required" }, { status: 400 });
  }

  const doc = await verifyAccess(documentId, session?.user?.id, shareToken || null);
  if (!doc) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Determine author name
  const finalAuthorName = session?.user?.name || authorName || "Anonymous";

  const comment = await prisma.comment.create({
    data: {
      documentId,
      authorName: finalAuthorName,
      authorUserId: session?.user?.id || null,
      body: commentBody.trim(),
      parentCommentId: parentCommentId || null,
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
