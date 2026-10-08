/**
 * Request bodies read with a hard size cap. `req.json()` and `req.formData()`
 * buffer whatever arrives, and a chunked upload has no Content-Length to check
 * first, so a few large bodies could exhaust the server's memory. These read
 * the stream and stop at the cap. Server-only.
 */

export class BodyTooLarge extends Error {}

/** The body as bytes, refusing more than `maxBytes` (whether or not Content-Length was sent, or truthful). */
export async function readLimited(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** A JSON object body of at most `maxBytes`; anything that is not a JSON object becomes {}. */
export async function readJsonObject(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const bytes = await readLimited(req, maxBytes);
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A multipart form of at most `maxBytes`, parsed from the capped bytes. */
export async function readFormLimited(req: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readLimited(req, maxBytes);
  return new Response(bytes, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
}
