import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function redact(message: string): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  let text = message.replace(/\b(Bearer|Key)\s+\S+/gi, "$1 [redacted]");
  if (token) text = text.split(token).join("[redacted]");
  return text;
}

function safeId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.slice(0, 80) || "user";
}

async function imageExtension(file: File): Promise<"jpg" | "png" | null> {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return null;
  const type = file.type.toLowerCase();
  const generic = type === "" || type === "application/octet-stream";
  const namedJpeg = type === "image/jpeg" || type === "image/jpg" || type === "image/pjpeg";
  const namedPng = type === "image/png";
  if (!generic && !namedJpeg && !namedPng) return null;

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
  if (jpeg && (generic || namedJpeg)) return "jpg";
  if (png && (generic || namedPng)) return "png";
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Use a JPG or PNG under 10 MB." }, { status: 400 });
  }

  const extension = await imageExtension(file);
  if (!extension) return NextResponse.json({ error: "Upload a JPG or PNG image." }, { status: 400 });

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "Image upload is not configured." }, { status: 503 });

  try {
    const blob = await put(`videos/${safeId(user.id)}/${randomUUID()}.${extension}`, file, {
      access: "public",
      token,
      contentType: extension === "png" ? "image/png" : "image/jpeg",
      addRandomSuffix: true,
    });
    const url = typeof blob.url === "string" ? blob.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) {
      console.error("Image upload failed: blob storage did not return a public URL.");
      return NextResponse.json({ error: "Could not store the image." }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`Image upload failed: ${redact(message)}`);
    return NextResponse.json({ error: "Could not store the image." }, { status: 500 });
  }
}
