import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { baselineInfo, modelStatus, retrainSchedule, trainBaseline, type BaselineMetrics } from "@/lib/baseline";
import { getDb } from "@/lib/db";
import { translateError } from "@/lib/message-error";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One training run at a time; a second click while it runs waits for the same result.
const globalForTrain = globalThis as unknown as { __hoaxTraining?: Promise<BaselineMetrics> | null };

/**
 * Trains the baseline on the live database, in-process, and replaces the model
 * file. Takes a second or two on the real archive and blocks the event loop
 * meanwhile, which is acceptable for an admin action. Admins only.
 */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
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
    logAdmin(req, "model.train", `${metrics.docs} docs`, `accuracy ${metrics.accuracy}, macro-F1 ${metrics.macroF1}, ${metrics.trainMs} ms`);
    return NextResponse.json({ ok: true, metrics, status: modelStatus(), baseline: baselineInfo(), schedule: retrainSchedule(getDb()) });
  } catch (err) {
    console.error("[model] training failed:", err);
    return NextResponse.json({ error: err instanceof Error ? translateError(err, t) : t("Training failed.") }, { status: 500 });
  }
}
