import fs from "node:fs";
import { publicUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";

/** Serves uploaded article covers from data/uploads/public/. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const file = publicUploadPath((await params).name);
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": "image/webp",
      // File names are random and never reused, so the image can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
