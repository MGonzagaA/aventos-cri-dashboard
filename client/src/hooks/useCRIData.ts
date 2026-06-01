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
  cidade?: string;
  estado?: string;
  regiao?: string;
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


export interface UseCRIDataResult {
  cris: CRIData[] | null;
  indicators: IndicatorData[] | null;
  news: NewsItem[] | null;
  loading: boolean;
  error: string | null;
  refetchNews: () => void;
  isFetchingNews: boolean;
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
    cidade: raw.cidade || '',
    estado: raw.estado || '',
    regiao: raw.regiao || '',
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
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const { data: gnewsData, refetch: refetchNews, isFetching: isFetchingNews } =
    trpc.gnewsEmissions.get.useQuery(undefined, {
      retry: 1,
      staleTime: 0,
      refetchInterval: 5 * 60 * 1000,
      refetchIntervalInBackground: true,
    });

  const cris: CRIData[] | null = useMemo(() => {
    const rawCRIs = anbimaData?.cris;
    if (!Array.isArray(rawCRIs) || rawCRIs.length === 0) return null;
    return rawCRIs.map((raw: any, idx: number) => mapAnbimaToCRIData(raw, idx));
  }, [anbimaData]);

  // Indicators: efeito separado para não bloquear notícias
  useEffect(() => {
    const indicatorsArray = Array.isArray(indicatorsData) ? indicatorsData : [];
    if (indicatorsArray.length > 0) {
      setIndicators(indicatorsArray);
      setError(null);
    }
  }, [indicatorsData]);

  // News: efeito independente, sempre usa a data de hoje na exibição
  useEffect(() => {
    try {
      const gnewsArray = Array.isArray(gnewsData) ? gnewsData : [];
      if (gnewsArray.length === 0) return;

      const today = new Date();
      const todayDisplay = today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const todayTime = today.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

      const allNews = gnewsArray.map((item: any) => ({
        ...item,
        displayDate: todayDisplay,
        displayTime: todayTime,
        timestamp: today.getTime(),
      }));

      setNews(allNews as NewsItem[]);
    } catch (err: any) {
      console.error('Erro ao processar notícias:', err);
    }
  }, [gnewsData]);

  const loading = (indLoading || anbimaLoading) && !indicators && !cris;

  return {
    cris,
    indicators,
    news,
    loading,
    error,
    refetchNews,
    isFetchingNews,
  };
};
