// @ts-nocheck
/// <reference types="vitest" />

vi.mock("./helpers", () => {
  return {
    ent: vi.fn().mockReturnValue({ id: "X", name: "MockEntity", attributes: [] }),
    attr: vi.fn().mockReturnValue({ id: "A", name: "mock_attr" }),
    rel: vi.fn().mockReturnValue({ id: "R", from: "X", to: "X", type: "one-to-many" })
  };
});


import { ent, attr, rel } from "./helpers";

describe("mocking: vi.mock — полный мок helpers", () => {
  it("ent, attr, rel должны быть замоканы", () => {

    const e = ent("User");
    const a = attr("email");
    const r = rel(e, e, "one-to-many");

    expect(e.name).toBe("MockEntity");
    expect(a.name).toBe("mock_attr");
    expect(r.type).toBe("one-to-many");

  });
});
