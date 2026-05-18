import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';

export interface CRIData {
  id: string;
  name: string;
  debtor: string;
  status: 'active' | 'warning' | 'critical';
  code: string;
  rate: string;
  maturityDate: string;
  securitizer: string;
  securitizerId: string;
  downloadLink: string;
  linkType: 'direct' | 'portal';
  lastro: string;
  carteira: 'Portfólio Principal' | 'Centro-Oeste' | 'High Yield';
  cetipCode?: string;
  isin?: string;
}

export interface IndicatorData {
  id: string;
  name: string;
  value: string | number;
  trend?: string;
  positive?: boolean;
  desc?: string;
  source?: string;
  sourceUrl?: string;
}

export interface NewsItem {
  id: number | string;
  date?: string;
  publishedDate?: string | Date;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  displayDate?: string;
  displayTime?: string;
  timestamp?: number;
}

export interface DiscoveryItem {
  id: string;
  name: string;
}

export interface UseCRIDataResult {
  cris: CRIData[] | null;
  indicators: IndicatorData[] | null;
  news: NewsItem[] | null;
  discoveries: DiscoveryItem[] | null;
  loading: boolean;
  error: string | null;
}

const PORTFOLIO_MAP: Record<string, CRIData['carteira']> = {
  'high-yield': 'High Yield',
  'centro-oeste': 'Centro-Oeste',
  'portfolio-principal': 'Portfólio Principal',
};

const STATUS_MAP: Record<string, CRIData['status']> = {
  high: 'critical',
  medium: 'warning',
  low: 'active',
};

// Maps known securitizer names to IDs used in Home.tsx's securitizerDocLinks
const SECURITIZER_ID_MAP: Record<string, string> = {
  'OPEA Securitizadora': '1',
  'OPEA': '1',
  'Virgo': '2',
  'Virgo II': '2',
  'Virgo Securitizadora': '2',
  'Fortesec': '3',
  'True Securitizadora': '4',
  'True': '4',
  'Habitasec': '5',
  'Vórtx': '6',
  'Vortx': '6',
  'RB Capital': '7',
  'BRL Trust': '8',
  'Cibrasec': '9',
  'Riza': '10',
  'Gaia': '11',
  'Octante': '12',
  'iSec': '13',
  'Éxes Securitizadora': '14',
  'BARI Securitizadora': '15',
};

function mapAnbimaToCRIData(raw: any, idx: number): CRIData {
  const securitizerName: string = raw.securitizer || 'N/A';
  const securitizerId =
    SECURITIZER_ID_MAP[securitizerName] ||
    String(Object.keys(SECURITIZER_ID_MAP).length + idx + 1);

  const rawId = raw.id || `anbima-${idx}`;
  const code = rawId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase() || `ANBIMA${idx}`;

  return {
    id: rawId,
    name: raw.name || 'N/A',
    debtor: raw.debtor || 'N/A',
    status: STATUS_MAP[raw.riskLevel] ?? 'active',
    code,
    rate: raw.rate || 'N/A',
    maturityDate: raw.maturityDate || '31/12/2030',
    securitizer: securitizerName,
    securitizerId,
    downloadLink: raw.sourceUrl || '#',
    linkType: 'portal',
    lastro: raw.lastro || 'Ver documentação',
    carteira: PORTFOLIO_MAP[raw.portfolio] ?? 'Portfólio Principal',
    cetipCode: raw.cetipCode,
    isin: raw.isin,
  };
}

export const useCRIData = (): UseCRIDataResult => {
  const [indicators, setIndicators] = useState<IndicatorData[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: indicatorsData, isLoading: indLoading } = trpc.indicators.get.useQuery(undefined, {
    retry: 1,
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: 24 * 60 * 60 * 1000, // refresh indicators once a day
    refetchIntervalInBackground: false,
  });

  const { data: anbimaData, isLoading: anbimaLoading } = trpc.anbima.get.useQuery(undefined, {
    retry: 1,
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,      // refresh CRI list every 1h
    refetchIntervalInBackground: false,
  });

  const { data: gnewsData } = trpc.gnewsEmissions.get.useQuery(undefined, {
    retry: 1,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,      // refresh news every 15 min
    refetchIntervalInBackground: false,
  });

  const { data: googleSearchData } = trpc.googleSearch.searchCRI.useQuery(undefined, {
    retry: 1,
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const { data: launchesData } = trpc.newLaunches.search.useQuery(undefined, {
    retry: 1,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,      // refresh launches every 15 min
    refetchIntervalInBackground: false,
  });

  // Map ANBIMA CRIs to CRIData format
  const cris: CRIData[] | null = useMemo(() => {
    const rawCRIs = anbimaData?.cris;
    if (!Array.isArray(rawCRIs) || rawCRIs.length === 0) return null;
    return rawCRIs.map((raw: any, idx: number) => mapAnbimaToCRIData(raw, idx));
  }, [anbimaData]);

  useEffect(() => {
    try {
      const indicatorsArray = Array.isArray(indicatorsData) ? indicatorsData : [];
      if (indicatorsArray.length > 0) {
        setIndicators(indicatorsArray);
        setError(null);
      }

      const gnewsArray = Array.isArray(gnewsData) ? gnewsData : [];
      const googleArray = Array.isArray(googleSearchData) ? googleSearchData : [];
      const launchesArray = Array.isArray(launchesData?.launches) ? launchesData.launches : [];

      const launchesNews = launchesArray.map((launch: any) => ({
        id: launch.id,
        title: launch.title,
        summary: launch.description,
        source: launch.source,
        url: launch.sourceUrl,
        category: 'novo-lançamento',
        publishedDate: launch.publishedDate, // ISO string from server
        date: launch.publishedDate,
      }));

      const now = new Date();

      const allNews = [...gnewsArray, ...launchesNews, ...googleArray.slice(0, 3)]
        .map((item: any) => {
          // Accept ISO strings, Date objects, or Brazilian "DD/MM/YYYY" strings
          let pubDate: Date;
          const raw = item.publishedDate || item.date;
          if (!raw) {
            pubDate = now;
          } else if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
            // Brazilian format DD/MM/YYYY → parse manually
            const [d, m, y] = raw.split('/').map(Number);
            pubDate = new Date(y, m - 1, d);
          } else {
            pubDate = new Date(raw);
          }
          // Clamp future dates
          if (isNaN(pubDate.getTime()) || pubDate > now) pubDate = now;
          return {
            ...item,
            displayDate: pubDate.toLocaleDateString('pt-BR'),
            displayTime: pubDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: pubDate.getTime(),
          };
        })
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (allNews.length > 0) setNews(allNews as NewsItem[]);
    } catch (err: any) {
      console.error('Erro ao processar dados:', err);
    }
  }, [indicatorsData, gnewsData, googleSearchData, launchesData]);

  const loading = (indLoading || anbimaLoading) && !indicators && !cris;

  return {
    cris,
    indicators,
    news,
    discoveries: null,
    loading,
    error,
  };
};
