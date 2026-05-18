import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

interface NewLaunch {
  id: string;
  title: string;
  emitter: string;
  securitizer: string;
  rate: string;
  indexer: string;
  maturityDate: string;
  guarantees: string;
  rating: string;
  source: string;
  sourceUrl: string;
  publishedDate: string;
  description: string;
}

// ─── RSS helpers (shared with gnews-emissions) ───────────────────────────────

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

function stripHtml(raw: string): string {
  return decodeHtmlEntities(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRSSItems(xml: string) {
  const items: Array<{ title: string; url: string; pubDate: string; source: string; description: string }> = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

  for (const item of itemMatches) {
    const rawTitle = decodeHtmlEntities(extractTag(item, 'title'));
    if (!rawTitle) continue;
    const descRaw = extractTag(item, 'description');
    const hrefMatch = descRaw.match(/href="([^"]+)"/i);
    const url = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : extractTag(item, 'link');
    const pubDate = extractTag(item, 'pubDate');
    const sourceTag = extractTag(item, 'source');
    const titleParts = rawTitle.split(' - ');
    const source = sourceTag || (titleParts.length > 1 ? titleParts[titleParts.length - 1] : 'Google News');
    const title = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : rawTitle;
    const plainDesc = stripHtml(descRaw).replace(source, '').trim();
    const description = (plainDesc.length > 20 ? plainDesc : title).substring(0, 200);

    items.push({ title, url, pubDate, source, description });
  }
  return items;
}

// ─── Fetch new launches via Google News RSS ───────────────────────────────────

let launchCache: NewLaunch[] = [];
let launchCacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 min

async function searchNewLaunches(): Promise<NewLaunch[]> {
  if (launchCache.length > 0 && Date.now() - launchCacheTime < CACHE_DURATION) {
    return launchCache;
  }

  const launches: NewLaunch[] = [];

  // Google News RSS - new CRI launches
  const queries = [
    'nova+emissão+CRI+securitizadora+2026',
    'CRI+aprovado+emissão+ANBIMA+CVM+2026',
  ];

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRIDashboard/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = parseRSSItems(xml);

      items.slice(0, 5).forEach((item, idx) => {
        const now = new Date();
        const rawDate = item.pubDate ? new Date(item.pubDate) : now;
        const safeDate = isNaN(rawDate.getTime()) || rawDate > now ? now : rawDate;
        launches.push({
          id: `launch-rss-${q.substring(0, 6)}-${idx}`,
          title: item.title,
          emitter: 'Ver matéria',
          securitizer: 'Ver matéria',
          rate: 'Ver matéria',
          indexer: 'N/A',
          maturityDate: 'N/A',
          guarantees: 'N/A',
          rating: 'N/A',
          source: item.source,
          sourceUrl: item.url,
          publishedDate: safeDate.toISOString(),
          description: item.description || item.title,
        });
      });
    } catch (e: any) {
      console.warn(`[New Launches] RSS query failed: ${e.message}`);
    }
  }

  // Also try SerpAPI / GNews if keys exist (better data quality)
  if (process.env.SERPAPI_API_KEY) {
    try {
      const serpUrl = `https://serpapi.com/search?engine=google&q=${encodeURIComponent('nova emissão CRI 2026 ANBIMA CVM')}&api_key=${process.env.SERPAPI_API_KEY}&num=5&gl=br`;
      const serpResponse = await fetch(serpUrl, { signal: AbortSignal.timeout(8000) });
      if (serpResponse.ok) {
        const data = await serpResponse.json();
        (data.organic_results || []).slice(0, 3).forEach((r: any, idx: number) => {
          launches.push({
            id: `launch-serp-${idx}`,
            title: r.title,
            emitter: 'Ver matéria',
            securitizer: 'Ver matéria',
            rate: 'Ver matéria',
            indexer: 'N/A',
            maturityDate: 'N/A',
            guarantees: 'N/A',
            rating: 'N/A',
            source: r.source || 'Google',
            sourceUrl: r.link,
            publishedDate: r.date || new Date().toLocaleDateString('pt-BR'),
            description: r.snippet || '',
          });
        });
      }
    } catch {}
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = launches.filter(l => {
    if (seen.has(l.title)) return false;
    seen.add(l.title);
    return true;
  });

  console.log(`[New Launches] ${unique.length} novos lançamentos encontrados`);
  if (unique.length > 0) { launchCache = unique; launchCacheTime = Date.now(); }
  return unique;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const newLaunchesRouter = router({
  search: publicProcedure.query(async () => {
    try {
      const launches = await searchNewLaunches();
      return { success: true, count: launches.length, launches };
    } catch (error) {
      console.error('[New Launches] Erro:', error);
      return { success: false, count: 0, launches: [] };
    }
  }),

  searchFiltered: publicProcedure
    .input(z.object({
      indexer: z.string().optional(),
      minRate: z.number().optional(),
      maxRate: z.number().optional()
    }).optional())
    .query(async ({ input }) => {
      try {
        const launches = await searchNewLaunches();
        let filtered = launches;
        if (input?.indexer) {
          filtered = filtered.filter(l => l.indexer.toLowerCase().includes(input.indexer!.toLowerCase()));
        }
        return { success: true, count: filtered.length, launches: filtered };
      } catch (error) {
        return { success: false, count: 0, launches: [] };
      }
    })
});
