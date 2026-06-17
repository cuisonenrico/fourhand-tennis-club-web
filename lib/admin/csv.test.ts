import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("renders a header and rows, escaping quotes/commas", () => {
    const csv = toCsv([{ a: "x,y", b: 'q"z' }]);
    expect(csv).toBe('a,b\n"x,y","q""z"');
  });
  it("is just a header for no rows", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
  });
});
