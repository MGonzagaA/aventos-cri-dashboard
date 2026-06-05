# Aventos CRI Dashboard

Guia de contexto para desenvolvimento neste repositório.

Dashboard interno da **Aventos Corporate** para monitoramento de Certificados de Recebíveis Imobiliários (CRIs). Reúne portfólios de CRI, indicadores de mercado, análises de refinanciamento, emissões da RizaSec e notícias do setor em uma SPA com backend tRPC.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 7 + Wouter (SPA) |
| Backend | Express + tRPC v11 |
| Banco | Supabase / PostgreSQL — acessado **somente via REST** (ver [Armadilhas](#convenções-e-armadilhas)) |
| ORM | Drizzle ORM |
| AI | Google Gemini · Anthropic Claude · Groq |
| Scraping | Playwright + Chromium (headless) |
| Auth | JWT em cookie `HttpOnly` |
| Linguagem | TypeScript ESM (`"type": "module"`) |
| Runtime | Node.js 24 |

---

## Comandos

```bash
npm run dev      # servidor de desenvolvimento com hot-reload (tsx watch) → localhost:3000
npm run build    # build de produção: Vite (client) + esbuild (server)
npm run check    # type-check TypeScript sem emitir
npm test         # vitest run (testes unitários dos routers)
```

> Sempre instale com `npm install --legacy-peer-deps` (conflitos de peer deps com React 19).

---

## Arquitetura

```
├── server/
│   ├── _core/
│   │   ├── index.ts            # entrypoint: Express + tRPC
│   │   ├── trpc.ts             # initTRPC, procedures, errorFormatter (Zod v4 → PT)
│   │   └── context.ts          # contexto tRPC (usuário autenticado via JWT)
│   ├── db/
│   │   ├── index.ts            # client Supabase REST (+ postgres lazy, não usado)
│   │   └── migrate.ts          # migrations + seed do admin via REST
│   ├── routers/
│   │   ├── anbima-data.ts      # fonte principal de CRIs (ZIPs do CVM/ANBIMA)
│   │   ├── cri-detail.ts       # detalhe por ISIN (CSV do CVM)
│   │   ├── cri-approval.ts     # workflow approve/reject de novos CRIs
│   │   ├── cri-offers-store.ts # ZIP CVM de ofertas públicas
│   │   ├── cvm-store.ts        # cache dos CSVs do CVM (classe, geral, fluxo)
│   │   ├── indicators.ts       # IPCA, CDI, IGP-M, Selic (API do BCB)
│   │   ├── gnews-emissions.ts  # Google News sobre CRIs
│   │   ├── rizasec.ts          # scraping Playwright da RizaSec
│   │   ├── rizasec-detail.ts   # detalhe das séries RizaSec (serve rizaDetails.json)
│   │   ├── securitizadoras.ts  # serve securitizadoras.json (Opea, HabitaSec, Bari)
│   │   ├── auth-local.ts       # login / register / logout (JWT)
│   │   └── ...                 # análise AI, LinkedIn, refinanciamento
│   ├── data/
│   │   ├── rizaDetails.json    # ~424 KB — detalhes das séries RizaSec (gerado, ver Pipelines)
│   │   └── securitizadoras.json # ~1.1 MB — 2.368 CRIs Opea/HabitaSec/Bari (gerado, ver Pipelines)
│   └── routers.ts              # appRouter — registra todos os routers
│
├── client/src/
│   ├── pages/Home.tsx          # dashboard principal (portfólios, filtros)
│   ├── hooks/useCRIData.ts     # busca CRIs (ANBIMA) + indicadores + notícias
│   ├── data/
│   │   ├── criData.ts          # 39 CRIs estáticos de fallback
│   │   └── criRizaSecData.ts   # ~157 KB — CRIs RizaSec embutidos (gerado, ver Pipelines)
│   ├── components/
│   │   ├── CRIDetailModal.tsx       # modal de detalhe via CVM (por ISIN)
│   │   └── RizaSecDetailModal.tsx   # modal de detalhe RizaSec (via tRPC)
│   └── lib/trpc.ts             # cliente tRPC tipado com AppRouter
│
├── drizzle/schema.ts           # tabelas: users, pendingCRIs, approvedCRIs, rejectedISINs
│
└── scripts/
    ├── gen-riza-ts.mjs              # gera criRizaSecData.ts + rizaDetails.json
    ├── gen-securitizadoras-json.mjs # gera securitizadoras.json (deduplica por ISIN)
    ├── scrape-riza-via-api.mjs      # coleta CRIs da RizaSec via API Virgo
    ├── scrape-riza-page-intercept.mjs  # enriquece taxas (CRIs antigos) via Playwright
    └── securitizadoras/
        ├── index.js            # scraper multi-securitizadora → CSVs por fonte
        └── recon.mjs           # reconhecimento da estrutura dos sites
```

---

## Domínio: Portfólios de CRI

| Carteira | Fonte | Qtd. aprox. |
|---|---|---|
| Portfólio Principal | ANBIMA/CVM (live) | ~1.500 |
| Centro-Oeste | ANBIMA/CVM (live) | ~300 |
| High Yield | ANBIMA/CVM (live) | ~200 |
| RizaSec | Estático (`criRizaSecData.ts`) | 352 |
| Securitizadoras | tRPC (`securitizadoras.json`) | ~2.368 |

**Fontes de dados:**

- **Portfólios live** (Principal, Centro-Oeste, High Yield): carregados em runtime via `trpc.anbima.get`, que baixa e processa os ZIPs do CVM. Os três são recortes filtrados da base ANBIMA/CVM, que contém **2.500+ CRIs** no total.
- **Fallback:** se a fonte live falhar, o client usa os **39 CRIs** estáticos de `criData.ts`.
- **RizaSec:** dataset estático e versionado (`criRizaSecData.ts`), regenerado pelos scripts de pipeline — não depende da API em runtime.
- **Securitizadoras:** servido via `trpc.securitizadoras.get` (lê `securitizadoras.json` em cache). Gerado por `gen-securitizadoras-json.mjs` a partir dos CSVs em `scripts/securitizadoras/`.

**Deduplicação:** `allCRIsData` em `Home.tsx` combina todas as fontes e filtra duplicatas por ISIN (prioridade: ANBIMA → RizaSec → Securitizadoras). O gerador `gen-securitizadoras-json.mjs` também deduplica por ISIN antes de salvar.

---

## Configuração (`.env`)

```env
NODE_ENV=development
PORT=3000

# Supabase (acesso apenas via REST — ver Armadilhas)
SUPABASE_URL=https://coitdqyhcaaxtmghpajy.supabase.co
SUPABASE_SERVICE_KEY=<legacy JWT key>

# Admin / Auth
ADMIN_EMAIL=gonzaga.cntts@gmail.com
JWT_SECRET=<string aleatória>

# AI
GEMINI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=

# Dados externos
APIFY_API_KEY=
APIFY_LINKEDIN_ACTOR_ID=
APIFY_LINKEDIN_POSTS_ACTOR_ID=
```

---

## Convenções e Armadilhas

### Supabase: somente REST
A rede **bloqueia a porta 5432** (PostgreSQL direto), então toda comunicação com o banco passa pela **REST API** do Supabase (`supabase-js`). Consequências:

- O `postgres` client (`sqlRaw`) é instanciado de forma lazy, mas **nunca conecta** — não escreva código que dependa de SQL direto.
- `migrate.ts` detecta o cenário e roda `seedAdminViaRest()` como caminho de seed.

### Zod v4 + tRPC v11
O Zod v4 serializa `ZodError.message` como um **array JSON de issues**, ilegível para o usuário final. O `errorFormatter` em `trpc.ts` intercepta erros `BAD_REQUEST` e os converte para mensagens em português.

### Autenticação
- Login via `auth-local.ts`, com **JWT** persistido em cookie `HttpOnly` (`session`).
- O usuário admin (`ADMIN_EMAIL`) é semeado no boot — ver `seedAdminViaRest()` em `migrate.ts`. A senha **não** está no `.env` documentado acima; confira a lógica de seed/credenciais em `auth-local.ts` antes de assumir um valor.
- **O frontend atual não exige login: o dashboard é público.** O fluxo de auth existe no backend, mas não está acoplado à UI.

---

## Pipelines de Dados

### RizaSec
Regenera os datasets estáticos da carteira RizaSec. Reexecutar após cada atualização da fonte.

1. **Coleta** — `scrape-riza-via-api.mjs` autentica na API `aks-prod.virgo.inc` e baixa os CRIs (a API retorna ~372 séries brutas).
2. **Enriquecimento** — `scrape-riza-page-intercept.mjs` complementa as taxas de CRIs antigos via Playwright.
3. **Geração** — `gen-riza-ts.mjs` consolida o resultado (352 CRIs) e escreve `client/src/data/criRizaSecData.ts` (~157 KB) e `server/data/rizaDetails.json` (~424 KB).

```bash
node scripts/gen-riza-ts.mjs
```

### Multi-Securitizadora
Scraper que gera CSVs por securitizadora + um consolidado, depois converte para JSON.

```bash
node scripts/securitizadoras/index.js        # gera os CSVs
node scripts/gen-securitizadoras-json.mjs    # converte para server/data/securitizadoras.json
```

| Securitizadora | Método | Qtd. |
|---|---|---|
| Opea | API REST | ~1.973 (após dedup) |
| HabitaSec | WordPress API | ~390 (após dedup) |
| Bari | Next.js (`_next/data`) | 5 |

> Sem fonte pública disponível: **RB Capital** e **Éxes**. Use `recon.mjs` para inspecionar a estrutura de um site antes de adicionar um novo scraper.

---

## Setup Local

```bash
# 1. Dependências
npm install --legacy-peer-deps

# 2. Criar .env com as variáveis da seção Configuração

# 3. Subir o servidor de desenvolvimento
npm run dev          # → http://localhost:3000
```

Tarefas opcionais (ver [Pipelines](#pipelines-de-dados)):

```bash
node scripts/gen-riza-ts.mjs                 # regenerar dados RizaSec
node scripts/securitizadoras/index.js        # scraper multi-securitizadora
node scripts/gen-securitizadoras-json.mjs    # regenerar securitizadoras.json
```

---

## Deploy (Render)

Configurado em `render.yaml` para o free tier de Node.js. Variáveis de ambiente são definidas manualmente no painel da Render.

| | |
|---|---|
| **Build** | `npm install --include=dev --legacy-peer-deps && npm run build` |
| **Start** | `node dist/index.js` |
