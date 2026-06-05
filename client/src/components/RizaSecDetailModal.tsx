import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  X, ExternalLink, FileText, Shield, TrendingUp, Calendar,
  Loader2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Props {
  criId: string;
  criName: string;
  onClose: () => void;
}

type Tab = 'caracteristicas' | 'documentos';

const TAB_LABELS: Record<Tab, string> = {
  caracteristicas: 'Características',
  documentos: 'Documentos',
};
const TAB_ICONS: Record<Tab, React.ElementType> = {
  caracteristicas: Shield,
  documentos: FileText,
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="p-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C4E9F9]/40">{label}</span>
      <span className="text-sm text-white/90 font-medium break-words">{value || '—'}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-white/10 text-[#C4E9F9]/60 border-white/20';
  if (s.includes('em andamento') || s.includes('adimplente') || s.includes('ativo')) {
    cls = 'bg-[#16A085]/15 text-[#16A085] border-[#16A085]/30';
  } else if (s.includes('default') || s.includes('vencido') || s.includes('inadimplente')) {
    cls = 'bg-red-500/15 text-red-400 border-red-500/30';
  } else if (s.includes('aguardando') || s.includes('encerrado')) {
    cls = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

interface SerieData {
  codigoIsin: string; codigoCetip: string; numeroSerie: number | string;
  tipoSerie: string; tipoOferta: string; taxa: string; status: string;
  volumeEmissao: number; dataVencimento: string; base: string;
  periodicidadeCorrecao: string; periodicidadePagamento: string; indexador: string;
}
function SerieRow({ s, index }: { s: SerieData; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#16A085] bg-[#16A085]/10 px-2 py-0.5 rounded-md">
            {s.numeroSerie}ª Série
          </span>
          <span className="text-xs font-mono text-[#C4E9F9]/60">{s.codigoCetip}</span>
          <StatusBadge status={s.status} />
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#C4E9F9]/40" />
          : <ChevronDown className="w-4 h-4 text-[#C4E9F9]/40" />}
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 bg-white/3 border-t border-white/8">
          <Field label="Código ISIN"            value={s.codigoIsin} />
          <Field label="Código CETIP / B3"       value={s.codigoCetip} />
          <Field label="Taxa de Juros"           value={s.taxa} />
          <Field label="Classe / Série"          value={s.tipoSerie} />
          <Field label="Tipo de Oferta"          value={s.tipoOferta} />
          <Field label="Indexador"               value={s.indexador} />
          <Field label="Data de Vencimento"      value={s.dataVencimento} />
          <Field label="Base de Cálculo"         value={s.base} />
          <Field label="Periodicidade Correção"  value={s.periodicidadeCorrecao} />
          <Field label="Periodicidade Pagamento" value={s.periodicidadePagamento} />
          {s.volumeEmissao > 0 && (
            <Field label="Volume (R$ M)" value={`R$ ${Number(s.volumeEmissao).toFixed(2)} M`} />
          )}
        </div>
      )}
    </div>
  );
}

export function RizaSecDetailModal({ criId, criName, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('caracteristicas');

  const { data: det, isLoading, error } = trpc.rizasec.getDetail.useQuery(
    { id: criId },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#071a33] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — mesmo estilo do CRIDetailModal */}
        <div className="flex items-start justify-between p-5 border-b border-white/8 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#16A085] mb-1">
              {det?.series?.[0]?.codigoIsin || criId}
            </p>
            <h2 className="text-lg font-bold text-white truncate" style={{ fontFamily: "'Libre Baskerville', serif" }}>
              {criName}
            </h2>
            {det?.rzaUrl && (
              <a
                href={det.rzaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-[#3691ED] hover:text-[#60a5fa] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ver no portal RizaSec
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-[#C4E9F9]/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-white/8 shrink-0 overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map(tab => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-all ${
                  activeTab === tab
                    ? 'border-[#16A085] text-[#16A085] bg-[#16A085]/10'
                    : 'border-transparent text-[#C4E9F9]/50 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                <Icon className="w-3.5 h-3.5" />
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {isLoading && (
            <div className="flex items-center justify-center h-40 gap-3 text-[#C4E9F9]/50">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando dados RizaSec...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">Erro ao carregar dados: {error.message}</span>
            </div>
          )}

          {!isLoading && !det && (
            <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-500/20 rounded-lg p-4 text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">Dados detalhados não disponíveis para este CRI.</span>
            </div>
          )}

          {det && activeTab === 'caracteristicas' && (
            <div className="space-y-5">
              {/* Dados gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                <Field label="Número da Emissão"    value={String(det.emissao)} />
                <Field label="Data de Emissão"       value={det.dataEmissao} />
                <Field label="Agente Fiduciário"     value={det.agenteFiduciario} />
                <Field label="Tipo de Lastro"        value={det.tipoLastro} />
                <Field label="Detalhamento do Lastro" value={det.detalhamentoLastro} />
                {det.volumeTotal > 0 && (
                  <Field label="Volume Total (R$ M)" value={`R$ ${Number(det.volumeTotal).toFixed(2)} M`} />
                )}
              </div>

              {/* Séries */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C4E9F9]/40 mb-3">
                  Séries ({det.series?.length ?? 0})
                </p>
                <div className="space-y-3">
                  {(det.series ?? []).map((s, i) => (
                    <SerieRow key={s.codigoCetip || i} s={s} index={i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {det && activeTab === 'documentos' && (
            <div className="space-y-4">
              <p className="text-[#C4E9F9]/50 text-sm">
                Documentos desta emissão (Prospecto, Termo de Securitização, Relatórios):
              </p>
              <a
                href={det.rzaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-[#16A085]/10 border border-[#16A085]/25 rounded-xl text-[#16A085] hover:bg-[#16A085]/20 transition-colors"
              >
                <ExternalLink className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Portal do Investidor – RizaSec</p>
                  <p className="text-xs text-[#C4E9F9]/50 mt-0.5">{det.rzaUrl}</p>
                </div>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
