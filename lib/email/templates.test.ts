import { describe, expect, it } from "vitest";
import { mergeTemplate } from "./templates";

describe("mergeTemplate", () => {
  it("uses the override when present", () => {
    expect(mergeTemplate({ type: "x", subject: "Override", intro: "Hi", updated_at: "", updated_by: null },
      { subject: "Default", intro: "def" })).toEqual({ subject: "Override", intro: "Hi" });
  });
  it("falls back when no row", () => {
    expect(mergeTemplate(null, { subject: "Default", intro: "def" })).toEqual({ subject: "Default", intro: "def" });
  });
});
