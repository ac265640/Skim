// POST, GET, DELETE	---> Create/list/revoke share links

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// Generate a new share link
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await req.json();

  // Verify ownership
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ownerId: session.user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
// here it creates a prisma share link entry with a unique token and returns the share link and its URL
  const token = uuidv4();
  const shareLink = await prisma.shareLink.create({
    data: { documentId, token },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  //return base url + /shared/ + token
  const url = `${baseUrl}/shared/${token}`;

  return NextResponse.json({ shareLink, url });
}

// List share links for a document
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  // Verify ownership
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ownerId: session.user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const shareLinks = await prisma.shareLink.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return NextResponse.json({
    shareLinks: shareLinks.map((l) => ({
      ...l,
      url: `${baseUrl}/shared/${l.token}`,
    })),
  });
}

// Revoke a share link
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("id");

  if (!linkId) {
    return NextResponse.json({ error: "Share link ID required" }, { status: 400 });
  }

  const link = await prisma.shareLink.findFirst({
    where: { id: linkId },
    include: { document: { select: { ownerId: true } } },
  });

  if (!link || link.document.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.shareLink.update({
    where: { id: linkId },
    data: { revoked: true },
  });

  return NextResponse.json({ success: true });
}
