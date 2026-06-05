import { z } from "zod";
import { publicProcedure } from "../_core/trpc";
import { getRizaSecEmissoes, getCacheInfo } from "../services/rizasec-scraper";

export const rizasecRouter = {
  getEmissoes: publicProcedure
    .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const forceRefresh = input?.forceRefresh ?? false;
      const emissoes = await getRizaSecEmissoes(forceRefresh);
      const cacheInfo = getCacheInfo();
      return { emissoes, cacheInfo };
    }),
};
