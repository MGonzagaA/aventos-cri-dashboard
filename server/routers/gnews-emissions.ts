import { publicProcedure, router } from "../_core/trpc";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

let newsCache: NewsArticle[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 min

// ─── RSS/XML parser ───────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRSS(xml: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

  for (const item of itemMatches) {
    const rawTitle = decodeHtmlEntities(extractTag(item, 'title'));
    if (!rawTitle) continue;

    // Google News embeds real URL inside description's href
    const descRaw = extractTag(item, 'description');
    const hrefMatch = descRaw.match(/href="([^"]+)"/i) || descRaw.match(/href='([^']+)'/i);
    const link = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : extractTag(item, 'link');
    if (!link) continue;

    const pubDate = extractTag(item, 'pubDate');
    const sourceTag = extractTag(item, 'source');

    // Google News appends "- Source Name" to title
    const titleParts = rawTitle.split(' - ');
    const source = sourceTag || (titleParts.length > 1 ? titleParts[titleParts.length - 1] : 'Google News');
    const title = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : rawTitle;

    const plainDesc = stripHtml(descRaw).replace(source, '').trim();
    const description = (plainDesc.length > 20 ? plainDesc : title).substring(0, 250);

    const now = new Date();
    const rawDate = pubDate ? new Date(pubDate) : now;
    const safeDate = isNaN(rawDate.getTime()) || rawDate > now ? now : rawDate;

    items.push({
      title,
      description,
      url: link,
      publishedAt: safeDate.toISOString(),
      source,
    });
  }

  return items;
}

// ─── Google News RSS queries ──────────────────────────────────────────────────

const RSS_QUERIES = [
  'CRI+"certificado+de+recebível+imobiliário"',
  'CRI+emissão+securitizadora+mercado+de+capitais',
  'CRI+inadimplência+OR+vencimento+OR+refinanciamento',
];

async function fetchGoogleNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();

  for (const q of RSS_QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRIDashboard/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[GoogleNews] HTTP ${res.status} para query "${q}"`);
        continue;
      }

      const xml = await res.text();
      const items = parseRSS(xml);

      for (const item of items) {
        if (!seen.has(item.title)) {
          seen.add(item.title);
          articles.push(item);
        }
      }
      console.log(`[GoogleNews] Query "${q}": ${items.length} artigos`);
    } catch (e: any) {
      console.warn(`[GoogleNews] Erro na query "${q}": ${e.message}`);
    }
  }

  // Sort by most recent
  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  console.log(`[GoogleNews] Total: ${articles.length} notícias únicas`);
  return articles.slice(0, 30);
}

// ─── Cache + fetch ────────────────────────────────────────────────────────────

async function getNews(forceRefresh = false): Promise<NewsArticle[]> {
  if (!forceRefresh && newsCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('[GoogleNews] Cache hit');
    return newsCache;
  }

  console.log('[GoogleNews] Buscando notícias de CRI...');
  const articles = await fetchGoogleNews();

  if (articles.length > 0) {
    newsCache = articles;
    cacheTimestamp = Date.now();
  } else if (newsCache.length > 0) {
    console.warn('[GoogleNews] Sem resultados, mantendo cache anterior');
  }

  return articles.length > 0 ? articles : newsCache;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const gnewsEmissionsRouter = router({
  get: publicProcedure.query(async () => {
    const articles = await getNews();
    const today = new Date();
    const todayStr = today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dayKey = today.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD para ID único
    return articles.map((a, idx) => ({
      id: `gnews-${idx}-${dayKey}`, // ID muda a cada novo dia (meia-noite BRT)
      title: a.title,
      summary: a.description,
      url: a.url,
      source: a.source,
      category: 'emissão',
      publishedDate: today,
      originalPublishedAt: a.publishedAt,
      date: todayStr, // sempre data de hoje em BRT
    }));
  }),

  refresh: publicProcedure.mutation(async () => {
    const articles = await getNews(true);
    return {
      count: articles.length,
      updatedAt: new Date().toISOString(),
    };
  }),
});
