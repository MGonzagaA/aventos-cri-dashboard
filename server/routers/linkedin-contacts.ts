/**
 * LinkedIn CRI Search — Google Custom Search Engine (CSE)
 * ════════════════════════════════════════════════════════
 * Espelha a lógica do workflow n8n (aventos_cri_linkedin_workflow.json).
 *
 * Variáveis de ambiente necessárias (GOOGLE_CSE_KEY e GOOGLE_CSE_ID):
 *   GOOGLE_CSE_KEY  — API Key do Google Cloud (Custom Search API ativada)
 *   GOOGLE_CSE_ID   — ID do mecanismo de pesquisa (programmablesearchengine.google.com)
 *
 * Quota gratuita: 100 buscas/dia.
 * Este endpoint consome 9 buscas por execução (3 termos × 3 categorias).
 *
 * Setup: veja n8n/README_n8n.md para criar CSE ID e API Key (≈ 5 min).
 */
import { publicProcedure, router } from '../_core/trpc';
import { ENV } from '../_core/env';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinkedInCategory = 'posts' | 'perfis' | 'empresas';

export interface LinkedInResult {
  titulo:       string;
  url:          string;
  snippet:      string;
  displayLink:  string;
  posicao:      number;
  categoria:    LinkedInCategory;
  termoBuscado: string;
  slug:         string;
  dataBusca:    string;
}

// ─── Categorias → site: path (igual ao workflow n8n) ─────────────────────────

const CATEGORY_PATHS: Record<LinkedInCategory, string> = {
  posts:    'linkedin.com/posts',
  perfis:   'linkedin.com/in',
  empresas: 'linkedin.com/company',
};

export const DEFAULT_TERMS: string[] = [
  'CRI',
  'Certificado de Recebíveis Imobiliários',
  'securitização imobiliária',
];

// ─── Query builder (igual ao nó "Gerar Queries" do n8n) ──────────────────────

function buildQuery(term: string, category: LinkedInCategory): string {
  return `site:${CATEGORY_PATHS[category]} "${term}"`;
}

// ─── Slug extractor (igual ao "Parse Resultados" do n8n) ─────────────────────

function extractSlug(url: string, category: LinkedInCategory): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (category === 'perfis'   && parts.includes('in'))      return parts[parts.indexOf('in')      + 1] ?? '';
    if (category === 'empresas' && parts.includes('company')) return parts[parts.indexOf('company') + 1] ?? '';
    if (category === 'posts'    && parts.includes('posts'))   return parts[parts.indexOf('posts')   + 1] ?? '';
  } catch { /* ignore */ }
  return '';
}

// ─── Categoria detectada pela URL (fallback — igual ao n8n) ──────────────────

function detectCategory(url: string): LinkedInCategory {
  if (url.includes('/in/'))      return 'perfis';
  if (url.includes('/company/')) return 'empresas';
  return 'posts';
}

// ─── Google CSE API call (igual ao nó "Google CSE Search" do n8n) ────────────

interface CSEItem {
  title:       string;
  link:        string;
  snippet:     string;
  displayLink: string;
}

async function callGoogleCSE(
  query: string,
  apiKey: string,
  cseId: string,
  num = 10,
): Promise<CSEItem[]> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q',   query);
  url.searchParams.set('cx',  cseId);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('num', String(Math.min(num, 10))); // CSE free: máx 10
  url.searchParams.set('lr',  'lang_pt');
  url.searchParams.set('gl',  'br');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) throw new Error('Quota diária do Google CSE atingida (100 buscas/dia).');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google CSE HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.items ?? []) as CSEItem[];
}

// ─── Cache em memória (2 h — igual à TTL de cache do workflow) ───────────────

const CACHE_TTL = 2 * 60 * 60 * 1000;
const _cache = new Map<string, { results: LinkedInResult[]; ts: number }>();

function getCached(key: string): LinkedInResult[] | null {
  const e = _cache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL) return null;
  return e.results;
}

function setCached(key: string, results: LinkedInResult[]): void {
  _cache.set(key, { results, ts: Date.now() });
}

// ─── Delay entre buscas (workflow: batchInterval = 1500 ms) ──────────────────

const BATCH_DELAY_MS = 1_500;

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ─── Orquestração principal (espelha o fluxo completo do n8n) ────────────────

async function searchLinkedIn(
  terms: string[],
  categories: LinkedInCategory[],
  perQuery: number,
  apiKey: string,
  cseId: string,
): Promise<{ results: LinkedInResult[]; errors: string[] }> {
  const all: LinkedInResult[] = [];
  const seen = new Set<string>();     // dedup por URL (igual ao nó "Remover Duplicatas")
  const errors: string[] = [];

  for (const term of terms) {
    for (const cat of categories) {
      const cacheKey = `${term}::${cat}::${perQuery}`;
      const cached   = getCached(cacheKey);

      if (cached) {
        for (const r of cached) {
          if (!seen.has(r.url)) { seen.add(r.url); all.push(r); }
        }
        console.log(`[LinkedIn/CSE] Cache hit: "${cat}" / "${term}"`);
        continue;
      }

      const query = buildQuery(term, cat);
      console.log(`[LinkedIn/CSE] Buscando: ${query}`);

      let items: CSEItem[] = [];
      try {
        items = await callGoogleCSE(query, apiKey, cseId, perQuery);
        // Intervalo entre buscas (n8n: batchInterval 1500 ms)
        await sleep(BATCH_DELAY_MS);
      } catch (e: any) {
        console.warn(`[LinkedIn/CSE] Erro "${query}": ${e.message}`);
        errors.push(e.message);
        continue;
      }

      // Parse (igual ao nó "Parse Resultados" do n8n)
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const results: LinkedInResult[] = items
        .filter(r => r.link?.includes('linkedin.com'))
        .map((r, i) => ({
          titulo:       r.title       ?? '',
          url:          r.link        ?? '',
          snippet:      r.snippet     ?? '',
          displayLink:  r.displayLink ?? '',
          posicao:      i + 1,
          categoria:    cat,
          termoBuscado: term,
          slug:         extractSlug(r.link, cat) || extractSlug(r.link, detectCategory(r.link)),
          dataBusca:    now,
        }));

      setCached(cacheKey, results);
      console.log(`[LinkedIn/CSE] "${cat}" / "${term}": ${results.length} resultados`);

      for (const r of results) {
        if (!seen.has(r.url)) { seen.add(r.url); all.push(r); }
      }
    }
  }

  return { results: all, errors };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const linkedinContactsRouter = router({

  /**
   * Busca LinkedIn via Google CSE.
   * Mutation (disparo manual) para controlar o gasto de quota.
   */
  search: publicProcedure
    .input(z.object({
      terms:      z.array(z.string()).min(1).max(5).default(DEFAULT_TERMS),
      categories: z.array(z.enum(['posts', 'perfis', 'empresas'])).min(1)
                   .default(['posts', 'perfis', 'empresas']),
      perQuery:   z.number().min(1).max(10).default(10),
    }))
    .mutation(async ({ input }) => {
      const apiKey = ENV.googleCseKey;
      const cseId  = ENV.googleCseId;

      if (!apiKey || !cseId) {
        return {
          results:    [] as LinkedInResult[],
          total:      0,
          hasCseKey:  false,
          searchedAt: new Date().toISOString(),
          errors:     [],
          breakdown:  { posts: 0, perfis: 0, empresas: 0 },
        };
      }

      const { results, errors } = await searchLinkedIn(
        input.terms as string[],
        input.categories as LinkedInCategory[],
        input.perQuery,
        apiKey,
        cseId,
      );

      return {
        results,
        total:      results.length,
        hasCseKey:  true,
        searchedAt: new Date().toISOString(),
        errors,
        breakdown: {
          posts:    results.filter(r => r.categoria === 'posts').length,
          perfis:   results.filter(r => r.categoria === 'perfis').length,
          empresas: results.filter(r => r.categoria === 'empresas').length,
        },
      };
    }),

  clearCache: publicProcedure.mutation(() => {
    const count = _cache.size;
    _cache.clear();
    return { cleared: count };
  }),
});
