import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Linkedin, Search, ExternalLink, User, Building2, FileText,
  AlertCircle, Loader2, X, Tag, RefreshCw, Info,
} from 'lucide-react';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TERMS_STR = 'CRI, Certificado de Recebíveis Imobiliários, securitização imobiliária';

type Category = 'posts' | 'perfis' | 'empresas' | 'all';

const CAT_LABEL:  Record<string, string>       = { posts: 'Posts', perfis: 'Perfis', empresas: 'Empresas' };
const CAT_ICON:   Record<string, React.ReactNode> = {
  posts:    <FileText  className="w-3.5 h-3.5" />,
  perfis:   <User      className="w-3.5 h-3.5" />,
  empresas: <Building2 className="w-3.5 h-3.5" />,
};
const CAT_COLOR: Record<string, string> = {
  posts:    'bg-blue-500/20   text-blue-300   border-blue-500/30',
  perfis:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  empresas: 'bg-teal-500/20   text-teal-300   border-teal-500/30',
};

// ─── Setup instructions (sem CSE key) ────────────────────────────────────────

function SetupGuide() {
  return (
    <div className="aventos-card space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold">Google CSE não configurado</p>
          <p className="text-[#C4E9F9]/50 text-sm mt-1">
            Configure as variáveis de ambiente para ativar a busca via
            Google Custom Search (gratuito, 100 buscas/dia, sem CAPTCHA).
          </p>
        </div>
      </div>

      <div className="border-t border-white/8 pt-4 space-y-3 text-sm">
        <Step n={1} title="Criar o mecanismo de pesquisa (CSE)">
          Acesse{' '}
          <a href="https://programmablesearchengine.google.com/controlpanel/create"
            target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">
            programmablesearchengine.google.com
          </a>
          , adicione <code className="text-amber-300 bg-white/5 px-1 rounded">linkedin.com/posts/*</code>,{' '}
          <code className="text-amber-300 bg-white/5 px-1 rounded">linkedin.com/in/*</code> e{' '}
          <code className="text-amber-300 bg-white/5 px-1 rounded">linkedin.com/company/*</code>.
          Marque <em>"Pesquisar em toda a web"</em>. Copie o <strong>CSE ID</strong>.
        </Step>

        <Step n={2} title="Criar API Key no Google Cloud">
          Acesse{' '}
          <a href="https://console.cloud.google.com/apis/credentials"
            target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">
            console.cloud.google.com
          </a>
          , ative a <strong>Custom Search API</strong> e crie uma Chave de API.
        </Step>

        <Step n={3} title="Definir variáveis de ambiente">
          <p>Adicione ao <code className="text-amber-300 bg-white/5 px-1 rounded">.env</code> do servidor:</p>
          <pre className="mt-2 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-green-300 leading-relaxed overflow-x-auto">
{`GOOGLE_CSE_KEY=AIzaSy...   # API Key
GOOGLE_CSE_ID=017abc...:xyz # ID do mecanismo`}
          </pre>
        </Step>

        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80">
            Veja o guia completo em <code className="font-mono">n8n/README_n8n.md</code> — inclui workflow n8n
            para rodar automaticamente às 8h com upsert em Postgres e CSV no Google Drive.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-5 h-5 rounded-full bg-[#16A085]/30 border border-[#16A085]/50 text-[#16A085] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="text-[#C4E9F9]/60 text-sm leading-relaxed">
        <span className="text-white font-medium">{title}: </span>
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LinkedInContacts() {
  const [termsInput, setTermsInput]     = useState(DEFAULT_TERMS_STR);
  const [activeFilter, setActiveFilter] = useState<Category>('all');
  const [perQuery, setPerQuery]         = useState(10);
  const [lastData, setLastData]         = useState<any>(null);

  const utils = trpc.useUtils();

  const terms = useMemo(
    () => termsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    [termsInput],
  );

  const searchMutation = trpc.linkedin.search.useMutation({
    onSuccess: d => { setLastData(d); setActiveFilter('all'); },
  });

  const clearMutation = trpc.linkedin.clearCache.useMutation({
    onSuccess: () => setLastData(null),
  });

  const isRunning = searchMutation.isPending;
  const results   = lastData?.results ?? [];

  const displayed = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter((r: any) => r.categoria === activeFilter);
  }, [results, activeFilter]);

  // ─── No CSE key ──────────────────────────────────────────────────────────

  if (lastData && !lastData.hasCseKey) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <SetupGuide />
      </div>
    );
  }

  // ─── Normal render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Controls card */}
      <div className="aventos-card space-y-4">
        {/* Terms + quota info */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-[#C4E9F9]/50">
              Termos <span className="text-[#C4E9F9]/25">(vírgula · máx 5)</span>
            </label>
            <span className="text-[10px] text-[#C4E9F9]/25">
              {terms.length * 3} buscas / execução · quota: 100/dia
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={termsInput}
                onChange={e => setTermsInput(e.target.value)}
                disabled={isRunning}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition disabled:opacity-50"
                placeholder="CRI, securitização, OPEA, True Securitizadora…"
              />
            </div>
            <select
              value={perQuery}
              onChange={e => setPerQuery(Number(e.target.value))}
              disabled={isRunning}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#C4E9F9]/70 focus:outline-none disabled:opacity-50"
            >
              {[5, 10].map(n => (
                <option key={n} value={n}>{n} resultados/busca</option>
              ))}
            </select>
            <button
              onClick={() => searchMutation.mutate({ terms, categories: ['posts', 'perfis', 'empresas'], perQuery })}
              disabled={isRunning || terms.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#16A085]/20 border border-[#16A085]/30 text-[#16A085] hover:bg-[#16A085]/30 transition disabled:opacity-40 whitespace-nowrap"
            >
              {isRunning
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Buscando…</>
                : <><Search  className="w-3.5 h-3.5" />Buscar</>
              }
            </button>
          </div>

          {/* Term chips */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {terms.map((t, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] bg-white/5 border border-white/10 text-[#C4E9F9]/40 px-2 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Category filter — só aparece com resultados */}
        {results.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/8 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'posts', 'perfis', 'empresas'] as Category[]).map(f => {
                const cnt = f === 'all' ? results.length : (lastData?.breakdown?.[f] ?? 0);
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition ${
                      activeFilter === f
                        ? 'bg-[#16A085] text-white'
                        : 'bg-white/5 border border-white/10 text-[#C4E9F9]/60 hover:bg-white/10'
                    }`}
                  >
                    {f !== 'all' && CAT_ICON[f]}
                    {f === 'all' ? 'Todos' : CAT_LABEL[f]}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === f ? 'bg-white/20' : 'bg-white/10'}`}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="text-[10px] text-[#C4E9F9]/25 hover:text-[#C4E9F9]/50 transition"
              title="Limpar cache do servidor"
            >
              <X className="w-3 h-3 inline mr-0.5" />
              Limpar cache (2 h)
            </button>
          </div>
        )}
      </div>

      {/* Errors */}
      {(lastData?.errors?.length ?? 0) > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Aviso</p>
            {lastData.errors.map((e: string, i: number) => (
              <p key={i} className="text-[11px] text-amber-400/70 mt-0.5">{e}</p>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isRunning && (
        <div className="flex flex-col items-center gap-3 py-14 text-[#C4E9F9]/40">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          <p className="text-sm">Consultando Google Custom Search…</p>
          <p className="text-xs text-[#C4E9F9]/25">1,5 s entre queries · {terms.length * 3} buscas no total</p>
        </div>
      )}

      {/* Initial empty state */}
      {!isRunning && !lastData && (
        <div className="aventos-card flex flex-col items-center gap-4 py-14 text-center">
          <Linkedin className="w-12 h-12 text-blue-400 opacity-15" />
          <div>
            <p className="text-white font-semibold">Pronto para buscar</p>
            <p className="text-[#C4E9F9]/40 text-sm mt-1 max-w-md">
              Ajuste os termos e clique em{' '}
              <span className="text-teal-400 font-medium">Buscar</span>.
              Os resultados ficam em cache por 2 horas.
            </p>
          </div>
        </div>
      )}

      {/* No results */}
      {!isRunning && lastData && results.length === 0 && (
        <div className="aventos-card flex flex-col items-center gap-3 py-12 text-center">
          <Linkedin className="w-10 h-10 text-blue-400 opacity-20" />
          <p className="text-[#C4E9F9]/40 text-sm">Nenhum resultado encontrado. Tente outros termos.</p>
        </div>
      )}

      {/* Results */}
      {!isRunning && displayed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-[#C4E9F9]/25 text-right px-1">
            {displayed.length} resultado{displayed.length !== 1 ? 's' : ''} ·{' '}
            {lastData?.searchedAt
              ? new Date(lastData.searchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : ''} · cache 2 h
          </p>

          {displayed.map((r: any, idx: number) => (
            <a
              key={idx}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="aventos-card block p-4 hover:border-blue-500/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                {/* Badge */}
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border mt-0.5 shrink-0 ${CAT_COLOR[r.categoria]}`}>
                  {CAT_ICON[r.categoria]}
                  {CAT_LABEL[r.categoria]}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition leading-snug">
                      {r.titulo}
                    </p>
                    <ExternalLink className="w-3.5 h-3.5 text-[#C4E9F9]/20 group-hover:text-blue-400 transition shrink-0 mt-0.5" />
                  </div>
                  {r.snippet && (
                    <p className="text-xs text-[#C4E9F9]/50 mt-1 line-clamp-2 leading-relaxed">
                      {r.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {r.slug && (
                      <span className="text-[10px] text-[#C4E9F9]/30 font-mono">/{r.slug}</span>
                    )}
                    <span className="text-[10px] bg-white/5 text-[#C4E9F9]/30 px-1.5 py-0.5 rounded border border-white/8">
                      {r.termoBuscado}
                    </span>
                    {r.displayLink && (
                      <span className="text-[10px] text-[#C4E9F9]/20">{r.displayLink}</span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#C4E9F9]/15 text-center pb-2">
        Google Custom Search API · <span className="font-mono">site:linkedin.com</span> · conteúdo público ·
        consulte <span className="font-mono">n8n/README_n8n.md</span> para automação diária
      </p>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <Linkedin className="w-6 h-6 text-blue-400" />
        LinkedIn — Busca CRI
      </h2>
      <p className="text-[#C4E9F9]/40 text-sm mt-1">
        Google CSE · <span className="font-mono text-[#C4E9F9]/30">site:linkedin.com</span> ·
        posts, perfis e empresas · 100 buscas/dia gratuitas
      </p>
    </div>
  );
}
