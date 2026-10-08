import { describe, expect, it } from "vitest";
import { GO_TARGETS, SHORTCUT_GROUPS, isTypingTarget, matchSequence } from "@/lib/shortcuts";

describe("matchSequence", () => {
  it("starts a sequence on g and completes it within the window", () => {
    const first = matchSequence(null, "g", 1000);
    expect(first).toEqual({ state: 1000, handled: true });
    const second = matchSequence(first.state, "a", 1800);
    expect(second).toEqual({ state: null, href: "/admin/articles", handled: true });
  });

  it("maps every documented target", () => {
    for (const [key, target] of Object.entries(GO_TARGETS)) {
      expect(matchSequence(0, key, 10).href).toBe(target.href);
    }
    expect(matchSequence(0, "d", 10).href).toBe("/admin");
    expect(matchSequence(0, "q", 10).href).toBe("/admin/review");
    expect(matchSequence(0, "l", 10).href).toBe("/admin/detect");
  });

  it("is case-insensitive", () => {
    expect(matchSequence(0, "R", 5).href).toBe("/admin/reports");
    expect(matchSequence(null, "G", 5).state).toBe(5);
  });

  it("expires after one second", () => {
    expect(matchSequence(1000, "a", 2000).href).toBe("/admin/articles");
    const late = matchSequence(1000, "a", 2001);
    expect(late).toEqual({ state: null, handled: false });
  });

  it("leaves keys outside a sequence alone", () => {
    expect(matchSequence(null, "d", 10)).toEqual({ state: null, handled: false });
    expect(matchSequence(null, "1", 10)).toEqual({ state: null, handled: false });
  });

  it("ends a sequence on an unknown key without handling it", () => {
    expect(matchSequence(0, "x", 100)).toEqual({ state: null, handled: false });
  });

  it("restarts the window on a second g", () => {
    expect(matchSequence(0, "g", 900)).toEqual({ state: 900, handled: true });
  });
});

describe("isTypingTarget", () => {
  it("treats text fields as typing", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not treat buttons, checkboxes or the page as typing", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("SHORTCUT_GROUPS", () => {
  it("lists every go-to target", () => {
    const go = SHORTCUT_GROUPS.find((g) => g.title === "Go to");
    expect(go?.items).toHaveLength(Object.keys(GO_TARGETS).length);
  });
});
