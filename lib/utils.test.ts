import { describe, expect, it } from "vitest";
import { formatClockTime, formatHours } from "./utils";

describe("formatClockTime", () => {
  it("formats morning times", () => {
    expect(formatClockTime("06:00")).toBe("6:00 AM");
    expect(formatClockTime("09:30")).toBe("9:30 AM");
  });
  it("formats afternoon/evening times", () => {
    expect(formatClockTime("13:05")).toBe("1:05 PM");
    expect(formatClockTime("22:00")).toBe("10:00 PM");
  });
  it("handles midnight and noon", () => {
    expect(formatClockTime("00:00")).toBe("12:00 AM");
    expect(formatClockTime("12:00")).toBe("12:00 PM");
  });
  it("tolerates HH:MM:SS input", () => {
    expect(formatClockTime("06:00:00")).toBe("6:00 AM");
  });
});

describe("formatHours", () => {
  it("renders a daily range", () => {
    expect(formatHours("06:00", "22:00")).toBe("Daily · 6:00 AM – 10:00 PM");
  });
});
