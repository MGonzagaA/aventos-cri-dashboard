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
const CACHE_DURATION = 15 * 60 * 1000; // 15 min

// ─── Simple RSS/XML parser (no dependencies) ──────────────────────────────────

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
  // First decode encoded entities so &lt;a&gt; becomes <a>, then strip all tags
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

    // Google News RSS: real URL is inside description's href, not in <link>
    const descRaw = extractTag(item, 'description');
    const hrefMatch = descRaw.match(/href="([^"]+)"/i) || descRaw.match(/href='([^']+)'/i);
    const link = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : extractTag(item, 'link');

    const pubDate = extractTag(item, 'pubDate');
    const sourceTag = extractTag(item, 'source');

    // Strip "- Source Name" suffix appended by Google News
    const titleParts = rawTitle.split(' - ');
    const source = sourceTag || (titleParts.length > 1 ? titleParts[titleParts.length - 1] : 'Google News');
    const title = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : rawTitle;

    // Plain-text summary (Google News descriptions are just title + source links)
    const plainDesc = stripHtml(descRaw).replace(source, '').trim();
    const summary = (plainDesc.length > 20 ? plainDesc : title).substring(0, 200);

    // Clamp future dates to now (RSS sometimes has pre-scheduled dates)
    const now = new Date();
    const rawDate = pubDate ? new Date(pubDate) : now;
    const safeDate = isNaN(rawDate.getTime()) || rawDate > now ? now : rawDate;

    items.push({
      title,
      description: summary,
      url: link,
      publishedAt: safeDate.toISOString(),
      source,
    });
  }

  return items;
}

// ─── Google News RSS (free, no API key) ───────────────────────────────────────

const RSS_QUERIES = [
  'CRI+emissão+certificado+recebível+imobiliário',
  'securitizadora+CRI+novo+lançamento',
];

async function fetchGoogleNewsRSS(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();

  for (const q of RSS_QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRIDashboard/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = parseRSS(xml);

      for (const item of items) {
        if (!seen.has(item.title)) {
          seen.add(item.title);
          articles.push(item);
        }
      }
    } catch (e: any) {
      console.warn(`[GoogleRSS] Query "${q}" falhou: ${e.message}`);
    }
  }

  console.log(`[GoogleRSS] ${articles.length} notícias obtidas via RSS`);
  return articles.slice(0, 20);
}

// ─── GNews API (if key is available) ─────────────────────────────────────────

async function fetchFromGNews(): Promise<NewsArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  try {
    const query = 'CRI "certificado de recebível" emissão';
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=pt&sortby=publishedAt&max=10&apikey=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const data = await response.json();
    return (data.articles || []).map((a: any) => ({
      title: a.title,
      description: a.description || '',
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source?.name || 'GNews',
    }));
  } catch {
    return [];
  }
}

// ─── SerpAPI fallback (if key is available) ───────────────────────────────────

async function fetchFromSerpAPI(): Promise<NewsArticle[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent('CRI emissão certificado recebível imobiliário')}&hl=pt&gl=br&api_key=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const data = await response.json();
    return (data.news_results || []).slice(0, 10).map((r: any) => ({
      title: r.title,
      description: r.snippet || '',
      url: r.link,
      publishedAt: r.date || new Date().toISOString(),
      source: r.source?.name || 'Google News',
    }));
  } catch {
    return [];
  }
}

// ─── Main fetch with priority chain ──────────────────────────────────────────

async function fetchNews(): Promise<NewsArticle[]> {
  if (newsCache.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('[News Cache] Retornando dados em cache');
    return newsCache;
  }

  console.log('[News] Buscando notícias de CRI...');

  // 1. GNews API (key-gated, best quality)
  let articles = await fetchFromGNews();

  // 2. Google News RSS (free, always available)
  if (articles.length === 0) {
    console.log('[News] Tentando Google News RSS...');
    articles = await fetchGoogleNewsRSS();
  }

  // 3. SerpAPI (key-gated fallback)
  if (articles.length === 0) {
    console.log('[News] Tentando SerpAPI...');
    articles = await fetchFromSerpAPI();
  }

  if (articles.length > 0) {
    newsCache = articles;
    cacheTimestamp = Date.now();
  }

  console.log(`[News] Total: ${articles.length} notícias carregadas`);
  return articles;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const gnewsEmissionsRouter = router({
  get: publicProcedure.query(async () => {
    const articles = await fetchNews();

    return articles.map((article, idx) => ({
      id: `news-${idx}`,
      title: article.title,
      summary: article.description,
      url: article.url,
      source: article.source,
      category: 'emissão',
      publishedDate: new Date(article.publishedAt),
      date: new Date(article.publishedAt).toLocaleDateString('pt-BR'),
    }));
  }),
});
