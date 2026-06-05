import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw, ExternalLink, Loader2, AlertCircle, Database } from "lucide-react";

export function RizaSecEmissoes() {
  const [forceRefresh, setForceRefresh] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = trpc.rizasec.getEmissoes.useQuery(
    { forceRefresh },
    { enabled: true, retry: 1, staleTime: 55 * 60 * 1000 }
  );

  const handleRefresh = async () => {
    setForceRefresh(true);
    await refetch();
    setForceRefresh(false);
  };

  const emissoes = data?.emissoes ?? [];
  const cacheInfo = data?.cacheInfo;

  return (
    <div className="space-y-6 aventos-fadein">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="aventos-heading text-2xl sm:text-3xl text-white mb-1">
            Emissões RizaSec
          </h2>
          <p className="text-[#C4E9F9]/50 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Dados extraídos de{" "}
            <a
              href="https://investidor.rizasec.com/emissoes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#16A085] hover:underline inline-flex items-center gap-1"
            >
              investidor.rizasec.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {cacheInfo?.cached && cacheInfo.fetchedAt && (
            <span className="text-[#C4E9F9]/40 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Cache: {new Date(cacheInfo.fetchedAt).toLocaleTimeString("pt-BR")}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16A085]/20 border border-[#16A085]/30 text-[#16A085] text-sm font-medium hover:bg-[#16A085]/30 transition-all disabled:opacity-50"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isFetching ? "Buscando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Loading inicial */}
      {isLoading && (
        <div className="aventos-card flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-10 h-10 text-[#16A085] animate-spin" />
          <p className="text-[#C4E9F9]/70 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Abrindo browser e extraindo dados da RizaSec...
          </p>
          <p className="text-[#C4E9F9]/40 text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Isso pode levar alguns segundos na primeira vez
          </p>
        </div>
      )}

      {/* Erro */}
      {error && !isLoading && (
        <div className="aventos-card border border-red-500/30 bg-red-500/5 flex items-start gap-3 p-5">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 font-medium text-sm">Erro ao buscar dados</p>
            <p className="text-red-400/70 text-xs mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Sem dados */}
      {!isLoading && !error && emissoes.length === 0 && (
        <div className="aventos-card flex flex-col items-center justify-center py-16 gap-3">
          <Database className="w-10 h-10 text-[#C4E9F9]/20" />
          <p className="text-[#C4E9F9]/50 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Nenhuma emissão encontrada
          </p>
        </div>
      )}

      {/* Tabela de emissões */}
      {!isLoading && emissoes.length > 0 && (
        <div className="aventos-card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-[#C4E9F9]/70 text-sm font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {emissoes.length} emissões encontradas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {["Código", "Nome", "Classe", "Taxa", "Data Emissão", "Data Vencimento", "Status", "Valor Total", "Saldo Disponível"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[10px] font-semibold text-[#C4E9F9]/40 uppercase tracking-widest whitespace-nowrap"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emissoes.map((e, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#3691ED]">
                      {e.codigo || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/90 max-w-[240px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      <span className="line-clamp-2">{e.nome || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/70 whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.classe || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#16A085] font-medium whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.taxa || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/60 whitespace-nowrap text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.dataEmissao || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/60 whitespace-nowrap text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.dataVencimento || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/60 whitespace-nowrap text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.valorTotal || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C4E9F9]/60 whitespace-nowrap text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {e.saldoDisponivel || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-[#C4E9F9]/30 text-xs">—</span>;

  const s = status.toLowerCase();
  let cls = "bg-white/10 text-[#C4E9F9]/60";
  if (s.includes("ativo") || s.includes("active") || s.includes("em andamento")) {
    cls = "bg-[#16A085]/15 text-[#16A085] border border-[#16A085]/30";
  } else if (s.includes("encerrado") || s.includes("closed") || s.includes("vencido")) {
    cls = "bg-red-500/15 text-red-400 border border-red-500/30";
  } else if (s.includes("captando") || s.includes("open") || s.includes("oferta")) {
    cls = "bg-blue-500/15 text-blue-300 border border-blue-500/30";
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {status}
    </span>
  );
}
