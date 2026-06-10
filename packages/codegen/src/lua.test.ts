import { describe, expect, it } from "vitest";
import { toLua, toLuaModule } from "./lua.js";

describe("Lua emitter", () => {
  it("serializes scalars", () => {
    expect(toLua(null)).toBe("nil");
    expect(toLua(true)).toBe("true");
    expect(toLua(42)).toBe("42");
    expect(toLua(1.5)).toBe("1.5");
    expect(toLua('say "hi"\n')).toBe('"say \\"hi\\"\\n"');
  });

  it("serializes arrays and nested objects", () => {
    expect(toLua([1, 2, 3])).toBe("{\n  1,\n  2,\n  3,\n}");
    expect(toLua({ Imaj7: { VIm7: 325 } })).toBe(
      "{\n  Imaj7 = {\n    VIm7 = 325,\n  },\n}",
    );
  });

  it("brackets non-identifier and keyword keys", () => {
    expect(toLua({ "bIIIdim7": 1 })).toContain("bIIIdim7 = 1");
    expect(toLua({ "#Idim7": 1 })).toContain('["#Idim7"] = 1');
    expect(toLua({ end: 1 })).toContain('["end"] = 1');
  });

  it("rejects non-finite numbers", () => {
    expect(() => toLua(Infinity)).toThrow();
  });

  it("emits a module with provenance banner", () => {
    const mod = toLuaModule({ a: 1 }, "transitions.json");
    expect(mod).toMatch(/^-- Generated from transitions\.json/);
    expect(mod).toContain("return {");
  });
});
