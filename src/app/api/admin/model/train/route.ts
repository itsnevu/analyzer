import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { baselineInfo, modelStatus, trainBaseline, type BaselineMetrics } from "@/lib/baseline";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One training run at a time; a second click while it runs waits for the same result.
const globalForTrain = globalThis as unknown as { __hoaxTraining?: Promise<BaselineMetrics> | null };

/**
 * Trains the baseline on the live database, in-process, and replaces the model
 * file. Takes a second or two on the real archive and blocks the event loop
 * meanwhile, which is acceptable for an admin action. Admins only.
 */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!globalForTrain.__hoaxTraining) {
      globalForTrain.__hoaxTraining = new Promise<BaselineMetrics>((resolve, reject) => {
        // Let the response to any concurrent request start before the synchronous work.
        setImmediate(() => {
          try {
            resolve(trainBaseline(getDb()));
          } catch (err) {
            reject(err);
          }
        });
      }).finally(() => {
        globalForTrain.__hoaxTraining = null;
      });
    }
    const metrics = await globalForTrain.__hoaxTraining;
    return NextResponse.json({ ok: true, metrics, status: modelStatus(), baseline: baselineInfo() });
  } catch (err) {
    console.error("[model] training failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Training failed." }, { status: 500 });
  }
}
