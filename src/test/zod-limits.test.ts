import { describe, it, expect } from "vitest";
import { z } from "zod";

const attendees = z.array(z.string().email()).max(50);

describe("zod array limits", () => {
  it("accepts normal attendee lists", () => {
    expect(attendees.safeParse(["a@b.co", "c@d.co"]).success).toBe(true);
  });
  it("rejects oversized lists of invalid items", () => {
    const r = attendees.safeParse(Array.from({ length: 100000 }, () => "x"));
    expect(r.success).toBe(false);
  });
});
