import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

describe("ANBIMA Data Router", () => {
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

  it("deve retornar array de CRIs da ANBIMA", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.anbima.get();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("cris");
    expect(Array.isArray(result.cris)).toBe(true);
    expect(result).toHaveProperty("source");
    expect(result.source).toBe("ANBIMA");
  }, 30000);

  it("deve conter estrutura correta de CRI", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.anbima.get();

    if (result.cris.length > 0) {
      const cri = result.cris[0];
      expect(cri).toHaveProperty("id");
      expect(cri).toHaveProperty("name");
      expect(cri).toHaveProperty("debtor");
      expect(cri).toHaveProperty("securitizer");
      expect(cri).toHaveProperty("rate");
      expect(cri).toHaveProperty("maturityDate");
      expect(cri).toHaveProperty("portfolio");
      expect(cri).toHaveProperty("riskLevel");
      expect(cri).toHaveProperty("source");
    }
  }, 30000);

  it("deve ter informações de cache", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.anbima.get();

    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("cached");
    expect(typeof result.cached).toBe("boolean");
  }, 30000);
});
