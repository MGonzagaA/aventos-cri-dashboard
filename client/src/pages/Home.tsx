import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { GeminiChat } from '@/components/GeminiChat';
import { OpportunitiesAlert } from '@/components/OpportunitiesAlert';
import RefinancingAnalysis from '@/components/RefinancingAnalysis';
import LinkedInContacts from '@/components/LinkedInContacts';
import { CRIDetailModal } from '@/components/CRIDetailModal';
import {
  Download, Calendar, Code2, TrendingUp, Filter, ExternalLink, MapPin, AlertTriangle,
  Search, Info, FileText, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Building2, Shield, Briefcase, Bell, Newspaper, Clock, AlertCircle, ChevronRight,
  X, Calculator, Link2, FileCheck, ChevronDown, ChevronUp, DollarSign, Percent, Loader2, MessageCircle, Linkedin, RefreshCw
} from 'lucide-react';
import { useCRIData, CRIData, IndicatorData, NewsItem } from '@/hooks/useCRIData';
import { criDocuments as criDocumentsData, criCentroOeste as criCentroOesteData, criHighYield as criHighYieldData } from '@/data/criData';
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- RELÓGIO BRASÍLIA ---
function useBrasiliaTime() {
  const getBST = () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      dateShort: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    };
  };
  const [bst, setBst] = useState(getBST);
  useEffect(() => {
    const id = setInterval(() => setBst(getBST()), 1000);
    return () => clearInterval(id);
  }, []);
  return bst;
}

// --- DADOS ESTÁTICOS (FALLBACKS) ---
const securitizers = [
  { id: '1', name: 'OPEA Securitizadora' },
  { id: '2', name: 'Virgo' },
  { id: '3', name: 'Fortesec' },
  { id: '4', name: 'True Securitizadora' },
  { id: '5', name: 'Habitasec' }
];

const securitizerDocLinks: Record<string, { portal: string; documents: string; label: string }> = {
  '1': { portal: 'https://opea.com.br/pt/', documents: 'https://app.opea.com.br/pt/emissoes', label: 'OPEA - Portal de Emissões' },
  '2': { portal: 'https://virgo.inc/', documents: 'https://virgo.inc/investidores/', label: 'Virgo - Investidores' },
  '3': { portal: 'https://fortesec.com.br/', documents: 'https://fortesec.com.br/relacao-investidor/', label: 'Fortesec - Relação com Investidores' },
  '4': { portal: 'https://www.truesecuritizadora.com.br/', documents: 'https://data.anbima.com.br/busca/certificado-de-recebiveis?view=caracteristicas', label: 'True - ANBIMA Data (Documentos)' },
  '5': { portal: 'https://habitasec.com.br/', documents: 'https://www.vortx.com.br/investidor/dcm', label: 'Habitasec - Vórtx (Documentos)' }
};

const criSpecificDocs: Record<string, { url: string; label: string }> = {
  '1': { url: 'https://app.opea.com.br/pt/emissoes', label: 'Termo de Securitização - OPEA 182ª Série' },
  '2': { url: 'https://virgo.inc/investidores/', label: 'Documentos Virgo - 45ª Série' },
  'co1': { url: 'https://fortesec.com.br/relacao-investidor/', label: 'Fortesec - Agro 12ª Série' },
  'hy1': { url: 'https://www.vortx.com.br/investidor/dcm', label: 'Habitasec/Vórtx - Shopping X' },
};

// Importado de criData.ts com 39 CRIs completos
const criDocuments = criDocumentsData as CRIData[]; /*
  { id: '1', name: 'CRI 182ª Série - Gafisa', debtor: 'Gafisa S.A.', status: 'active', code: '21L0987654', rate: 'IPCA + 8.5%', maturityDate: '15/05/2026', securitizer: 'OPEA Securitizadora', securitizerId: '1', downloadLink: '#', linkType: 'direct', lastro: 'Alienação Fiduciária de Terrenos', carteira: 'Portfólio Principal' },
  { id: '2', name: 'CRI 45ª Série - Helbor', debtor: 'Helbor Empreendimentos', status: 'warning', code: '22A1234567', rate: 'CDI + 2.1%', maturityDate: '20/10/2026', securitizer: 'Virgo', securitizerId: '2', downloadLink: '#', linkType: 'portal', lastro: 'Recebíveis de Vendas de Unidades', carteira: 'Portfólio Principal' },
  { id: '3', name: 'CRI 92ª Série - Even', debtor: 'Even Construtora', status: 'active', code: '20K5544332', rate: 'IPCA + 7.2%', maturityDate: '12/12/2027', securitizer: 'True Securitizadora', securitizerId: '4', downloadLink: '#', linkType: 'direct', lastro: 'Hipoteca de Empreendimento', carteira: 'Portfólio Principal' },
  { id: '4', name: 'CRI 101ª Série - Cyrela', debtor: 'Cyrela Brazil Realty', status: 'active', code: '23J1122334', rate: 'IPCA + 6.8%', maturityDate: '10/01/2027', securitizer: 'OPEA Securitizadora', securitizerId: '1', downloadLink: '#', linkType: 'direct', lastro: 'Fluxo de Caixa de Projetos', carteira: 'Portfólio Principal' },
  { id: '5', name: 'CRI 55ª Série - MRV', debtor: 'MRV Engenharia', status: 'active', code: '22B9988771', rate: 'CDI + 1.8%', maturityDate: '22/03/2026', securitizer: 'Virgo', securitizerId: '2', downloadLink: '#', linkType: 'direct', lastro: 'Recebíveis MCMV', carteira: 'Portfólio Principal' }
]; */

// Importado de criData.ts com 12 CRIs Centro-Oeste
const criCentroOeste = criCentroOesteData as CRIData[]; /*
  { id: 'co1', name: 'CRI Agro 12ª - Fazenda Rio Doce', debtor: 'Produtor Rural ABC', status: 'active', code: '23F1122334', rate: 'CDI + 4.5%', maturityDate: '05/06/2026', securitizer: 'Fortesec', securitizerId: '3', downloadLink: '#', linkType: 'direct', lastro: 'Imóvel Rural MT', carteira: 'Centro-Oeste' },
  { id: 'co2', name: 'CRI Logística Goiânia', debtor: 'LogGyn Participações', status: 'active', code: '23G9988776', rate: 'IPCA + 9.0%', maturityDate: '18/09/2027', securitizer: 'OPEA Securitizadora', securitizerId: '1', downloadLink: '#', linkType: 'portal', lastro: 'Galpões Logísticos GO', carteira: 'Centro-Oeste' },
  { id: 'co3', name: 'CRI 44ª - Shopping Pantanal', debtor: 'Pantanal Invest', status: 'active', code: '22H1122551', rate: 'IPCA + 8.2%', maturityDate: '12/02/2026', securitizer: 'Virgo', securitizerId: '2', downloadLink: '#', linkType: 'direct', lastro: 'Recebíveis Aluguel MT', carteira: 'Centro-Oeste' }
]; */

// Importado de criData.ts com 12 CRIs High Yield
const criHighYield = criHighYieldData as CRIData[]; /*
  { id: 'hy1', name: 'CRI Estressado - Shopping X', debtor: 'Varejo Total S.A.', status: 'critical', code: '19H4455667', rate: 'IPCA + 14.5%', maturityDate: '30/01/2026', securitizer: 'Habitasec', securitizerId: '5', downloadLink: '#', linkType: 'portal', lastro: 'Recebíveis de Aluguel', carteira: 'High Yield' },
  { id: 'hy2', name: 'CRI Reestruturação Hotel', debtor: 'Hoteis Luxo LTDA', status: 'warning', code: '20J8877665', rate: 'CDI + 6.0%', maturityDate: '14/07/2027', securitizer: 'Virgo', securitizerId: '2', downloadLink: '#', linkType: 'direct', lastro: 'Hipoteca de Imóvel', carteira: 'High Yield' },
  { id: 'hy3', name: 'CRI Recovery - Varejo SP', debtor: 'Lojas de Rua S.A.', status: 'critical', code: '18K1122339', rate: 'IPCA + 18.0%', maturityDate: '05/02/2026', securitizer: 'True Securitizadora', securitizerId: '4', downloadLink: '#', linkType: 'portal', lastro: 'Direitos Creditórios', carteira: 'High Yield' }
]; */

const staticNewsData: NewsItem[] = [
  { id: 1, date: '12/02/2026', title: 'KNCR11 avalia R$ 1,3 bi em novas operações de CRI', summary: 'Fundo Kinea analisa novas operações com foco em CDI.', source: 'Suno', url: 'https://www.suno.com.br/', category: 'fundos' },
  { id: 2, date: '12/02/2026', title: 'CRI, CRA e debêntures incentivadas: novas regras', summary: 'Impactos no mercado em 2026.', source: 'InvestNews', url: 'https://investnews.com.br/', category: 'regulação' },
];

const staticMarketIndicators: IndicatorData[] = [
  { id: 'i1', name: 'IPCA', value: 4.44, trend: 'Acum. 12m', positive: false, desc: 'IBGE', sourceUrl: 'https://www.ibge.gov.br/explica/inflacao.php' },
  { id: 'i2', name: 'CDI', value: 14.90, trend: 'a.a.', positive: false, desc: 'B3', sourceUrl: 'https://www.bcb.gov.br/estabilidadefinanceira/taxasobrefundo' },
  { id: 'i3', name: 'IGP-M', value: 7.55, trend: 'Variação mensal', positive: true, desc: 'FGV', sourceUrl: 'https://portalibre.fgv.br/estudos-e-pesquisas/indices-de-precos/igp' },
  { id: 'i4', name: 'Selic', value: 14.25, trend: 'Meta a.a.', positive: true, desc: 'COPOM', sourceUrl: 'https://www.bcb.gov.br/controleinflacao/historicotaxasjuros' },
];

// --- UTILITÁRIOS ---
const getMaturityYear = (dateStr: string) => parseInt(dateStr.split('/')[2]);
const parseRate = (rate: string): number => { const m = rate.match(/([\d.]+)%/); return m ? parseFloat(m[1]) : 0; };
const parseDate = (dateStr: string): Date => { const [d, m, y] = dateStr.split('/').map(Number); return new Date(y, m - 1, d); };
const daysUntilMaturity = (dateStr: string): number => {
  const maturity = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};
const getIndexerFromRate = (rate: string): string => rate.includes('IPCA') ? 'IPCA' : rate.includes('IGP-M') ? 'IGP-M' : 'CDI';

const sortCRIsByDate = (docs: CRIData[]) => {
  return [...docs].sort((a, b) => parseDate(a.maturityDate).getTime() - parseDate(b.maturityDate).getTime());
};

const LOGO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663345654824/tfHANsPeaatfagmj.png';
const CHART_COLORS = ['#16A085', '#3691ED', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case 'fundos': return { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-400/30' };
    case 'regulação': return { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-400/30' };
    case 'rating': return { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-400/30' };
    case 'macro': return { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-400/30' };
    case 'emissão': return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-400/30' };
    case 'mercado': return { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-400/30' };
    default: return { bg: 'bg-white/10', text: 'text-white/70', border: 'border-white/20' };
  }
};

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading: authLoading, error: authError, isAuthenticated, logout } = useAuth();

  const { cris: criFromDB, indicators: indicatorsFromDB, news: newsFromDB, loading, error, refetchNews, isFetchingNews } = useCRIData();
  const brasiliaTime = useBrasiliaTime();
  
  const [mainView, setMainView] = useState<'dashboard' | 'reports' | 'market' | 'linkedin'>('dashboard');
  const [activeTab, setActiveTab] = useState<'portfolio' | 'high-yield'>('portfolio');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSecuritizer, setSelectedSecuritizer] = useState<string | null>(null);
  const [selectedIndexer, setSelectedIndexer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedCRI, setSelectedCRI] = useState<CRIData | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simCRI, setSimCRI] = useState<CRIData | null>(null);
  const [simNewSpread, setSimNewSpread] = useState('');
  const [simNewIndexer, setSimNewIndexer] = useState('CDI');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [detailCRI, setDetailCRI] = useState<CRIData | null>(null);
  const [selectedRegiao, setSelectedRegiao] = useState<string | null>(null);
  const [selectedUF, setSelectedUF] = useState<string | null>(null);

  // --- INTEGRAÇÃO DE DADOS ---
  const allCRIsData: CRIData[] = useMemo(() => {
    if (criFromDB && criFromDB.length > 0) return criFromDB;
    return [...criDocuments, ...criCentroOeste, ...criHighYield];
  }, [criFromDB]);

  const marketIndicators = useMemo(() => {
    if (!indicatorsFromDB || indicatorsFromDB.length === 0) return staticMarketIndicators;
    // Merge sourceUrl from static fallback so cards are always clickable
    return indicatorsFromDB.map(live => {
      const match = staticMarketIndicators.find(s => s.name === live.name);
      return match ? { ...live, sourceUrl: live.sourceUrl || match.sourceUrl } : live;
    });
  }, [indicatorsFromDB]);

  const MARKET_RATES = useMemo(() => {
    const rates: Record<string, number> = { IPCA: 4.44, CDI: 14.90, 'IGP-M': 7.55, Selic: 14.25 };
    marketIndicators.forEach(ind => {
      const val = typeof ind.value === 'string' ? parseFloat(ind.value.replace(',', '.')) : ind.value;
      if (!isNaN(val)) rates[ind.name] = val;
    });
    return rates;
  }, [marketIndicators]);

  const formattedNewsData = useMemo(() => {
    const sourceNews = (newsFromDB && newsFromDB.length > 0) ? newsFromDB : staticNewsData;
    return sourceNews.map((item, idx) => {
      let displayDate = item.date || '';
      if (item.publishedDate) {
        displayDate = new Date(item.publishedDate).toLocaleDateString('pt-BR');
      }
      return { ...item, displayDate, animationKey: `${item.id}-${idx}` };
    });
  }, [newsFromDB]);

  useEffect(() => { setCurrentPage(1); }, [activeTab, selectedYear, selectedSecuritizer, selectedIndexer, selectedRegiao, selectedUF, searchTerm]);

  // --- LÓGICA DE FILTRAGEM ---
  const filteredDocuments = useMemo(() => {
    let filtered = allCRIsData;

    const mapTabToCarteira = {
      'portfolio': 'Portfólio Principal',
      'centro-oeste': 'Centro-Oeste',
      'high-yield': 'High Yield'
    };
    filtered = filtered.filter(doc => doc.carteira === mapTabToCarteira[activeTab]);

    if (selectedYear) filtered = filtered.filter(doc => getMaturityYear(doc.maturityDate) === selectedYear);
    if (selectedSecuritizer) filtered = filtered.filter(doc => doc.securitizer === selectedSecuritizer);
    if (selectedIndexer) filtered = filtered.filter(doc => getIndexerFromRate(doc.rate) === selectedIndexer);
    if (selectedRegiao) filtered = filtered.filter(doc => doc.regiao === selectedRegiao);
    if (selectedUF) filtered = filtered.filter(doc => doc.estado === selectedUF);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(term) ||
        doc.debtor.toLowerCase().includes(term) ||
        doc.code.toLowerCase().includes(term)
      );
    }
    return sortCRIsByDate(filtered);
  }, [allCRIsData, activeTab, selectedYear, selectedSecuritizer, selectedIndexer, selectedRegiao, selectedUF, searchTerm]);

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE);
  const pagedDocuments = filteredDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const years = useMemo(() => {
    const set = new Set<number>();
    allCRIsData.forEach(c => {
      const y = getMaturityYear(c.maturityDate);
      if (y > 2000 && y < 2100) set.add(y);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [allCRIsData]);
  const totalCRIsGlobal = allCRIsData.length;
  const filteredCount = filteredDocuments.length;
  const docsInCurrentTab = allCRIsData.filter(d => 
    d.carteira === (activeTab === 'portfolio' ? 'Portfólio Principal' : 'High Yield')
  ).length;

  // --- LÓGICA DE RELATÓRIOS ---
  const statusData = useMemo(() => {
    const active = allCRIsData.filter(c => c.status === 'active').length;
    const warning = allCRIsData.filter(c => c.status === 'warning').length;
    const critical = allCRIsData.filter(c => c.status === 'critical').length;
    return [
      { name: 'Ativo', value: active, color: '#16A085' },
      { name: 'Atenção', value: warning, color: '#f59e0b' },
      { name: 'Crítico', value: critical, color: '#ef4444' },
    ];
  }, [allCRIsData]);

  const maturityData = useMemo(() => {
    const byYear: Record<string, { portfolio: number; centroOeste: number; highYield: number }> = {};
    allCRIsData.forEach(c => { 
      const y = getMaturityYear(c.maturityDate).toString(); 
      if (!byYear[y]) byYear[y] = { portfolio: 0, centroOeste: 0, highYield: 0 }; 
      if (c.carteira === 'Portfólio Principal') byYear[y].portfolio++;
      if (c.carteira === 'Centro-Oeste') byYear[y].centroOeste++;
      if (c.carteira === 'High Yield') byYear[y].highYield++;
    });
    return Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0])).map(([year, data]) => ({ year, 'Portfólio': data.portfolio, 'Centro-Oeste': data.centroOeste, 'High Yield': data.highYield }));
  }, [allCRIsData]);

  const securitizerData = useMemo(() => {
    const counts: Record<string, number> = {};
    allCRIsData.forEach(c => { counts[c.securitizer] = (counts[c.securitizer] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(' Securitizadora', ''), fullName: name, value }));
  }, [allCRIsData]);

  // Securitizadoras únicas derivadas dos dados reais, ordenadas por nome
  const securitizerOptions = useMemo(() => {
    const tabCRIs = allCRIsData.filter(c =>
      c.carteira === (activeTab === 'portfolio' ? 'Portfólio Principal' : 'High Yield')
    );
    const names = Array.from(new Set(tabCRIs.map(c => c.securitizer).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b, 'pt-BR')).map((name, i) => ({ id: String(i), name }));
  }, [allCRIsData, activeTab]);

  const regiaoOptions = useMemo(() => {
    const tabCRIs = allCRIsData.filter(c =>
      c.carteira === (activeTab === 'portfolio' ? 'Portfólio Principal' : 'High Yield')
    );
    const regioes = Array.from(new Set(tabCRIs.map(c => c.regiao).filter(Boolean))) as string[];
    const ORDER = ['Sudeste', 'Centro-Oeste', 'Sul', 'Nordeste', 'Norte'];
    return regioes.sort((a, b) => {
      const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [allCRIsData, activeTab]);

  const estadoOptions = useMemo(() => {
    const tabCRIs = allCRIsData.filter(c =>
      c.carteira === (activeTab === 'portfolio' ? 'Portfólio Principal' : 'High Yield')
    );
    const estados = Array.from(new Set(
      tabCRIs
        .filter(c => selectedRegiao ? c.regiao === selectedRegiao : true)
        .map(c => c.estado)
        .filter(Boolean)
    )) as string[];
    return estados.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allCRIsData, activeTab, selectedRegiao]);

  const rateByPortfolio = useMemo(() => {
    const getAvg = (carteira: string) => {
      const docs = allCRIsData.filter(d => d.carteira === carteira);
      return docs.length === 0 ? 0 : docs.reduce((sum, d) => sum + parseRate(d.rate), 0) / docs.length;
    };
    return [
      { name: 'Portfólio', taxa: parseFloat(getAvg('Portfólio Principal').toFixed(1)), fill: '#16A085' },
      { name: 'Centro-Oeste', taxa: parseFloat(getAvg('Centro-Oeste').toFixed(1)), fill: '#3691ED' },
      { name: 'High Yield', taxa: parseFloat(getAvg('High Yield').toFixed(1)), fill: '#f59e0b' },
    ];
  }, [allCRIsData]);

  const maturityAlerts = useMemo(() => {
    return allCRIsData
      .map(cri => ({ ...cri, daysLeft: daysUntilMaturity(cri.maturityDate) }))
      .filter(cri => cri.daysLeft >= -30 && cri.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [allCRIsData]);

  // --- ACTIONS & HANDLERS ---
  const handleDownload = useCallback((doc: CRIData) => {
    const secDocs = securitizerDocLinks[doc.securitizerId];
    const specificDoc = criSpecificDocs[doc.id];
    const content = `═══════════════════════════════════════════════════════════\n                  AVENTOS CORPORATE\n         Relatório de Certificado de Recebível Imobiliário\n═══════════════════════════════════════════════════════════\n\n  Ativo:            ${doc.name}\n  Devedor:          ${doc.debtor}\n  Código:           ${doc.code}\n  Status:           ${doc.status}\n  Carteira:         ${doc.carteira}\n\n───────────────────────────────────────────────────────────\n  DADOS FINANCEIROS\n───────────────────────────────────────────────────────────\n\n  Taxa:             ${doc.rate}\n  Vencimento:       ${doc.maturityDate}\n  Securitizadora:   ${doc.securitizer}\n\n───────────────────────────────────────────────────────────\n  GARANTIAS\n───────────────────────────────────────────────────────────\n\n  Lastro:           ${doc.lastro || 'Não informado'}\n\n───────────────────────────────────────────────────────────\n  LINKS E DOCUMENTOS\n───────────────────────────────────────────────────────────\n\n  Portal Securitizadora:  ${secDocs?.portal || 'N/A'}\n  Documentos:             ${secDocs?.documents || 'N/A'}\n${specificDoc ? `  Termo Específico:       ${specificDoc.url}\n` : ''}\n═══════════════════════════════════════════════════════════\n  Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n  © 2026 Aventos Corporate Base de dados\n═══════════════════════════════════════════════════════════`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CRI_${doc.code}_${doc.debtor.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportReport = useCallback((type: string) => {
    let csvContent = '';
    const header = 'Nome,Devedor,Código,Status,Taxa,Vencimento,Securitizadora,Lastro,Carteira\n';
    const formatRow = (doc: CRIData) => `"${doc.name}","${doc.debtor}","${doc.code}","${doc.status}","${doc.rate}","${doc.maturityDate}","${doc.securitizer}","${doc.lastro}","${doc.carteira}"\n`;
    
    if (type === 'status' || type === 'maturity') {
      csvContent = header;
      sortCRIsByDate([...allCRIsData]).forEach(d => csvContent += formatRow(d));
    } else if (type === 'rate') {
      csvContent = 'Carteira,Taxa Média Spread (%)\n';
      rateByPortfolio.forEach(r => csvContent += `"${r.name}",${r.taxa}\n`);
    } else if (type === 'securitizer') {
      csvContent = 'Securitizadora,Quantidade de CRIs\n';
      securitizerData.forEach(s => csvContent += `"${s.fullName}",${s.value}\n`);
    }
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Aventos_Relatorio_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [allCRIsData, rateByPortfolio, securitizerData]);

  const openSimulator = useCallback((doc: CRIData) => {
    setSimCRI(doc);
    setSimNewIndexer(getIndexerFromRate(doc.rate));
    setSimNewSpread('');
    setShowSimulator(true);
  }, []);

  const simulatorResults = useMemo(() => {
    if (!simCRI || !simNewSpread) return null;
    const currentSpread = parseRate(simCRI.rate);
    const currentIndexer = getIndexerFromRate(simCRI.rate);
    const currentBaseRate = MARKET_RATES[currentIndexer as keyof typeof MARKET_RATES] || 0;
    const currentTotalRate = currentBaseRate + currentSpread;
    
    const newSpread = parseFloat(simNewSpread);
    if (isNaN(newSpread)) return null;
    const newBaseRate = MARKET_RATES[simNewIndexer as keyof typeof MARKET_RATES] || 0;
    const newTotalRate = newBaseRate + newSpread;
    
    const savings = currentTotalRate - newTotalRate;
    const savingsPercent = currentTotalRate > 0 ? (savings / currentTotalRate) * 100 : 0;
    
    return {
      currentIndexer, currentSpread, currentBaseRate, currentTotalRate,
      newIndexer: simNewIndexer, newSpread, newBaseRate, newTotalRate,
      savings, savingsPercent, isPositive: savings > 0
    };
  }, [simCRI, simNewSpread, simNewIndexer, MARKET_RATES]);

  // --- UI COMPONENTS ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a1929] border border-white/15 rounded-lg p-3 shadow-xl">
          <p className="text-xs font-semibold text-white mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-xs" style={{ color: entry.color, fontFamily: "'Poppins', sans-serif" }}>{entry.name}: {entry.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getStatusColor = (status: string) => status === 'critical' ? 'bg-red-500/15 border-red-400/30 text-red-300' : status === 'warning' ? 'bg-amber-500/15 border-amber-400/30 text-amber-300' : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300';
  const getStatusLabel = (status: string) => status === 'critical' ? 'Crítico' : status === 'warning' ? 'Atenção' : 'Ativo';
  const getStatusDot = (status: string) => status === 'critical' ? 'bg-red-400' : status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';

  // Nunca bloquear renderização - dados estáticos sempre disponíveis
  // APIs carregam em background e atualizam quando prontas

  const renderDetailPanel = () => {
    if (!selectedCRI) return null;
    const doc = selectedCRI;
    const secDocs = securitizerDocLinks[doc.securitizerId];
    const specificDoc = criSpecificDocs[doc.id];
    const days = daysUntilMaturity(doc.maturityDate);

    return (
      <div className="fixed inset-0 z-[100] flex justify-end" onClick={() => setSelectedCRI(null)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div 
          className="relative w-full max-w-lg bg-[#071a33] border-l border-white/10 h-full overflow-y-auto custom-scrollbar animate-slideIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-[#071a33]/95 backdrop-blur-lg border-b border-white/8 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(doc.status)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(doc.status)}`}></span>
                {getStatusLabel(doc.status)}
              </span>
              <button onClick={() => setSelectedCRI(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-[#C4E9F9]/60" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Libre Baskerville', serif" }}>{doc.name}</h2>
            <p className="text-sm text-[#C4E9F9]/50 mt-1">{doc.debtor}</p>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/8 rounded-lg p-3">
                <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Código</p>
                <p className="text-sm font-mono text-[#C4E9F9]/90">{doc.code}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-lg p-3">
                <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Carteira</p>
                <p className="text-sm font-medium text-[#C4E9F9]/80">{doc.carteira}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-lg p-3">
                <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Taxa</p>
                <p className="text-sm font-semibold text-[#16A085]">{doc.rate}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-lg p-3">
                <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Vencimento</p>
                <p className="text-sm font-semibold text-[#3691ED]">{doc.maturityDate}</p>
              </div>
            </div>

            <div className={`rounded-lg p-4 border ${days < 0 ? 'bg-red-500/10 border-red-400/20' : days <= 30 ? 'bg-red-500/10 border-red-400/20' : days <= 90 ? 'bg-amber-500/10 border-amber-400/20' : 'bg-[#16A085]/10 border-[#16A085]/20'}`}>
              <div className="flex items-center gap-3">
                <Calendar className={`w-5 h-5 ${days < 0 ? 'text-red-400' : days <= 30 ? 'text-red-400' : days <= 90 ? 'text-amber-400' : 'text-[#16A085]'}`} />
                <div>
                  <p className="text-xs text-[#C4E9F9]/50 font-medium">Dias até o vencimento</p>
                  <p className={`text-xl font-bold ${days < 0 ? 'text-red-400' : days <= 30 ? 'text-red-400' : days <= 90 ? 'text-amber-400' : 'text-[#16A085]'}`} style={{ fontFamily: "'Libre Baskerville', serif" }}>
                    {days < 0 ? `${Math.abs(days)} dias vencido` : `${days} dias`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-widest" style={{ fontFamily: "'Poppins', sans-serif" }}>Informações Detalhadas</h3>
              <div className="bg-white/3 border border-white/6 rounded-lg divide-y divide-white/5">
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-[#C4E9F9]/40">Securitizadora</span>
                  <span className="text-xs font-medium text-white">{doc.securitizer}</span>
                </div>
                {(doc.cidade || doc.estado || doc.regiao) && (
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-xs text-[#C4E9F9]/40">Localização</span>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span className="text-xs font-medium text-white">
                        {[doc.cidade, doc.estado].filter(Boolean).join(' · ') || doc.regiao}
                      </span>
                      {doc.estado && doc.regiao && <span className="text-[10px] text-[#C4E9F9]/40">({doc.regiao})</span>}
                    </div>
                  </div>
                )}
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-[#C4E9F9]/40">Indexador</span>
                  <span className="text-xs font-medium text-[#16A085]">{getIndexerFromRate(doc.rate)}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-[#C4E9F9]/40">Spread</span>
                  <span className="text-xs font-medium text-white">{parseRate(doc.rate)}% a.a.</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-[#C4E9F9]/40">Taxa Base Atual ({getIndexerFromRate(doc.rate)})</span>
                  <span className="text-xs font-medium text-[#3691ED]">{MARKET_RATES[getIndexerFromRate(doc.rate) as keyof typeof MARKET_RATES]}% a.a.</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-xs text-[#C4E9F9]/40">Taxa Total Estimada</span>
                  <span className="text-xs font-bold text-amber-400">
                    {(MARKET_RATES[getIndexerFromRate(doc.rate) as keyof typeof MARKET_RATES] + parseRate(doc.rate)).toFixed(2)}% a.a.
                  </span>
                </div>
              </div>
            </div>

            {doc.lastro && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-widest" style={{ fontFamily: "'Poppins', sans-serif" }}>Garantias / Lastro</h3>
                <div className="bg-[#16A085]/10 border border-[#16A085]/20 rounded-lg p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-[#16A085] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#C4E9F9]/80 font-medium">{doc.lastro}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#C4E9F9]/50 uppercase tracking-widest" style={{ fontFamily: "'Poppins', sans-serif" }}>Documentos e Links</h3>
              <div className="space-y-2">
                {specificDoc && (
                  <a href={specificDoc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-[#16A085]/10 border border-[#16A085]/20 rounded-lg hover:bg-[#16A085]/15 transition-colors group">
                    <FileCheck className="w-5 h-5 text-[#16A085] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#16A085] group-hover:text-[#1abc9c] transition-colors">Termo de Securitização</p>
                      <p className="text-[10px] text-[#C4E9F9]/40 truncate mt-0.5">{specificDoc.label}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#16A085]/50 group-hover:text-[#16A085] transition-colors shrink-0" />
                  </a>
                )}
                {secDocs && (
                  <>
                    <a href={secDocs.documents} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/3 border border-white/8 rounded-lg hover:bg-white/6 transition-colors group">
                      <FileText className="w-5 h-5 text-[#3691ED] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white group-hover:text-[#3691ED] transition-colors">Página de Documentos</p>
                        <p className="text-[10px] text-[#C4E9F9]/40 truncate mt-0.5">{secDocs.label}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#C4E9F9]/20 group-hover:text-[#3691ED] transition-colors shrink-0" />
                    </a>
                    <a href={secDocs.portal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/3 border border-white/8 rounded-lg hover:bg-white/6 transition-colors group">
                      <Link2 className="w-5 h-5 text-[#C4E9F9]/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white group-hover:text-[#3691ED] transition-colors">Portal da Securitizadora</p>
                        <p className="text-[10px] text-[#C4E9F9]/40 truncate mt-0.5">{secDocs.portal}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#C4E9F9]/20 group-hover:text-[#3691ED] transition-colors shrink-0" />
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button onClick={() => handleDownload(doc)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-[#16A085] hover:bg-[#1abc9c] text-white transition-all">
                <Download className="w-4 h-4" /> Download Relatório
              </button>
              <button onClick={() => { setSelectedCRI(null); openSimulator(doc); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border border-[#3691ED]/30 bg-[#3691ED]/10 hover:bg-[#3691ED]/20 text-[#3691ED] transition-all">
                <Calculator className="w-4 h-4" /> Simular Refinanciamento
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSimulatorModal = () => {
    if (!showSimulator || !simCRI) return null;
    const doc = simCRI;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowSimulator(false)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-2xl bg-[#071a33] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white/5 border-b border-white/8 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3691ED]/15 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-[#3691ED]" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>Simulador de Refinanciamento</h3>
                <p className="text-[11px] text-[#C4E9F9]/40 mt-0.5">{doc.name}</p>
              </div>
            </div>
            <button onClick={() => setShowSimulator(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-[#C4E9F9]/60" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Situação Atual</h4>
                <div className="bg-white/3 border border-white/6 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[#C4E9F9]/40 mb-1">Indexador</p>
                    <p className="text-sm font-semibold text-white">{getIndexerFromRate(doc.rate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#C4E9F9]/40 mb-1">Spread</p>
                    <p className="text-sm font-semibold text-white">{parseRate(doc.rate)}% a.a.</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#C4E9F9]/40 mb-1">Taxa Base ({getIndexerFromRate(doc.rate)})</p>
                    <p className="text-sm font-semibold text-[#3691ED]">{MARKET_RATES[getIndexerFromRate(doc.rate) as keyof typeof MARKET_RATES]}% a.a.</p>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs text-[#C4E9F9]/40 mb-1">Taxa Total</p>
                    <p className="text-lg font-bold text-amber-400">
                      {(MARKET_RATES[getIndexerFromRate(doc.rate) as keyof typeof MARKET_RATES] + parseRate(doc.rate)).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Nova Proposta</h4>
                <div className="bg-white/3 border border-white/6 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs text-[#C4E9F9]/40 mb-2 block">Novo Indexador</label>
                    <select value={simNewIndexer} onChange={(e) => setSimNewIndexer(e.target.value)} className="aventos-input">
                      <option>CDI</option>
                      <option>IPCA</option>
                      <option>IGP-M</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#C4E9F9]/40 mb-2 block">Novo Spread (%)</label>
                    <input type="number" placeholder="Ex: 5.5" value={simNewSpread} onChange={(e) => setSimNewSpread(e.target.value)} className="aventos-input" />
                  </div>
                  {simulatorResults && (
                    <div className="pt-3 border-t border-white/5">
                      <p className="text-xs text-[#C4E9F9]/40 mb-1">Nova Taxa Total</p>
                      <p className="text-lg font-bold text-[#16A085]">
                        {simulatorResults.newTotalRate.toFixed(2)}%
                      </p>
                      {simulatorResults.isPositive && (
                        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3" />
                          Economia: {simulatorResults.savings.toFixed(2)}% ({simulatorResults.savingsPercent.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {simulatorResults && (
              <div className="mt-6 p-4 bg-[#16A085]/10 border border-[#16A085]/20 rounded-lg">
                <p className="text-sm text-[#C4E9F9]/80">
                  <span className="font-semibold text-[#16A085]">Análise:</span> Refinanciar para {simNewIndexer} + {simNewSpread}% resultaria em uma taxa de <span className="font-bold text-[#16A085]">{simulatorResults.newTotalRate.toFixed(2)}%</span>, representando uma {simulatorResults.isPositive ? 'redução' : 'aumento'} de <span className="font-bold">{Math.abs(simulatorResults.savings).toFixed(2)}%</span> em relação à taxa atual.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCRICard = (doc: CRIData) => {
    const specificDoc = criSpecificDocs[doc.id];
    return (
      <div key={doc.id} onClick={() => setSelectedCRI(doc)} className="group cursor-pointer aventos-card hover:bg-white/6 p-0 overflow-hidden flex flex-col lg:flex-row items-start lg:items-center gap-4 transition-all">
        <div className="flex-1 min-w-0 p-4 lg:p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white group-hover:text-[#16A085] transition-colors truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {doc.name}
              </h3>
              <p className="text-sm text-[#C4E9F9]/60 font-normal mt-0.5">{doc.debtor}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {specificDoc && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-[#16A085]/10 text-[#16A085] border border-[#16A085]/20">
                  <FileCheck className="w-3 h-3" /> Doc
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(doc.status)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(doc.status)}`}></span>
                {getStatusLabel(doc.status)}
              </span>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-3 mt-4 ${(doc.cidade || doc.estado || doc.regiao) ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <div className="bg-white/5 border border-white/8 p-3 rounded-lg">
              <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Código</p>
              <p className="text-sm font-mono text-[#C4E9F9]/90">{doc.code}</p>
            </div>
            <div className="bg-white/5 border border-white/8 p-3 rounded-lg">
              <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Taxa</p>
              <p className="text-sm font-semibold text-[#16A085]">{doc.rate}</p>
            </div>
            <div className="bg-white/5 border border-white/8 p-3 rounded-lg">
              <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Vencimento</p>
              <p className="text-sm font-semibold text-[#3691ED]">{doc.maturityDate}</p>
            </div>
            <div className="bg-white/5 border border-white/8 p-3 rounded-lg">
              <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Securitizadora</p>
              <p className="text-sm font-medium text-[#C4E9F9]/80 truncate">{doc.securitizer}</p>
            </div>
            {(doc.cidade || doc.estado || doc.regiao) && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                <p className="text-[10px] text-[#C4E9F9]/40 uppercase tracking-wider font-semibold mb-1">Localização</p>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  {doc.estado ? (
                    <p className="text-sm font-medium text-amber-300 truncate">
                      {doc.cidade ? `${doc.cidade} / ${doc.estado}` : doc.estado}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-300/70 truncate">{doc.regiao}</p>
                  )}
                </div>
                {doc.estado && doc.regiao && <p className="text-[10px] text-[#C4E9F9]/30 mt-0.5 pl-4">{doc.regiao}</p>}
              </div>
            )}
          </div>

          {doc.lastro && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#C4E9F9]/60 bg-[#16A085]/10 p-2.5 rounded-lg border border-[#16A085]/20">
              <Shield className="w-3.5 h-3.5 text-[#16A085] shrink-0" />
              <span className="font-semibold uppercase tracking-tight text-[#16A085]">Lastro:</span>
              <span className="font-medium">{doc.lastro}</span>
            </div>
          )}
        </div>

        <div className="flex flex-row lg:flex-col gap-2 lg:w-44 shrink-0 p-4 lg:p-5" onClick={(e) => e.stopPropagation()}>
          {doc.isin && (
            <button onClick={() => setDetailCRI(doc)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border border-[#16A085]/40 bg-[#16A085]/10 hover:bg-[#16A085]/20 text-[#16A085]">
              <Info className="w-4 h-4" /> Detalhes
            </button>
          )}
          <button onClick={() => handleDownload(doc)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-[#16A085] hover:bg-[#1abc9c] text-white">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={() => openSimulator(doc)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border border-[#3691ED]/30 bg-[#3691ED]/10 hover:bg-[#3691ED]/20 text-[#3691ED]">
            <Calculator className="w-4 h-4" /> Simular
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen aventos-bg">
      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-2xl bg-red-900/90 border border-red-500/50 text-red-200 p-4 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro de Sincronização da API</p>
            <p className="text-xs text-red-200/70 mt-0.5">O dashboard está utilizando dados estáticos de fallback temporariamente. Detalhes: {error}</p>
          </div>
        </div>
      )}

      {detailCRI?.isin && (
        <CRIDetailModal
          isin={detailCRI.isin}
          criName={detailCRI.name}
          onClose={() => setDetailCRI(null)}
        />
      )}
      {renderDetailPanel()}
      {renderSimulatorModal()}

      <header className="aventos-header sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img src={LOGO_URL} alt="Aventos" className="h-8 object-contain" />
              <div className="hidden sm:block h-6 w-px bg-white/15"></div>
              <span className="hidden sm:block text-xs font-medium text-[#C4E9F9]/50 uppercase tracking-widest">Portal de Refinanciamento CRI</span>
              <div className="hidden lg:block h-6 w-px bg-white/15"></div>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-[11px] font-semibold text-white tabular-nums" style={{ fontFamily: "'Poppins', sans-serif", letterSpacing: '0.05em' }}>
                  {brasiliaTime.time} <span className="text-[#16A085]">BRT</span>
                </span>
                <span className="text-[10px] text-[#C4E9F9]/40" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {brasiliaTime.date.charAt(0).toUpperCase() + brasiliaTime.date.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { id: 'reports', label: 'Relatórios', icon: FileText },
                { id: 'market', label: 'Mercado', icon: TrendingUp },
                { id: 'linkedin', label: 'LinkedIn', icon: Linkedin }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMainView(tab.id as 'dashboard' | 'reports' | 'market' | 'linkedin')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mainView === tab.id ? 'bg-[#16A085] text-white' : 'text-[#C4E9F9]/60 hover:text-white hover:bg-white/8'}`}
                >
                  <tab.icon className="w-3.5 h-3.5" /><span className="hidden md:inline">{tab.label}</span>
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1" />
              <button
                onClick={() => { localStorage.removeItem('aventos-auth'); window.location.href = '/'; }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-[#C4E9F9]/40 hover:text-red-400 hover:bg-red-500/10"
                title="Sair"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {mainView === 'dashboard' && (
          <div className="space-y-8 aventos-fadein">
            <div>
              <h2 className="aventos-heading text-2xl sm:text-3xl text-white mb-2">Oportunidades de Refinanciamento</h2>
              <p className="text-[#C4E9F9]/50 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Análise e acompanhamento de CRIs para identificação de oportunidades. Clique em um CRI para ver detalhes.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'portfolio', label: 'Portfólio Principal', count: allCRIsData.filter(c => c.carteira === 'Portfólio Principal').length, icon: Briefcase },
                { id: 'high-yield', label: 'High Yield', count: allCRIsData.filter(c => c.carteira === 'High Yield').length, icon: AlertTriangle }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as 'portfolio' | 'high-yield'); setSelectedYear(null); setSelectedSecuritizer(null); setSelectedIndexer(null); setSelectedRegiao(null); setSelectedUF(null); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id ? 'bg-[#16A085] text-white shadow-lg shadow-[#16A085]/20' : 'bg-white/5 border border-white/10 text-[#C4E9F9]/70 hover:bg-white/10 hover:text-white'
                  }`}
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/10'}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total de CRIs', value: totalCRIsGlobal, icon: Code2, color: '#3691ED' },
                { label: 'Nesta Carteira', value: docsInCurrentTab, icon: Building2, color: '#16A085' },
                { label: 'Após Filtros', value: filteredCount, icon: Filter, color: '#C4E9F9' },
                { label: 'Securitizadoras', value: securitizerData.length, icon: Shield, color: '#f59e0b' }
              ].map((stat, i) => (
                <div key={i} className="aventos-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-[#C4E9F9]/40 uppercase tracking-widest mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>{stat.label}</p>
                      <p className="text-3xl font-bold text-white" style={{ fontFamily: "'Libre Baskerville', serif" }}>{stat.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="aventos-card">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#16A085]/15 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-[#16A085]" />
                </div>
                <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Filtros de Pesquisa</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C4E9F9]/30" />
                    <input placeholder="Nome, devedor ou código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="aventos-input" style={{ paddingLeft: '2.5rem' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Ano de Vencimento</label>
                  <select className="aventos-input" value={selectedYear || ''} onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">Todos</option>
                    {years.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Securitizadora</label>
                  <select className="aventos-input" value={selectedSecuritizer || ''} onChange={(e) => setSelectedSecuritizer(e.target.value || null)}>
                    <option value="">Todas ({securitizerOptions.length})</option>
                    {securitizerOptions.map(sec => <option key={sec.id} value={sec.name}>{sec.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Região</label>
                  <select className="aventos-input" value={selectedRegiao || ''} onChange={(e) => { setSelectedRegiao(e.target.value || null); setSelectedUF(null); }}>
                    <option value="">Todas ({regiaoOptions.length})</option>
                    {regiaoOptions.map(reg => <option key={reg} value={reg}>{reg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Estado / UF</label>
                  <select className="aventos-input" value={selectedUF || ''} onChange={(e) => setSelectedUF(e.target.value || null)}>
                    <option value="">Todos{selectedRegiao ? ` (${estadoOptions.length})` : ''}</option>
                    {estadoOptions.map(est => <option key={est} value={est}>{est}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C4E9F9]/50 mb-2 uppercase tracking-wider" style={{ fontFamily: "'Poppins', sans-serif" }}>Indexador</label>
                  <select className="aventos-input" value={selectedIndexer || ''} onChange={(e) => setSelectedIndexer(e.target.value || null)}>
                    <option value="">Todos</option>
                    <option value="IPCA">IPCA</option>
                    <option value="CDI">CDI</option>
                    <option value="IGP-M">IGP-M</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="aventos-heading text-xl text-white">
                  {activeTab === 'portfolio' ? 'Portfólio Principal' : 'High Yield'}
                </h2>
                <p className="text-xs text-[#C4E9F9]/40 font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {filteredCount} ativos · página {currentPage}/{totalPages || 1}
                </p>
              </div>

              {/* Pagination tabs */}
              {totalPages > 1 && (() => {
                const win = 5;
                let start = Math.max(1, currentPage - Math.floor(win / 2));
                let end = Math.min(totalPages, start + win - 1);
                if (end - start < win - 1) start = Math.max(1, end - win + 1);
                const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                const btnBase = 'w-8 h-8 rounded-md text-xs font-bold transition-all flex items-center justify-center';
                const btnActive = 'bg-[#16A085] text-white shadow-lg shadow-teal-500/20';
                const btnInactive = 'bg-white/5 text-[#C4E9F9]/50 hover:bg-white/10 hover:text-white border border-white/10';
                const btnDisabled = 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed';
                return (
                  <div className="flex gap-1.5 items-center">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}>‹</button>
                    {pages.map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)} className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}>{page}</button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}>›</button>
                  </div>
                );
              })()}

              {pagedDocuments.length > 0 ? (
                <div className="space-y-3">{pagedDocuments.map(doc => renderCRICard(doc))}</div>
              ) : (
                <div className="aventos-card py-16 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#C4E9F9]/20 mx-auto mb-4" />
                  <p className="text-[#C4E9F9]/50 font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>Nenhum CRI encontrado com os filtros aplicados.</p>
                </div>
              )}

              {/* Bottom pagination (repeated for convenience) */}
              {totalPages > 1 && (() => {
                const win = 5;
                let start = Math.max(1, currentPage - Math.floor(win / 2));
                let end = Math.min(totalPages, start + win - 1);
                if (end - start < win - 1) start = Math.max(1, end - win + 1);
                const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                const btnBase = 'w-8 h-8 rounded-md text-xs font-bold transition-all flex items-center justify-center';
                const btnActive = 'bg-[#16A085] text-white shadow-lg shadow-teal-500/20';
                const btnInactive = 'bg-white/5 text-[#C4E9F9]/50 hover:bg-white/10 hover:text-white border border-white/10';
                const btnDisabled = 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed';
                const go = (page: number) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };
                return (
                  <div className="flex gap-1.5 items-center pt-2 border-t border-white/5">
                    <button onClick={() => go(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}>‹</button>
                    {pages.map(page => (
                      <button key={page} onClick={() => go(page)} className={`${btnBase} ${page === currentPage ? btnActive : btnInactive}`}>{page}</button>
                    ))}
                    <button onClick={() => go(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}>›</button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {mainView === 'reports' && (
          <div className="space-y-8 aventos-fadein">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="aventos-heading text-2xl sm:text-3xl text-white mb-2">Relatórios</h2>
                <p className="text-[#C4E9F9]/50 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Análise consolidada de carteiras e performance dos {totalCRIsGlobal} CRIs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="aventos-card p-0 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#16A085]/15 flex items-center justify-center"><PieChart className="w-5 h-5 text-[#16A085]" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Distribuição por Status</h3>
                      <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Todos os CRIs</p>
                    </div>
                  </div>
                  <button onClick={() => handleExportReport('status')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={260}>
                    <RechartsPie>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" formatter={(value: string) => <span style={{ color: '#C4E9F9', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>{value}</span>} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {statusData.map((s, i) => (
                      <div key={i} className="text-center p-3 rounded-lg bg-white/5 border border-white/8">
                        <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'Libre Baskerville', serif" }}>{s.value}</p>
                        <p className="text-[10px] text-[#C4E9F9]/50 font-medium mt-1 uppercase tracking-wider">{s.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="aventos-card p-0 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#3691ED]/15 flex items-center justify-center"><Calendar className="w-5 h-5 text-[#3691ED]" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Vencimentos por Ano</h3>
                      <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Distribuição por carteira</p>
                    </div>
                  </div>
                  <button onClick={() => handleExportReport('maturity')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={maturityData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="year" tick={{ fill: '#C4E9F9', fontSize: 12, fontFamily: "'Poppins', sans-serif" }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                      <YAxis tick={{ fill: '#C4E9F9', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(value: string) => <span style={{ color: '#C4E9F9', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>{value}</span>} />
                      <Bar dataKey="Portfólio" fill="#16A085" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Centro-Oeste" fill="#3691ED" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="High Yield" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="aventos-card p-0 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/15 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#f59e0b]" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Taxa Média por Carteira</h3>
                      <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Spread médio sobre indexador</p>
                    </div>
                  </div>
                  <button onClick={() => handleExportReport('rate')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rateByPortfolio} layout="vertical" barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#C4E9F9', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} unit="%" />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#C4E9F9', fontSize: 12, fontFamily: "'Poppins', sans-serif" }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="taxa" radius={[0, 6, 6, 0]}>
                        {rateByPortfolio.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {rateByPortfolio.map((r, i) => (
                      <div key={i} className="text-center p-3 rounded-lg bg-white/5 border border-white/8">
                        <p className="text-xl font-bold" style={{ color: r.fill, fontFamily: "'Libre Baskerville', serif" }}>{r.taxa}%</p>
                        <p className="text-[10px] text-[#C4E9F9]/50 font-medium mt-1">{r.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="aventos-card p-0 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#ef4444]/15 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#ef4444]" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Exposição por Securitizadora</h3>
                      <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Concentração de risco</p>
                    </div>
                  </div>
                  <button onClick={() => handleExportReport('securitizer')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie data={securitizerData} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="value" stroke="none"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {securitizerData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {securitizerData.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/8">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{s.name}</p>
                          <p className="text-[10px] text-[#C4E9F9]/40">{s.value} CRIs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mainView === 'market' && (
          <div className="space-y-8 aventos-fadein">
            <div>
              <h2 className="aventos-heading text-2xl sm:text-3xl text-white mb-2">Indicadores de Mercado</h2>
              <p className="text-[#C4E9F9]/50 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Acompanhamento dos principais indexadores e notícias do setor em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketIndicators.map((item, i) => (
                <a
                  key={i}
                  href={item.sourceUrl || '#'}
                  target={item.sourceUrl ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  onClick={!item.sourceUrl ? (e) => e.preventDefault() : undefined}
                  className="aventos-card group block hover:border-teal-500/40 transition-all cursor-pointer"
                >
                  <p className="text-[10px] font-semibold text-[#C4E9F9]/40 uppercase tracking-widest mb-3" style={{ fontFamily: "'Poppins', sans-serif" }}>{item.name}</p>
                  <div className="flex items-end gap-3 mb-2">
                    <span className="text-2xl font-bold text-white group-hover:text-teal-300 transition-colors" style={{ fontFamily: "'Libre Baskerville', serif" }}>
                      {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}%
                    </span>
                    {item.trend && (
                      <span className={`text-xs font-semibold mb-1 flex items-center gap-0.5 ${item.positive ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {item.positive ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {item.trend}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#C4E9F9]/30 font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>{item.desc}</p>
                  {item.sourceUrl && (
                    <p className="text-[9px] text-teal-500/40 group-hover:text-teal-400 mt-2 transition-colors" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      Ver fonte →
                    </p>
                  )}
                </a>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 aventos-card p-0 overflow-hidden flex flex-col">
                <div className="bg-white/5 p-5 border-b border-white/8 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3691ED]/15 flex items-center justify-center">
                      <Newspaper className="w-4 h-4 text-[#3691ED]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Notícias do Mercado de CRI</h4>
                      <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Google News · atualiza a cada 5 min</p>
                    </div>
                  </div>
                  <button
                    onClick={() => refetchNews()}
                    disabled={isFetchingNews}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
                    title="Atualizar notícias"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingNews ? 'animate-spin' : ''}`} />
                    {isFetchingNews ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </div>
                <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1">
                  {formattedNewsData.map((news) => {
                    const catStyle = getCategoryColor(news.category);
                    return (
                      <a key={news.animationKey} href={news.url} target="_blank" rel="noopener noreferrer" className="block p-5 hover:bg-white/5 transition-all duration-300 group animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{news.category}</span>
                              <span className="text-[10px] text-[#C4E9F9]/30 font-medium">{news.displayDate}</span>
                              {news.displayTime && <span className="text-[10px] text-[#C4E9F9]/30 font-medium">{news.displayTime}</span>}
                              <span className="text-[10px] text-[#C4E9F9]/25">— {news.source}</span>
                            </div>
                            <h5 className="text-sm font-semibold text-white group-hover:text-[#16A085] transition-colors leading-snug" style={{ fontFamily: "'Poppins', sans-serif" }}>{news.title}</h5>
                            <p className="text-xs text-[#C4E9F9]/50 mt-1.5 leading-relaxed line-clamp-2">{news.summary}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-[#C4E9F9]/15 group-hover:text-[#16A085] transition-colors shrink-0 mt-1" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 aventos-card p-0 overflow-hidden flex flex-col">
                <div className="bg-white/5 p-5 border-b border-white/8 flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>Alertas de Vencimento</h4>
                    <p className="text-[10px] text-[#C4E9F9]/40 mt-0.5">Próximos 90 dias</p>
                  </div>
                </div>
                <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1">
                  {maturityAlerts.length > 0 ? maturityAlerts.map((cri) => {
                    const isOverdue = cri.daysLeft < 0;
                    const isUrgent = cri.daysLeft >= 0 && cri.daysLeft <= 30;
                    const isWarning = cri.daysLeft > 30 && cri.daysLeft <= 60;
                    let urgencyColor = 'text-[#C4E9F9]/60';
                    let urgencyBg = 'bg-white/5';
                    let urgencyIcon = <Clock className="w-4 h-4 text-[#C4E9F9]/40" />;
                    let urgencyLabel = `${cri.daysLeft}d`;
                    if (isOverdue) {
                      urgencyColor = 'text-red-300'; urgencyBg = 'bg-red-500/10';
                      urgencyIcon = <AlertCircle className="w-4 h-4 text-red-400" />;
                      urgencyLabel = `${Math.abs(cri.daysLeft)}d atrás`;
                    } else if (isUrgent) {
                      urgencyColor = 'text-red-300'; urgencyBg = 'bg-red-500/10';
                      urgencyIcon = <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />;
                      urgencyLabel = `${cri.daysLeft}d`;
                    } else if (isWarning) {
                      urgencyColor = 'text-amber-300'; urgencyBg = 'bg-amber-500/10';
                      urgencyIcon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                      urgencyLabel = `${cri.daysLeft}d`;
                    }
                    return (
                      <div key={cri.id} className={`p-4 ${urgencyBg} hover:bg-white/5 transition-colors cursor-pointer`} onClick={() => setSelectedCRI(cri)}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">{urgencyIcon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-semibold text-white truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>{cri.name}</h5>
                              <span className={`text-[11px] font-bold shrink-0 ${urgencyColor}`}>{urgencyLabel}</span>
                            </div>
                            <p className="text-[11px] text-[#C4E9F9]/50 mt-0.5">{cri.debtor}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-[#C4E9F9]/40"><span className="font-semibold text-[#3691ED]">{cri.maturityDate}</span></span>
                              <span className="text-[10px] text-[#16A085] font-semibold">{cri.rate}</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${getStatusColor(cri.status)}`}>
                                <span className={`w-1 h-1 rounded-full ${getStatusDot(cri.status)}`}></span>
                                {getStatusLabel(cri.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-8 text-center">
                      <Clock className="w-10 h-10 text-[#C4E9F9]/15 mx-auto mb-3" />
                      <p className="text-xs text-[#C4E9F9]/40">Nenhum vencimento nos próximos 90 dias.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Análise de Refinanciamento */}
            <div className="mt-12 pt-12 border-t border-white/8">
              <RefinancingAnalysis />
            </div>
          </div>
        )}

        {mainView === 'linkedin' && (
          <div className="space-y-8 aventos-fadein">
            <LinkedInContacts />
          </div>
        )}
      </main>

      <footer className="border-t border-white/8 py-12 mt-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
              <img src={LOGO_URL} alt="Aventos" className="h-7 object-contain mb-6" />
              <p className="text-[#C4E9F9]/40 text-sm max-w-md leading-relaxed" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Referência em gestão de ativos imobiliários e estruturação de refinanciamento de CRIs. 
                Comprometidos com a transparência e segurança do investidor institucional.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-[#C4E9F9]/60 text-xs mb-6 uppercase tracking-widest" style={{ fontFamily: "'Poppins', sans-serif" }}>Acesso Rápido</h4>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => setMainView('dashboard')} className="text-[#C4E9F9]/40 hover:text-[#16A085] transition-colors" style={{ fontFamily: "'Poppins', sans-serif" }}>Dashboard</button></li>
                <li><button onClick={() => setMainView('reports')} className="text-[#C4E9F9]/40 hover:text-[#16A085] transition-colors" style={{ fontFamily: "'Poppins', sans-serif" }}>Relatórios</button></li>
                <li><button onClick={() => setMainView('market')} className="text-[#C4E9F9]/40 hover:text-[#16A085] transition-colors" style={{ fontFamily: "'Poppins', sans-serif" }}>Mercado</button></li>
                <li><button onClick={() => setMainView('linkedin')} className="text-[#C4E9F9]/40 hover:text-[#16A085] transition-colors" style={{ fontFamily: "'Poppins', sans-serif" }}>LinkedIn</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#C4E9F9]/60 text-xs mb-6 uppercase tracking-widest" style={{ fontFamily: "'Poppins', sans-serif" }}>Suporte</h4>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all border border-white/15 bg-white/5 hover:bg-white/10 text-[#C4E9F9]/60 hover:text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Email para Gestão
              </button>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/8 text-xs text-[#C4E9F9]/25 font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <p>© 2026 Aventos Corporate Base de dados</p>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        :root { font-family: 'Poppins', sans-serif; }
        .aventos-bg { background: linear-gradient(180deg, #021a3a 0%, #03204C 30%, #041e42 100%); min-height: 100vh; }
        .aventos-header { background: rgba(3, 32, 76, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .aventos-heading { font-family: 'Libre Baskerville', serif; font-weight: 700; }
        .aventos-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; transition: all 0.2s ease; }
        .aventos-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
        .aventos-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #C4E9F9; font-size: 13px; font-family: 'Poppins', sans-serif; transition: all 0.2s ease; outline: none; }
        .aventos-input:focus { border-color: #16A085; box-shadow: 0 0 0 3px rgba(22, 160, 133, 0.15); }
        .aventos-input::placeholder { color: rgba(196, 233, 249, 0.25); }
        .aventos-input option { background: #03204C; color: #C4E9F9; }
        .aventos-fadein { animation: aventosFadeIn 0.4s ease-out; }
        @keyframes aventosFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.25s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .recharts-default-tooltip { background: #0a1929 !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 8px !important; }
        .recharts-legend-item-text { color: #C4E9F9 !important; }
        .recharts-pie-label-text { fill: #C4E9F9 !important; font-size: 11px !important; font-family: 'Poppins', sans-serif !important; }
      `}} />
      
      {/* Botão de Chat com Gemini */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40"
        title="Especialista CRI — Aventos"
      >
        <MessageCircle size={24} />
      </button>
      
      {/* Chat com Gemini */}
      <GeminiChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        context={`Você está analisando ${allCRIsData.length} CRIs. Carteira ativa: ${activeTab}`}
      />
      
      {/* Alertas de Oportunidades */}
      <OpportunitiesAlert />
    </div>
  );
}
