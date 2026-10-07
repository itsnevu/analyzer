import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseModelResponse, pingModel, runDetection } from "@/lib/detect";

// No baseline model file here, whatever data/models holds: demo mode is the keyword heuristic.
process.env.BASELINE_MODEL_PATH = path.join(os.tmpdir(), "hoax-detect-test-no-model", "baseline.json");

describe("parseModelResponse", () => {
  it("accepts a response that follows the contract", () => {
    const r = parseModelResponse({ verdict: "HOAX", hoaxProbability: 0.91, confidence: 0.8, references: [{ title: "Ref", source: "X", url: "javascript:alert(1)" }] }, "id", 0.9);
    expect(r?.verdict).toBe("hoax");
    expect(r?.hoaxProbability).toBe(0.91);
    expect(r?.simulated).toBe(false);
    // Only http(s) links are passed on to the page.
    expect(r?.references[0].url).toBeUndefined();
  });

  it("scales a 0-100 probability", () => {
    expect(parseModelResponse({ verdict: "valid", hoaxProbability: 12 }, "en", 1)?.hoaxProbability).toBeCloseTo(0.12);
  });

  it.each([[{ verdict: "maybe", hoaxProbability: 0.5 }], [{ verdict: "hoax" }], [null], ["text"]])("rejects %j", (data) => {
    expect(parseModelResponse(data, "id", 1)).toBeNull();
  });
});

describe("runDetection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses demo mode when no model is configured", async () => {
    vi.stubEnv("RAG_FUSION_API_URL", "");
    const r = await runDetection("VIRAL!! SEBARKAN sebelum dihapus, dokter tidak mau kamu tahu rahasia ini!!!");
    expect(r.simulated).toBe(true);
    expect(r.fallbackReason).toBeUndefined();
    expect(r.verdict).toBe("hoax");
    expect(r.model).toBe("local-heuristic-stub");
  });

  it("uses the model's answer when it follows the contract", async () => {
    vi.stubEnv("RAG_FUSION_API_URL", "http://model.test/detect");
    vi.stubEnv("RAG_FUSION_API_KEY", "secret");
    const fetchMock = vi.fn(async () => Response.json({ verdict: "valid", hoaxProbability: 0.1, model: "test-model" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await runDetection("Menurut data resmi Kementerian Kesehatan, kasus menurun.");
    expect(r).toMatchObject({ verdict: "valid", model: "test-model", simulated: false });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it.each([
    ["an HTTP error", async () => new Response("boom", { status: 500 }), /HTTP 500/],
    ["an answer out of contract", async () => Response.json({ verdict: "unsure" }), /expected format/],
    ["a network failure", async () => { throw new TypeError("fetch failed"); }, /fetch failed/],
  ])("falls back to demo mode on %s", async (_name, impl, reason) => {
    vi.stubEnv("RAG_FUSION_API_URL", "http://model.test/detect");
    vi.stubGlobal("fetch", vi.fn(impl));
    const r = await runDetection("Pesan berantai tentang vaksin yang perlu dicek kebenarannya.");
    expect(r.simulated).toBe(true);
    expect(r.fallbackReason).toMatch(reason);
  });
});

describe("pingModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("says when nothing is configured", async () => {
    vi.stubEnv("RAG_FUSION_API_URL", "");
    expect(await pingModel()).toMatchObject({ reachable: false, contract: false, status: null });
  });

  it("reports a contract-following answer with its latency", async () => {
    vi.stubEnv("RAG_FUSION_API_URL", "http://model.test/detect");
    vi.stubEnv("RAG_FUSION_API_KEY", "secret");
    const fetchMock = vi.fn(async () => Response.json({ verdict: "hoax", hoaxProbability: 0.9, model: "m1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await pingModel();
    expect(r).toMatchObject({ reachable: true, status: 200, contract: true, model: "m1", verdict: "hoax", hoaxProbability: 0.9 });
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it.each([
    ["an HTTP error", async () => new Response("boom", { status: 503 }), { reachable: true, status: 503, contract: false }],
    ["an answer out of contract", async () => Response.json({ verdict: "unsure" }), { reachable: true, status: 200, contract: false }],
    ["a network failure", async () => { throw new TypeError("fetch failed"); }, { reachable: false, status: null, contract: false, error: "fetch failed" }],
  ])("reports %s", async (_name, impl, expected) => {
    vi.stubEnv("RAG_FUSION_API_URL", "http://model.test/detect");
    vi.stubGlobal("fetch", vi.fn(impl));
    expect(await pingModel()).toMatchObject(expected);
  });
});
