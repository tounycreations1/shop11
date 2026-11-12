import { eq } from "drizzle-orm";

import { db } from "@/db";
import { assets } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Streams uploaded shop-sign artwork with long-lived immutable caching. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new Response("Not found", { status: 404 });

  try {
    const rows = await db
      .select({ mime: assets.mime, data: assets.data })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);
    const asset = rows[0];
    if (!asset) return new Response("Not found", { status: 404 });

    const bytes = Buffer.from(asset.data, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": asset.mime,
        "content-length": String(bytes.byteLength),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[asset] failed", error);
    return new Response("Unavailable", { status: 500 });
  }
}
