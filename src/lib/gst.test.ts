import { describe, it, expect } from "vitest";
import { invoiceGst } from "./gst";
describe("invoiceGst", () => {
  it("includes GST: 100 -> 84.75 + 15.25", () => expect(invoiceGst(100, "inclusive")).toEqual({ base: 84.75, gst: 15.25, total: 100 }));
  it("no GST: final amount only", () => expect(invoiceGst(100, "none")).toEqual({ base: 100, gst: 0, total: 100 }));
  it("additional GST adds 18%", () => expect(invoiceGst(100, "additional")).toEqual({ base: 100, gst: 18, total: 118 }));
});
