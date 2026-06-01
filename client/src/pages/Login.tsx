import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, UserPlus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const LOGO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663345654824/tfHANsPeaatfagmj.png';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState('');

  const login = trpc.authLocal.login.useMutation({
    onSuccess: () => { window.location.href = '/'; },
    onError:   (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    login.mutate({ email, password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0B1426 0%, #0F1E36 50%, #0A1628 100%)' }}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(#C4E9F9 1px,transparent 1px),linear-gradient(90deg,#C4E9F9 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: '#16A085' }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl pointer-events-none" style={{ background: '#3691ED' }} />

      <div className="relative z-10 w-full max-w-sm mx-auto px-4">
        <div className="rounded-2xl p-8 border" style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(196,233,249,0.12)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <div className="flex flex-col items-center text-center mb-8">
            <img src={LOGO_URL} alt="Grupo Aventos" className="h-12 object-contain mx-auto mb-3"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p className="text-xs font-semibold uppercase tracking-[0.25em] w-full text-center"
              style={{ color: '#16A085', fontFamily: "'Poppins', sans-serif" }}>
              Dashboard de CRIs
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'rgba(196,233,249,0.5)', fontFamily: "'Poppins', sans-serif" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(196,233,249,0.3)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" autoComplete="email" required
                  className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(196,233,249,0.12)', fontFamily: "'Poppins', sans-serif" }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(22,160,133,0.6)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(196,233,249,0.12)')} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'rgba(196,233,249,0.5)', fontFamily: "'Poppins', sans-serif" }}>Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(196,233,249,0.3)' }} />
                <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  className="w-full rounded-lg py-2.5 pl-10 pr-10 text-sm text-white outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(196,233,249,0.12)', fontFamily: "'Poppins', sans-serif" }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(22,160,133,0.6)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(196,233,249,0.12)')} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(196,233,249,0.3)' }}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#fca5a5', fontFamily: "'Poppins', sans-serif" }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={login.isPending}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-70 mt-2"
              style={{ background: 'linear-gradient(135deg,#16A085 0%,#1abc9c 100%)', fontFamily: "'Poppins', sans-serif", boxShadow: '0 4px 20px rgba(22,160,133,0.35)' }}>
              {login.isPending ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <a href="/register"
              className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
              style={{ color: 'rgba(196,233,249,0.4)', fontFamily: "'Poppins', sans-serif" }}>
              <UserPlus className="w-3.5 h-3.5" />
              Criar conta
            </a>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(196,233,249,0.25)', fontFamily: "'Poppins', sans-serif" }}>
          © 2026 Grupo Aventos · Dados: CVM / ANBIMA
        </p>
      </div>
    </div>
  );
}
