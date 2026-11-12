import { db } from "@/db";
import { assets } from "@/db/schema";
import { MAX_SIGN_UPLOAD_BYTES } from "@/lib/game/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasValidSignature(mime: string, bytes: Uint8Array): boolean {
  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === "image/webp") {
    return (
      bytes.length > 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

/** Accepts a real resized image upload and stores it durably in PostgreSQL. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "missing_file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return Response.json({ error: "unsupported_type" }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_SIGN_UPLOAD_BYTES) {
      return Response.json({ error: "file_too_large" }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(file.type, bytes)) {
      return Response.json({ error: "invalid_image" }, { status: 400 });
    }

    const inserted = await db
      .insert(assets)
      .values({ mime: file.type, data: Buffer.from(bytes).toString("base64"), bytes: file.size })
      .returning({ id: assets.id });

    return Response.json({ url: `/api/assets/${inserted[0].id}`, bytes: file.size }, { status: 201 });
  } catch (error) {
    console.error("[upload] failed", error);
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }
}
