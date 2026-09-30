import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { MAX_UPLOAD_BYTES, saveArticleImage, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Article cover upload (multipart, field "file"). Returns { url } to put in the article's image field. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000) {
    return NextResponse.json({ error: "The image is larger than 5 MB." }, { status: 413 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file || typeof file === "string") return NextResponse.json({ error: "Choose an image to upload." }, { status: 422 });
  try {
    return NextResponse.json({ ok: true, url: await saveArticleImage(file) });
  } catch (err) {
    const message = err instanceof UploadError ? err.message : "The image could not be saved.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
