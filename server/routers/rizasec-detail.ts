import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { publicProcedure } from "../_core/trpc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETAILS_PATH = path.join(__dirname, "..", "data", "rizaDetails.json");

let detailsCache: Record<string, any> | null = null;

function loadDetails(): Record<string, any> {
  if (detailsCache) return detailsCache;
  try {
    detailsCache = JSON.parse(fs.readFileSync(DETAILS_PATH, "utf-8"));
    return detailsCache!;
  } catch {
    return {};
  }
}

export const rizasecDetailRouter = {
  getDetail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const details = loadDetails();
      const det = details[input.id];
      if (!det) return null;
      return det as {
        emissao: number | string;
        dataEmissao: string;
        agenteFiduciario: string;
        tipoLastro: string;
        detalhamentoLastro: string;
        segmentoLastro: string;
        volumeTotal: number;
        rzaUrl: string;
        series: Array<{
          codigoIsin: string;
          codigoCetip: string;
          numeroSerie: number | string;
          tipoSerie: string;
          tipoOferta: string;
          taxa: string;
          status: string;
          volumeEmissao: number;
          dataVencimento: string;
          base: string;
          periodicidadeCorrecao: string;
          periodicidadePagamento: string;
          indexador: string;
        }>;
      };
    }),
};
