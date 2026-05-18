import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  X, ExternalLink, FileText, Loader2, AlertCircle,
  TrendingUp, Calendar, Shield, Building2, DollarSign,
} from 'lucide-react';

interface Props {
  isin: string;
  criName: string;
  onClose: () => void;
}

type Tab = 'caracteristicas' | 'documentos' | 'precos' | 'agenda';

const TAB_LABELS: Record<Tab, string> = {
  caracteristicas: 'Características',
  documentos: 'Documentos',
  precos: 'Preços',
  agenda: 'Agenda de Eventos',
};

const TAB_ICONS: Record<Tab, React.ElementType> = {
  caracteristicas: Shield,
  documentos: FileText,
  precos: TrendingUp,
  agenda: Calendar,
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C4E9F9]/40">{label}</span>
      <span className="text-sm text-white/90 font-medium break-words">{value || '—'}</span>
    </div>
  );
}

export function CRIDetailModal({ isin, criName, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('caracteristicas');

  const { data, isLoading, error } = trpc.cri.get.useQuery(
    { isin },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );

  const c = data?.caracteristicas;
  const precos = data?.precos ?? [];
  const agenda = data?.agenda ?? [];
  const documentos = data?.documentos ?? [];
  const balanco = data?.balanco;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#071a33] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/8 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#16A085] mb-1">{isin}</p>
            <h2 className="text-lg font-bold text-white truncate" style={{ fontFamily: "'Libre Baskerville', serif" }}>
              {criName}
            </h2>
            {data?.anbimaUrl && (
              <a
                href={data.anbimaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-[#3691ED] hover:text-[#60a5fa] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ver no portal ANBIMA
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
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => {
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
              <span className="text-sm">Carregando dados CVM...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">Erro ao carregar dados: {error.message}</span>
            </div>
          )}

          {data && !data.found && (
            <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-500/20 rounded-lg p-4 text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">Dados CVM não encontrados para este ISIN ({isin}).</span>
            </div>
          )}

          {data?.found && (
            <>
              {/* ── CARACTERÍSTICAS ─────────────────────────────────────────── */}
              {activeTab === 'caracteristicas' && c && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 bg-white/3 border border-white/8 rounded-xl divide-x-0 overflow-hidden">
                    {[
                      ['Código ISIN', c.codigo_isin],
                      ['Código CETIP / B3', c.codigo_cetip],
                      ['Data de Emissão', c.data_emissao],
                      ['Data de Vencimento', c.data_vencimento],
                      ['Número da Emissão', c.numero_emissao],
                      ['Número da Série', c.numero_serie],
                      ['Tipo de Oferta', c.tipo_oferta],
                      ['Classe / Série', c.classe_serie],
                      ['Taxa de Juros', c.taxa_juros],
                      ['Situação', c.situacao],
                      ['Nível de Subordinação', c.nivel_subordinacao],
                      ['Classificação de Risco', c.classificacao_risco],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-white/5">
                        <Field label={label} value={value} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#C4E9F9]/40 mb-3">Lastro e Garantias</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                      {[
                        ['Tipo de Lastro', c.tipo_lastro],
                        ['Detalhamento do Lastro', c.detalhamento_lastro],
                        ['Garantias / Coobrigação', c.garantias],
                        ['Retenção de Risco', c.retencao_risco],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-white/5">
                          <Field label={label} value={value} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#C4E9F9]/40 mb-3">Prestadores de Serviço</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                      {[
                        ['Emissora / Securitizadora', c.emissora],
                        ['Agente Fiduciário', c.agente_fiduciario],
                        ['Custodiante', c.custodiante],
                        ['Agência de Risco', c.agencia_risco],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-white/5">
                          <Field label={label} value={value} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#C4E9F9]/40 mb-3">Carteira de Crédito</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                      {[
                        ['Concentração', c.concentracao],
                        ['Maior Devedor (%)', c.maior_devedor_pct],
                        ['5 Maiores Devedores (%)', c.cinco_maiores_pct],
                        ['Créditos (R$)', c.natureza_economica],
                      ].map(([label, value]) => (
                        <div key={label} className="border-b border-white/5">
                          <Field label={label} value={value} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {balanco && (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-[#C4E9F9]/40 mb-3">Balanço Patrimonial — {balanco.data_referencia}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          ['Ativo Total (R$)', balanco.ativo_total, '#16A085'],
                          ['Créditos (R$)', balanco.creditos, '#3691ED'],
                          ['Caixa (R$)', balanco.caixa, '#16A085'],
                          ['Passivo Total (R$)', balanco.passivo_total, '#ef4444'],
                          ['Valor Atualizado (R$)', balanco.valor_atualizado, '#f59e0b'],
                        ].map(([label, value, color]) => (
                          <div key={label as string} className="bg-white/3 border border-white/8 rounded-lg p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C4E9F9]/40 mb-1">{label as string}</p>
                            <p className="text-sm font-bold" style={{ color: color as string }}>{value as string}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── DOCUMENTOS ──────────────────────────────────────────────── */}
              {activeTab === 'documentos' && (
                <div>
                  {documentos.length === 0 ? (
                    <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-lg p-6 text-[#C4E9F9]/40">
                      <FileText className="w-5 h-5 shrink-0" />
                      <span className="text-sm">Nenhum documento CVM disponível para este CRI.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documentos.map((doc: any, i: number) => (
                        <div key={i} className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#16A085]/15 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-[#16A085]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{doc.nome}</p>
                            <p className="text-xs text-[#C4E9F9]/40 mt-0.5">{doc.tipo} · {doc.data}</p>
                            {doc.parecer && doc.parecer !== '—' && (
                              <p className="text-xs text-[#C4E9F9]/60 mt-1">Parecer: {doc.parecer}</p>
                            )}
                          </div>
                          {doc.link && (
                            <a
                              href={doc.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16A085]/10 border border-[#16A085]/20 text-[#16A085] hover:bg-[#16A085]/20 transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {data.anbimaUrl && (
                    <div className="mt-5 p-4 bg-[#3691ED]/10 border border-[#3691ED]/20 rounded-xl flex items-center gap-4">
                      <Building2 className="w-5 h-5 text-[#3691ED] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Portal ANBIMA</p>
                        <p className="text-xs text-[#C4E9F9]/50 mt-0.5">Documentos adicionais e histórico no portal oficial ANBIMA Data</p>
                      </div>
                      <a
                        href={data.anbimaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#3691ED]/10 border border-[#3691ED]/20 text-[#3691ED] hover:bg-[#3691ED]/20 transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir ANBIMA
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ── PREÇOS ──────────────────────────────────────────────────── */}
              {activeTab === 'precos' && (
                <div>
                  {precos.length === 0 ? (
                    <div className="text-[#C4E9F9]/40 text-sm text-center py-10">Sem histórico de preços disponível.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/8">
                      <table className="w-full text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        <thead>
                          <tr className="bg-white/5 text-[#C4E9F9]/50 uppercase tracking-wider">
                            {['Referência', 'PU Indicativo', 'Rentabilidade', 'Rendimentos', 'Amortizações', 'Valor Total', 'Quantidade', 'Total Integralizado'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {precos.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-white/3 transition-colors">
                              <td className="px-4 py-3 font-semibold text-[#C4E9F9]/80 whitespace-nowrap">{r.data_referencia}</td>
                              <td className="px-4 py-3 font-bold text-[#16A085] whitespace-nowrap">{r.pu_indicativo}</td>
                              <td className="px-4 py-3 text-amber-300 whitespace-nowrap">{r.rentabilidade}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.rendimentos}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.amortizacoes}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.valor_total}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.quantidade}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.total_integralizado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── AGENDA DE EVENTOS ───────────────────────────────────────── */}
              {activeTab === 'agenda' && (
                <div>
                  {agenda.length === 0 ? (
                    <div className="text-[#C4E9F9]/40 text-sm text-center py-10">Sem agenda de eventos disponível.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/8">
                      <table className="w-full text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        <thead>
                          <tr className="bg-white/5 text-[#C4E9F9]/50 uppercase tracking-wider">
                            {[
                              'Referência',
                              'Receb. Créditos',
                              'Pag. Despesas',
                              'Sênior — Amort.',
                              'Sênior — Juros',
                              'Sênior Total',
                              'Mezanino',
                              'Junior',
                              'Var. Líq. Caixa',
                            ].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {agenda.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-white/3 transition-colors">
                              <td className="px-4 py-3 font-semibold text-[#C4E9F9]/80 whitespace-nowrap">{r.data_referencia}</td>
                              <td className="px-4 py-3 text-emerald-400 whitespace-nowrap">{r.recebimentos_creditos}</td>
                              <td className="px-4 py-3 text-red-400 whitespace-nowrap">{r.pagamentos_despesas}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.pagamentos_senior_amort}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.pagamentos_senior_juros}</td>
                              <td className="px-4 py-3 font-semibold text-[#3691ED] whitespace-nowrap">{r.pagamentos_total_senior}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.pagamentos_mezanino}</td>
                              <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap">{r.pagamentos_junior}</td>
                              <td className={`px-4 py-3 font-semibold whitespace-nowrap ${r.variacao_liquida_caixa?.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                                {r.variacao_liquida_caixa}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
