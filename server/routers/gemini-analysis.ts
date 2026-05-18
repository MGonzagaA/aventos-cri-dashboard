import Anthropic from "@anthropic-ai/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

// ─── Claude client (lazy-initialized) ────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// ─── Persona ──────────────────────────────────────────────────────────────────

const CRI_PERSONA = `Você é o especialista em CRI da Aventos, com mais de 12 anos de mercado. Sua função é responder perguntas sobre CRI de forma direta e precisa.

CONTEXTO QUE VOCÊ DOMINA:
- Estruturação, emissão e análise de CRIs no Brasil
- Securitizadoras: OPEA, Virgo, BARI, Éxes, Riza, True, Cibrasec, Fortesec, Habitasec, Vórtx, RB Capital, BRL Trust
- Portfólios da Aventos: Principal (investment grade), Centro-Oeste (agro/logística GO/MT/MS/DF), High Yield (spreads elevados)
- Mercado atual: Selic ~14,75%, IPCA ~5,5%, mercado de emissões aquecido
- Análise de crédito: LTV, alienação fiduciária, subordinação, rating, fluxo de caixa
- Regulação: Lei 9.514/97, CVM, ANBIMA, B3/CETIP

COMO VOCÊ RESPONDE:
- Escreva como um profissional experiente conversando, não como um relatório gerado por IA
- Varie a estrutura: às vezes um parágrafo direto é suficiente, outras vezes uma tabela ou lista faz sentido — use o formato que melhor serve à resposta, não o mais elaborado
- Evite iniciar parágrafos com as mesmas palavras repetidas
- Não use frases de transição óbvias como "Em resumo:", "É importante destacar que:", "Segue abaixo:", "Conforme mencionado:"
- Não abra com saudação, apresentação pessoal ou "Claro!"
- Não termine com "Fico à disposição" ou variações
- Seja direto: se a resposta tem duas frases, use duas frases. Não preencha com contexto desnecessário
- Use **negrito** apenas para termos técnicos ou números-chave — não para decorar o texto
- Nunca use emojis
- Responda sempre em português brasileiro
- Se a pergunta for ambígua, escolha a interpretação mais útil e responda — não peça esclarecimentos antes de dar alguma substância`;


// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { result: string; ts: number }>();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2h

// ─── Shared OpenAI-compatible chat completion call ────────────────────────────

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  label: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[${label}] HTTP ${res.status}: ${err.substring(0, 120)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Groq (primary) ───────────────────────────────────────────────────────────

// Models in priority order — Groq's fastest & most capable
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
  "llama3-8b-8192",
];

async function callGroq(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: CRI_PERSONA },
    ...history.slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  for (const model of GROQ_MODELS) {
    try {
      const text = await callOpenAICompat(
        "https://api.groq.com/openai/v1",
        apiKey,
        model,
        messages,
        `Groq/${model}`,
      );
      if (text) {
        console.log(`[Groq] OK com ${model}`);
        return text;
      }
    } catch (e: any) {
      console.warn(`[Groq] ${model} falhou: ${e.message?.substring(0, 80)}`);
      if (e.message?.includes("401") || e.message?.includes("403")) break;
    }
  }
  return "";
}

// ─── Claude (fallback 1) ──────────────────────────────────────────────────────

async function callClaude(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return "";

  try {
    const client = getClient();
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.slice(-8),
      { role: "user", content: userMessage },
    ];
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: CRI_PERSONA,
      messages,
    });
    const block = response.content[0];
    if (block.type === "text" && block.text) {
      console.log("[Claude] Resposta OK");
      return block.text;
    }
  } catch (error: any) {
    console.error("[Claude] Erro:", error.message?.substring(0, 120));
  }
  return "";
}

// ─── Gemini (fallback 2) ──────────────────────────────────────────────────────

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function callGemini(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: "user", parts: [{ text: CRI_PERSONA }] },
    { role: "model", parts: [{ text: "Entendido." }] },
    ...history.slice(-8).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) break;
        continue;
      }
      const data = await res.json();
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) { console.log(`[Gemini] OK com ${model}`); return text; }
    } catch (e: any) {
      console.warn(`[Gemini] ${model} erro: ${e.message?.substring(0, 60)}`);
    }
  }
  return "";
}

// ─── Main AI call — Groq → Claude → Gemini → fallback estático ───────────────

async function callAI(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  // 1. Groq (primary — rápido, gratuito com chave)
  const groq = await callGroq(userMessage, history);
  if (groq) return groq;

  // 2. Claude
  const claude = await callAI(userMessage, history);
  if (claude) return claude;

  // 3. Gemini
  const gemini = await callGemini(userMessage, history);
  if (gemini) return gemini;

  return "";
}

// ─── Fallback local (sem chave) ───────────────────────────────────────────────

interface Topic {
  keywords: string[];
  response: () => string;
}

const TOPICS: Topic[] = [
  {
    keywords: ["o que é cri", "definição", "explica cri", "certificado", "o que são", "como funciona"],
    response: () => `**O que é CRI? — Marina Cavalcanti, Aventos Capital**

CRI (Certificado de Recebíveis Imobiliários) é um título de renda fixa emitido exclusivamente por **securitizadoras**, lastreado em créditos imobiliários — contratos de aluguel, financiamentos, recebíveis de incorporadoras e imóveis rurais.

**Características centrais:**
- ✅ **Isento de IR e IOF** para pessoa física (Lei 9.514/97)
- 📊 Indexado ao **IPCA, CDI** ou taxa prefixada
- 🏠 Garantia real: alienação fiduciária do imóvel lastro
- ⏱️ Prazo típico: 3 a 15 anos

**Fluxo simplificado:**
Devedor (originador) → Securitizadora (estrutura e emite) → CRI → Investidor

Na Aventos trabalhamos com três carteiras: **Portfólio Principal** (conservador), **Centro-Oeste** (agro/logística) e **High Yield** (spreads elevados).`,
  },
  {
    keywords: ["ipca", "inflação", "spread ipca"],
    response: () => `**CRIs IPCA+Spread — Benchmarks de mercado**

| Spread | Perfil de risco | Exemplos |
|---|---|---|
| IPCA + 5–7% | Conservador (grau investimento) | Residencial, multidesenvolvedor |
| IPCA + 7–10% | Moderado | Logístico, agro, comercial AA |
| IPCA + 10–13% | Alto (High Yield) | Hotel, retrofit, varejo |
| IPCA + 13%+ | Especulativo | Subordinadas, estressados |

Com IPCA ~5,5% e spread de 9%, o rendimento nominal é **~14,5% a.a. isento de IR** — supera CDB tributado de mesmo prazo.

**Atenção:** em deflação, alguns CRIs têm rendimento mínimo contratual. Verifique o Termo de Securitização.`,
  },
  {
    keywords: ["cdi", "selic", "pós-fixado", "pos-fixado"],
    response: () => `**CRIs CDI+Spread**

Com Selic/CDI em ~14,75% a.a., CRIs CDI+ oferecem excelente relação risco-retorno.

| CDI + | Risco equivalente |
|---|---|
| 0,5–1,5% | Investment grade baixo |
| 1,5–3% | Moderado |
| 3–5% | Alto (High Yield) |

**CDI+3% hoje = 17,75% bruto** → para PF isento = equivale a ~22% num CDB tributado (alíquota 15%).

Prefira CDI+ quando Selic está em alta ou indefinida. Prefira IPCA+ quando há expectativa de inflação persistente e spreads IPCA atrativos.`,
  },
  {
    keywords: ["high yield", "alto rendimento", "maior retorno"],
    response: () => `**High Yield em CRIs — O que a Aventos monitora**

CRIs High Yield têm spreads acima de IPCA+10% ou CDI+3,5%.

**Setores típicos na carteira HY:**
- Hotelaria e resort (fluxo de caixa sazonal)
- Varejo e shopping (risco de ciclicidade)
- Retrofit e reestruturação de imóveis
- Laje corporativa em mercados secundários

**Por que investir:** retorno líquido de 18–21% a.a. para PF isento, com potencial de ganho de capital.

**Disciplina necessária:** máximo 15% por devedor, pelo menos 6–8 emissores diferentes, verificar subordinação e alienação fiduciária real (não cessão simples).`,
  },
  {
    keywords: ["risco", "garantia", "inadimplência", "default", "segurança"],
    response: () => `**Gestão de risco em CRIs — O framework da Aventos**

**Hierarquia de riscos:**
1. **Crédito:** devedor não paga → executa alienação fiduciária (~18 meses)
2. **Liquidez:** mercado secundário limitado → carregue até o vencimento
3. **Mercado:** marcação a mercado sobe/cai com taxa → irrelevante se levar ao vencimento
4. **Concentração:** 1 devedor único = risco binário → diversifique
5. **Jurídico:** questionamento da garantia → prefira alienação fiduciária (não hipoteca)

**Indicadores de alerta:**
- LTV > 80% → garantia insuficiente
- Devedor sem rating ou histórico → exige prêmio de risco maior
- Série subordinada sem sênior coberta → absorve perdas primeiro`,
  },
  {
    keywords: ["diversificação", "alocação", "carteira", "quanto investir"],
    response: () => `**Estratégia de alocação em CRIs — Recomendação Aventos**

| Perfil | Principal | Centro-Oeste | High Yield |
|---|---|---|---|
| Conservador | 70% | 20% | 10% |
| Moderado | 50% | 30% | 20% |
| Arrojado | 30% | 30% | 40% |

**Regras de ouro:**
- Máximo **20% em uma securitizadora**
- Máximo **15% em um devedor**
- Mínimo **8 CRIs diferentes** na carteira
- Misture indexadores: 60% IPCA + 40% CDI para proteção dupla
- Escale vencimentos: curto (<3a), médio (3–7a), longo (>7a)`,
  },
  {
    keywords: ["imposto", "ir", "isento", "tributação", "pessoa física"],
    response: () => `**Tributação de CRIs — Vantagem da isenção**

**Para Pessoa Física:** ✅ IR = 0% e IOF = 0% (Lei 9.514/97)

**Comparativo equivalente (CDI 14,75%):**
| Ativo | Taxa | IR (PF) | Líquido |
|---|---|---|---|
| CDB 2 anos | 100% CDI = 14,75% | 17,5% | 12,17% |
| LCI/LCA | 92% CDI = 13,57% | Isento | 13,57% |
| CRI CDI+2% | 16,75% | Isento | **16,75%** |
| CRI IPCA+8% | ~13,5% nominal | Isento | **13,5%** |

**Pessoa Jurídica:** alíquota regressiva de IR (22,5% até 15%), sem vantagem fiscal.

**Conclusão:** CRI com isenção de IR supera LCI/LCA no spread e supera CDB em ~4–6pp líquidos.`,
  },
  {
    keywords: ["securitizadora", "opea", "virgo", "bari", "exes", "riza", "cibrasec"],
    response: () => `**Securitizadoras — Referências de mercado**

| Securitizadora | Especialidade | Perfil |
|---|---|---|
| **OPEA** | Maior volume do país, imóveis comerciais | Investment grade |
| **Virgo** | Diversificada — galpões, lajes, agro | Moderado |
| **True** | Residencial e comercial médio porte | Conservador |
| **BARI** | Crédito agroindustrial | Centro-Oeste |
| **Éxes** | Operações estruturadas, HY | Agressivo |
| **Riza** | Gestão ativa, spreads elevados | HY/Moderado |
| **Cibrasec** | Pioneira, residencial popular | Conservador |
| **Fortesec** | Corporativo e infraestrutura | Moderado |
| **Vórtx** | Estruturação e mercado de capitais | Variado |
| **RB Capital** | Alto padrão, corporativo | IG/Moderado |

**Critérios de avaliação:** histórico de defaults, diversificação da carteira, presença de agente fiduciário independente.`,
  },
  {
    keywords: ["vencimento", "prazo", "reinvestimento", "maturidade"],
    response: () => `**Gestão de vencimentos — Estratégia de reinvestimento**

**Timeline ideal:**
- **12 meses antes:** mapear novas emissões equivalentes ou superiores
- **6 meses antes:** definir alocação do capital liberado
- **3 meses antes:** negociar entrada em novas emissões (período de bookbuilding)
- **No vencimento:** capital creditado em D+0

**O que monitorar:**
- Amortizações parciais mensais/trimestrais (verifique o cronograma no Termo)
- Cláusula de call (devedor pode resgatar antecipado → risco de reinvestimento em taxa menor)
- Possibilidade de venda no mercado secundário (CETIP/B3) antes do vencimento

**No dashboard Aventos:** a seção "CRIs Vencendo" monitora automaticamente todos os CRIs do mercado vencendo nos próximos 360 dias via dados CVM.`,
  },
];

function smartFallback(userMessage: string): string {
  const msg = userMessage.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  let bestScore = 0;
  let bestTopic: Topic | null = null;

  for (const topic of TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (msg.includes(kw)) score += kw.split(" ").length;
    }
    if (score > bestScore) { bestScore = score; bestTopic = topic; }
  }

  if (bestTopic && bestScore > 0) return bestTopic.response();

  return `Sem acesso à API no momento, não consigo responder com precisão sobre "${userMessage}".

Posso ajudar com estrutura e emissão de CRIs, taxas e spreads (IPCA+%, CDI+%), análise de crédito, securitizadoras, carteiras da Aventos (Principal, Centro-Oeste, High Yield), tributação para pessoa física e gestão de vencimentos. Tente reformular sua pergunta.`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const geminiAnalysisRouter = router({
  analyzeCRI: publicProcedure
    .input(z.object({
      criName: z.string(),
      rate: z.string(),
      maturityDate: z.string(),
      securitizer: z.string(),
      status: z.string(),
    }))
    .query(async ({ input }) => {
      const cacheKey = `cri-${input.criName}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;

      const prompt = `Analise o CRI abaixo em até 3 parágrafos: avalie risco de crédito, compare o spread com o mercado atual e dê uma recomendação objetiva.

CRI: ${input.criName}
Taxa: ${input.rate}
Vencimento: ${input.maturityDate}
Securitizadora: ${input.securitizer}
Status: ${input.status}`;

      const result = await callAI(prompt);
      if (result) cache.set(cacheKey, { result, ts: Date.now() });
      return result;
    }),

  analyzeNews: publicProcedure
    .input(z.object({ title: z.string(), summary: z.string() }))
    .query(async ({ input }) => {
      const cacheKey = `news-${input.title.substring(0, 30)}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;

      const prompt = `Analise esta notícia sobre o mercado de CRI: classifique o impacto (positivo/negativo/neutro), aponte oportunidades e riscos para investidores. Máximo 2 parágrafos.

Título: ${input.title}
Resumo: ${input.summary}`;

      const result = await callAI(prompt);
      if (result) cache.set(cacheKey, { result, ts: Date.now() });
      return result;
    }),

  chat: publicProcedure
    .input(z.object({
      message: z.string(),
      context: z.string().optional(),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[Claude Chat] Mensagem:", input.message.substring(0, 60));

      // Inject context into the message if provided
      const userMessage = input.context
        ? `${input.message}\n\n[Contexto do dashboard: ${input.context}]`
        : input.message;

      const history = (input.history ?? []).slice(-8); // last 4 exchanges

      let result = await callAI(userMessage, history);

      if (!result) {
        console.log("[Chat] Claude indisponível — usando base local");
        result = smartFallback(input.message);
      }

      return { response: result };
    }),

  generateRecommendations: publicProcedure
    .input(z.object({
      cris: z.array(z.object({ name: z.string(), rate: z.string(), status: z.string() })),
    }))
    .query(async ({ input }) => {
      const crisList = input.cris.map(c => `- ${c.name}: ${c.rate} (${c.status})`).join("\n");
      const prompt = `Analise esta carteira de CRIs e gere 3 a 5 recomendações prioritárias. Para cada uma: por que é relevante, risco/retorno esperado e horizonte sugerido.\n\n${crisList}`;
      return await callAI(prompt);
    }),
});
