import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin, BUCKET_NAME } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/gemini";

// pdf-parse requires dynamic import for serverless compatibility
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParseModule = await import("pdf-parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (pdfParseModule as any).default || pdfParseModule;
  const data = await parse(buffer);
  return data?.text || "";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Strict PDF validation
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Check PDF magic bytes
  if (!buffer.slice(0, 4).equals(Buffer.from("%PDF"))) {
    return NextResponse.json(
      { error: "Invalid PDF file" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${userId}/${timestamp}_${safeName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }

  // Get the public/signed URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  const storageUrl = urlData?.publicUrl || storagePath;

  // Create document record (summary starts as null = "Summarizing...")
  const document = await prisma.document.create({
    data: {
      ownerId: userId,
      filename: file.name,
      storageUrl,
      extractedText: null,
      summary: null,
    },
  });

  // Background: extract text + generate summary (don't await — respond immediately)
  processDocument(document.id, buffer).catch((err) =>
    console.error("Background processing error:", err)
  );

  return NextResponse.json({ document }, { status: 201 });
}

async function processDocument(documentId: string, buffer: Buffer) {
  try {
    // Extract text
    const extractedText = await extractPdfText(buffer);

    // Generate summary
    const summary = await generateSummary(extractedText);

    // Update document record
    await prisma.document.update({
      where: { id: documentId },
      data: { extractedText, summary },
    });
  } catch (error) {
    console.error("Document processing error:", error);
    // Store a failure note so UI doesn't hang on "Summarizing..."
    await prisma.document.update({
      where: { id: documentId },
      data: {
        summary: "Summary generation failed. Please try re-uploading.",
        extractedText: "",
      },
    }).catch(() => {});
  }
}
