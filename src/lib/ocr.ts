/**
 * Reads the text in a screenshot, in the browser. Nothing is uploaded: the
 * image stays on the device and only the extracted text is analyzed. The OCR
 * engine and the Indonesian + English language data are served by this site
 * from /ocr (see scripts/prepare-ocr.ts) and cached by the browser after the
 * first use. Client-only.
 */

export async function readImageText(image: Blob, onProgress?: (fraction: number, status: string) => void): Promise<string> {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker(["ind", "eng"], OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr/lang",
    workerBlobURL: false,
    logger: (m: { progress: number; status: string }) => onProgress?.(m.progress, m.status),
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    await worker.terminate();
  }
}

export function isImage(file: File | null | undefined): file is File {
  return !!file && /^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type);
}
