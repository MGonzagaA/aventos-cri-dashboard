import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeminiChatProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

const QUICK_ACTIONS = [
  { label: 'Analisar carteira', message: 'Analise minha carteira de CRIs e sugira melhorias de diversificação.' },
  { label: 'Oportunidades de mercado', message: 'Quais são as melhores oportunidades de CRI no mercado atual?' },
  { label: 'Riscos relevantes', message: 'Quais são os principais riscos do mercado de CRI atualmente?' },
];

// Render markdown-like formatting without a full markdown lib
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold: **text**
    const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      return <hr key={i} className="border-slate-200 my-1" />;
    }
    // Table row (basic)
    if (line.trim().startsWith('|')) {
      return (
        <div key={i} className="font-mono text-xs text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    }
    // List item
    if (/^[\-\*] /.test(line.trim())) {
      return (
        <div key={i} className="flex gap-2 leading-relaxed">
          <span className="text-slate-400 mt-0.5 shrink-0">—</span>
          <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[\-\*] /, '') }} />
        </div>
      );
    }
    // Empty line
    if (!line.trim()) return <div key={i} className="h-2" />;
    // Heading: **Title**
    return (
      <p key={i} className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatted }} />
    );
  });
}

export function GeminiChat({ isOpen, onClose, context }: GeminiChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Especialista em CRI da Aventos. Pode perguntar sobre emissões, spreads, análise de crédito, carteiras ou qualquer dúvida sobre o mercado de CRI.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.gemini.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Não foi possível processar sua pergunta. Tente novamente.',
        timestamp: new Date(),
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.',
        timestamp: new Date(),
      }]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMutation.isPending]);

  const sendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);
    setInput('');

    const history = messages.slice(-8).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    chatMutation.mutate({ message: text, context: context || '', history });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-36 right-4 w-[400px] h-[560px] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
      style={{ background: '#f0f2f5', border: '1px solid #d1d5db' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: '#1a2e44', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: '#0f1e30' }}>
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663345654824/tfHANsPeaatfagmj.png"
            alt="Aventos" className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight">Especialista em CRI</p>
          <p className="text-teal-400 text-xs leading-tight">Aventos</p>
        </div>
        <button onClick={onClose}
          className="text-slate-400 hover:text-white transition p-1 rounded">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>

        {messages.map((message) => (
          <div key={message.id}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>

            {/* Sender label — only for assistant */}
            {message.role === 'assistant' && (
              <span className="text-[11px] font-semibold text-teal-700 mb-1 ml-1">
                Especialista CRI — Aventos
              </span>
            )}

            <div className={`max-w-[86%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              message.role === 'user'
                ? 'text-white rounded-tr-sm'
                : 'text-slate-800 rounded-tl-sm'
            }`}
              style={{
                background: message.role === 'user' ? '#1a2e44' : '#ffffff',
                border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
              }}>

              {/* Quick actions only on first assistant message */}
              {message.id === '1' ? (
                <div className="space-y-1">
                  {renderContent(message.content)}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {renderContent(message.content)}
                </div>
              )}

              <span className="block text-right mt-2 text-[10px] opacity-40">
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Quick action buttons after first message */}
            {message.id === '1' && messages.length === 1 && (
              <div className="mt-2 flex flex-col gap-2 w-full max-w-[86%]">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button key={idx} onClick={() => sendMessage(action.message)}
                    disabled={chatMutation.isPending}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-left transition-all"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      color: '#1a2e44',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#14b8a6';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                    }}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {chatMutation.isPending && (
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-semibold text-teal-700 mb-1 ml-1">
              Especialista CRI — Aventos
            </span>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2 shadow-sm"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400">Analisando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: '#f0f2f5', borderTop: '1px solid #e5e7eb' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite uma mensagem"
          disabled={chatMutation.isPending}
          className="flex-1 text-sm px-4 py-2.5 rounded-full outline-none"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            color: '#1a2e44',
          }}
        />
        <button type="submit"
          disabled={chatMutation.isPending || !input.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: '#1a2e44' }}>
          {chatMutation.isPending
            ? <Loader2 size={16} className="animate-spin text-white" />
            : <Send size={15} className="text-white" />}
        </button>
      </form>
    </div>
  );
}
