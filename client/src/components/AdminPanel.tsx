import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Shield, Users, CheckCircle, XCircle, RefreshCw, Crown } from 'lucide-react';

export function AdminPanel() {
  const utils = trpc.useUtils();

  const { data: users = [], isLoading, refetch } = trpc.authLocal.listUsers.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const updateUser = trpc.authLocal.updateUser.useMutation({
    onSuccess: () => utils.authLocal.listUsers.invalidate(),
  });

  const [processing, setProcessing] = useState<number | null>(null);

  const handle = async (userId: number, patch: { role?: 'user' | 'admin'; status?: 'active' | 'inactive' | 'pending' }) => {
    setProcessing(userId);
    await updateUser.mutateAsync({ userId, ...patch });
    setProcessing(null);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      inactive: 'bg-red-500/15 text-red-400 border-red-500/25',
      pending:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    };
    const labels: Record<string, string> = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' };
    return (
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${map[s] ?? ''}`}>
        {labels[s] ?? s}
      </span>
    );
  };

  return (
    <div className="space-y-6 aventos-fadein">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="aventos-heading text-2xl text-white mb-1">Painel Admin</h2>
          <p className="text-sm" style={{ color: 'rgba(196,233,249,0.5)', fontFamily: "'Poppins', sans-serif" }}>
            Gerenciamento de usuários do sistema
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all hover:bg-white/10"
          style={{ borderColor: 'rgba(196,233,249,0.15)', color: 'rgba(196,233,249,0.6)', fontFamily: "'Poppins', sans-serif" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: users.length,                                          color: '#3691ED', icon: Users },
          { label: 'Ativos',   value: users.filter(u => u.status === 'active').length,       color: '#16A085', icon: CheckCircle },
          { label: 'Admins',   value: users.filter(u => u.role   === 'admin').length,        color: '#f59e0b', icon: Crown },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="aventos-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>{label}</p>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: "'Libre Baskerville', serif" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="aventos-card p-0 overflow-hidden">
        <div className="bg-white/5 px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3691ED]/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-[#3691ED]" />
          </div>
          <h3 className="font-semibold text-white text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Usuários cadastrados
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#16A085' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
            Nenhum usuário cadastrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Nome', 'Email', 'Role', 'Status', 'Cadastro', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 font-medium text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      <div className="flex items-center gap-2">
                        {u.role === 'admin' && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                        {u.name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'rgba(196,233,249,0.6)', fontFamily: "'Poppins', sans-serif" }}>
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${u.role === 'admin' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-white/5 text-white/50 border-white/10'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(u.status)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.status === 'active' ? (
                          <button onClick={() => handle(u.id, { status: 'inactive' })}
                            disabled={processing === u.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <XCircle className="w-3 h-3" /> Desativar
                          </button>
                        ) : (
                          <button onClick={() => handle(u.id, { status: 'active' })}
                            disabled={processing === u.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'rgba(22,160,133,0.1)', color: '#16A085', border: '1px solid rgba(22,160,133,0.2)' }}>
                            <CheckCircle className="w-3 h-3" /> Ativar
                          </button>
                        )}
                        {u.role !== 'admin' ? (
                          <button onClick={() => handle(u.id, { role: 'admin' })}
                            disabled={processing === u.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <Crown className="w-3 h-3" /> Admin
                          </button>
                        ) : (
                          <button onClick={() => handle(u.id, { role: 'user' })}
                            disabled={processing === u.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'rgba(196,233,249,0.05)', color: 'rgba(196,233,249,0.5)', border: '1px solid rgba(196,233,249,0.1)' }}>
                            <Users className="w-3 h-3" /> Usuário
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
