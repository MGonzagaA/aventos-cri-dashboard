import { chromium } from "playwright";

export interface RizaSecEmissao {
  codigo: string;
  nome: string;
  dataEmissao: string;
  dataVencimento: string;
  status: string;
  taxa: string;
  valorTotal: string;
  saldoDisponivel: string;
  classe: string;
  cnpjEmissor: string;
}

interface CacheEntry {
  data: RizaSecEmissao[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export function getCacheInfo() {
  if (!cache) return { cached: false, fetchedAt: null, count: 0 };
  return {
    cached: Date.now() - cache.fetchedAt < CACHE_TTL_MS,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    count: cache.data.length,
  };
}

export async function getRizaSecEmissoes(forceRefresh = false): Promise<RizaSecEmissao[]> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    console.log("[RizaSec] Retornando dados do cache");
    return cache.data;
  }

  const URL = "https://investidor.rizasec.com/emissoes";
  let browser;

  try {
    console.log("[RizaSec] Iniciando browser...");
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    let apiData: any[] | null = null;
    let capturedApiUrl = "";

    page.on("response", async (response) => {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (
        contentType.includes("application/json") &&
        (url.includes("/api/") ||
          url.includes("/emissoes") ||
          url.includes("/cri") ||
          url.includes("/products") ||
          url.includes("/investments") ||
          url.includes("/securities"))
      ) {
        try {
          const json = await response.json();
          const arr = Array.isArray(json)
            ? json
            : json.data || json.emissoes || json.results || json.items || [];

          if (Array.isArray(arr) && arr.length > 0 && !apiData) {
            console.log(`[RizaSec] API encontrada: ${url} — ${arr.length} registros`);
            apiData = arr;
            capturedApiUrl = url;
          }
        } catch {
          // não era JSON válido
        }
      }
    });

    console.log(`[RizaSec] Navegando para ${URL}...`);
    await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    let emissoes: RizaSecEmissao[] = [];

    if (apiData !== null) {
      console.log(`[RizaSec] Processando ${(apiData as any[]).length} registros da API: ${capturedApiUrl}`);
      emissoes = mapApiData(apiData);
    } else {
      console.log("[RizaSec] Nenhuma API JSON detectada. Tentando extração do DOM...");
      const domData = await page.evaluate(() => {
        const items: any[] = [];
        const rows = document.querySelectorAll("tr, [class*='emissao'], [class*='emission'], [class*='product-row'], [class*='card']");

        rows.forEach((row) => {
          const cells = row.querySelectorAll("td, [class*='cell'], [class*='column']");
          if (cells.length >= 3) {
            items.push({
              codigo: cells[0]?.textContent?.trim() || "",
              nome: cells[1]?.textContent?.trim() || "",
              dataVencimento: cells[2]?.textContent?.trim() || "",
              status: cells[3]?.textContent?.trim() || "",
              taxa: cells[4]?.textContent?.trim() || "",
            });
          }
        });

        // Tenta texto estruturado da página
        if (items.length === 0) {
          const title = document.title;
          const bodyText = document.body?.innerText?.slice(0, 500) || "";
          items.push({ codigo: "DOM", nome: `Página: ${title}`, dataVencimento: "", status: "", taxa: "", _raw: bodyText });
        }

        return items;
      });

      emissoes = domData.map((d: any) => ({
        codigo: String(d.codigo || ""),
        nome: String(d.nome || ""),
        dataEmissao: "",
        dataVencimento: String(d.dataVencimento || ""),
        status: String(d.status || ""),
        taxa: String(d.taxa || ""),
        valorTotal: "",
        saldoDisponivel: "",
        classe: "",
        cnpjEmissor: "",
      }));
    }

    cache = { data: emissoes, fetchedAt: Date.now() };
    console.log(`[RizaSec] ${emissoes.length} emissões capturadas e armazenadas em cache.`);
    return emissoes;
  } finally {
    if (browser) await browser.close();
  }
}

function mapApiData(dados: any[]): RizaSecEmissao[] {
  return dados.map((item: any) => ({
    codigo: String(item.codigo || item.id || item.code || item.isin || ""),
    nome: String(item.nome || item.name || item.title || item.descricao || item.description || ""),
    dataEmissao: String(item.dataEmissao || item.dataInicio || item.dataCriacao || item.issuance_date || item.start_date || ""),
    dataVencimento: String(item.dataVencimento || item.dataFim || item.vencimento || item.maturity_date || item.due_date || ""),
    status: String(item.status || item.situacao || item.state || ""),
    taxa: String(item.taxa || item.rentabilidade || item.juros || item.rate || item.yield || ""),
    valorTotal: String(item.valorTotal || item.valor || item.principal || item.total_value || item.amount || ""),
    saldoDisponivel: String(item.saldoDisponivel || item.saldo || item.disponivel || item.available || item.balance || ""),
    classe: String(item.classe || item.serie || item.tipo || item.class || item.type || ""),
    cnpjEmissor: String(item.cnpj || item.cnpjEmisor || item.cnpjEmissor || item.issuer_cnpj || ""),
  }));
}
