import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Resolve a share token to a document
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const shareLink = await prisma.shareLink.findFirst({
    where: { token: params.token, revoked: false },
    include: {
      document: {
        include: { owner: { select: { name: true } } },
      },
    },
  });

  if (!shareLink) {
    return NextResponse.json(
      { error: "Invalid or revoked share link" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    document: {
      id: shareLink.document.id,
      filename: shareLink.document.filename,
      storageUrl: shareLink.document.storageUrl,
      summary: shareLink.document.summary,
      extractedText: shareLink.document.extractedText,
      createdAt: shareLink.document.createdAt,
      ownerName: shareLink.document.owner.name,
    },
    token: shareLink.token,
  });
}
