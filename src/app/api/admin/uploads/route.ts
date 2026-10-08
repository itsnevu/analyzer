import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { MAX_UPLOAD_BYTES, saveArticleImage, UploadError } from "@/lib/uploads";
import { translateError } from "@/lib/message-error";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Article cover upload (multipart, field "file"). Returns { url } to put in the article's image field. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000) {
    return NextResponse.json({ error: t("The image is larger than 5 MB.") }, { status: 413 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: t("The upload could not be read. Choose the image again.") }, { status: 400 });
  }
  if (!file || typeof file === "string") return NextResponse.json({ error: t("Choose an image to upload.") }, { status: 422 });
  try {
    return NextResponse.json({ ok: true, url: await saveArticleImage(file) });
  } catch (err) {
    const message = err instanceof UploadError ? translateError(err, t) : t("The image could not be saved. Try another image.");
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
