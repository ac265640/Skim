import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin, BUCKET_NAME } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s timeout for large uploads

// pdf-parse text extraction
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require("pdf-parse");
    const data = await pdf(buffer);
    const rawText = data?.text || "";
    // Strip null bytes (\u0000) which PostgreSQL strictly rejects in UTF-8 text columns (Error 22021)
    return rawText.replace(/\0/g, "");
  } catch (err) {
    console.error("PDF parse error:", err);
    return "";
  }
}


// Upload helper with automatic retries for transient socket errors (ECONNRESET)
async function uploadToSupabaseWithRetry(storagePath: string, buffer: Buffer, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (!error && data) {
        return { data, error: null };
      }
      console.warn(`Supabase upload attempt ${i + 1} failed:`, error?.message || error);
    } catch (err) {
      console.warn(`Supabase upload attempt ${i + 1} exception:`, err);
    }
    if (i < retries - 1) {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  return { data: null, error: new Error("Failed to upload file to Supabase after 3 attempts.") };
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

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check PDF magic bytes (%PDF)
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    return NextResponse.json(
      { error: "Invalid PDF file" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${userId}/${timestamp}_${safeName}`;

  // 1. Upload file to Supabase Storage with retry
  const { error: uploadError } = await uploadToSupabaseWithRetry(storagePath, buffer);

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 }
    );
  }

  // Get the public/signed URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  const storageUrl = urlData?.publicUrl || storagePath;

  // 2. Extract text immediately (takes < 300ms) so text is ready right away
  const extractedText = await extractPdfText(buffer);

  // 3. Create document record with extracted text
  const document = await prisma.document.create({
    data: {
      ownerId: userId,
      filename: file.name,
      storageUrl,
      extractedText: extractedText || null,
      summary: null, // Null indicates summary is generating
    },
  });

  // 4. Generate summary in background (or update existing)
  if (extractedText) {
    generateSummary(extractedText)
      .then(async (summary) => {
        await prisma.document.update({
          where: { id: document.id },
          data: { summary },
        });
      })
      .catch(async (err) => {
        console.error("Background summary generation error:", err);
        await prisma.document.update({
          where: { id: document.id },
          data: { summary: "Summary generation failed. Click to retry." },
        }).catch(() => {});
      });
  } else {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        summary: "Automated text extraction was limited for this document (likely a scanned or image-only PDF).",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ document }, { status: 201 });
}
