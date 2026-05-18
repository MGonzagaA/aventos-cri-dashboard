import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

describe("indicators router", () => {
  let ctx: TrpcContext;

  beforeEach(() => {
    ctx = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  });

  it("should return indicators with correct structure", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.indicators.get();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verificar estrutura de cada indicador
    result.forEach((indicator) => {
      expect(indicator).toHaveProperty("id");
      expect(indicator).toHaveProperty("name");
      expect(indicator).toHaveProperty("value");
      expect(indicator).toHaveProperty("desc");
      expect(indicator).toHaveProperty("source");

      // Verificar tipos
      expect(typeof indicator.id).toBe("string");
      expect(typeof indicator.name).toBe("string");
      expect(typeof indicator.value).toBe("number");
      expect(typeof indicator.desc).toBe("string");
      expect(typeof indicator.source).toBe("string");
    });
  }, 20000);

  it("should have all required indicators (IPCA, CDI, IGP-M, Selic)", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.indicators.get();

    const names = result.map((ind) => ind.name);
    expect(names).toContain("IPCA");
    expect(names).toContain("CDI");
    expect(names).toContain("IGP-M");
    expect(names).toContain("Selic");
  }, 10000);

  it("should have valid numeric values for all indicators", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.indicators.get();

    result.forEach((indicator) => {
      expect(typeof indicator.value).toBe("number");
      expect(indicator.value).toBeGreaterThan(0);
      expect(indicator.value).toBeLessThan(100); // Reasonable range for rates
    });
  }, 30000);

  it("should include source information from BCB", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.indicators.get();

    result.forEach((indicator) => {
      expect(indicator.source).toBe("Banco Central do Brasil");
    });
  }, 30000);
});
