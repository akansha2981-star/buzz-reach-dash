import { describe, it, expect } from "vitest";
import { splitGst } from "./gst";

describe("splitGst", () => {
  it("breaks ₹30,000 inclusive into 18% GST", () => {
    expect(splitGst(30000, true)).toEqual({ base: 25423.73, gst: 4576.27, total: 30000 });
  });
  it("leaves non-GST amounts untouched", () => {
    expect(splitGst(30000, false)).toEqual({ base: 30000, gst: 0, total: 30000 });
  });
});