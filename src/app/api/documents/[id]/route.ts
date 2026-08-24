import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/gemini";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const shareToken = req.nextUrl.searchParams.get("token");

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { name: true } },
      shareLinks: { where: { revoked: false } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Access control: must be owner OR have a valid non-revoked share token
  const isOwner = session?.user?.id === document.ownerId;
  const hasValidToken =
    shareToken &&
    document.shareLinks.some((l) => l.token === shareToken && !l.revoked);

  if (!isOwner && !hasValidToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Auto-retry summary if it previously failed but we have extracted text
  const summary = document.summary;
  if ((!summary || summary.startsWith("Summary generation failed")) && document.extractedText) {
    generateSummary(document.extractedText)
      .then((newSummary) => {
        prisma.document.update({
          where: { id: document.id },
          data: { summary: newSummary },
        }).catch(() => {});
      })
      .catch(() => {});
  }

  return NextResponse.json({
    document: {
      id: document.id,
      filename: document.filename,
      storageUrl: document.storageUrl,
      summary: summary,
      extractedText: document.extractedText,
      createdAt: document.createdAt,
      ownerName: document.owner.name,
    },
    isOwner,
  });
}
