# Aventos-CRI-DASHBOARD — Workflow LinkedIn Search

Workflow n8n Cloud que busca conteúdo público sobre CRI no LinkedIn via
**Google Custom Search API** (gratuita, oficial, 100 buscas/dia), salva no
Postgres e gera CSV no Google Drive.

## Arquitetura

```
[Cron 8h] →
          ── Configuração → Gerar Queries → Google CSE → Parse → Dedup ─┬─ Postgres (upsert)
[Manual]  →                                                              └─ CSV → Google Drive
```

**Custo:** zero. Google CSE free = 100 buscas/dia. Workflow consome
9 buscas/dia (3 termos × 3 categorias).

---

## Passo 1 — Criar o Google Custom Search Engine (CSE)

Esse é o substituto gratuito do SerpAPI. Leva 5 minutos.

### 1.1 Criar o motor de busca

1. Acesse: <https://programmablesearchengine.google.com/controlpanel/create>
2. Em **"Sites a pesquisar"**, adicione:
   - `linkedin.com/posts/*`
   - `linkedin.com/in/*`
   - `linkedin.com/company/*`
3. Marque **"Pesquisar em toda a web"** (importante, senão só indexa esses 3)
4. Dê um nome: `Aventos CRI LinkedIn`
5. Crie e **copie o "ID do mecanismo de pesquisa"** (formato: `017abc...:xyz`)
   → esse é seu **CSE ID**

### 1.2 Criar a API Key

1. Acesse: <https://console.cloud.google.com/apis/credentials>
2. Crie um projeto (ou use existente) — chame de `aventos-cri`
3. **Ativar API:** vá em "APIs e Serviços → Biblioteca" e ative
   **"Custom Search API"**
4. Volte em "Credenciais" → **Criar credencial → Chave de API**
5. Copie a chave (formato: `AIzaSy...`)
6. (Recomendado) Restrinja: **Restrições de API → Custom Search API**

Agora você tem dois valores:
- `GOOGLE_CSE_ID`  → vai no `.env` do servidor e no nó "Configuração" do workflow
- `GOOGLE_CSE_KEY` → vai no `.env` do servidor e numa credencial do n8n

---

## Passo 2 — Configurar variáveis no servidor do dashboard

Adicione ao `.env` na raiz do projeto:

```env
GOOGLE_CSE_KEY=AIzaSy...   # API Key do Google Cloud
GOOGLE_CSE_ID=017abc...:xyz # ID do mecanismo de pesquisa
```

Reinicie o servidor. A aba LinkedIn do dashboard usará essas credenciais.

---

## Passo 3 — Importar o workflow no n8n Cloud (opcional, para automação diária)

1. No n8n Cloud, abra seu projeto **Aventos-CRI-DASHBOARD**
2. **Workflows → Import from File**
3. Selecione `n8n/aventos_cri_linkedin_workflow.json`
4. Vai aparecer com erros nos nós de credenciais — normal, vamos resolver

---

## Passo 4 — Configurar credenciais no n8n

### 4.1 Google Custom Search API Key

1. **Credentials → New → "HTTP Query Auth"**
2. Configure:
   - **Name:** `Google CSE API Key`
   - **Query Parameter Name:** `key`
   - **Query Parameter Value:** `AIzaSy...` (sua API key)
3. No nó **"Google CSE Search"**, selecione essa credencial em
   *Authentication → Generic Credential Type → Query Auth*

### 4.2 Postgres

1. **Credentials → New → "Postgres"**
2. Configure conforme seu provedor (Supabase, Neon, Railway).
   n8n Cloud não acessa banco local — precisa de host público.
3. Nos nós **"PG: Criar Tabela"** e **"PG: Upsert Resultados"**, selecione essa credencial

### 4.3 Google Drive

1. **Credentials → New → "Google Drive OAuth2 API"**
2. Faça o OAuth
3. No nó **"Google Drive: Upload CSV"**, troque `ID_DA_PASTA_AVENTOS_CRI`
   pelo ID real da pasta (parte da URL após `/folders/`)

---

## Passo 5 — Configurar parâmetros do workflow

Abra o nó **"Configuração"** e edite:

```javascript
cse_id: "SEU_CSE_ID_AQUI"
```

Para customizar termos:

```javascript
termos: ['CRI', 'securitização imobiliária', 'OPEA', 'True Securitizadora']
```

---

## Passo 6 — Testar e ativar

1. Clique em **"Executar Manualmente"**
2. Verifique Postgres: `SELECT COUNT(*) FROM aventos_cri_linkedin;`
3. Verifique Drive: arquivo `linkedin_cri_AAAA-MM-DD_HHMM.csv`
4. Ative o toggle **"Active"** para agendamento automático às 8h

---

## Estrutura da tabela Postgres

```sql
CREATE TABLE aventos_cri_linkedin (
  id           SERIAL PRIMARY KEY,
  categoria    TEXT,        -- 'posts' | 'perfis' | 'empresas'
  titulo       TEXT,
  url          TEXT UNIQUE, -- chave de deduplicação
  slug         TEXT,
  snippet      TEXT,
  display_link TEXT,
  data_busca   TIMESTAMP,
  criado_em    TIMESTAMP DEFAULT NOW()
);
```

### Queries úteis

```sql
-- Novidades da última semana
SELECT categoria, titulo, url, snippet
FROM aventos_cri_linkedin
WHERE criado_em >= NOW() - INTERVAL '7 days'
ORDER BY criado_em DESC;

-- Top empresas por aparições
SELECT slug, COUNT(*) AS aparicoes
FROM aventos_cri_linkedin
WHERE categoria = 'empresas'
GROUP BY slug ORDER BY aparicoes DESC;
```

---

## Limites

| Item                     | Limite                              |
|--------------------------|-------------------------------------|
| Google CSE free          | 100 buscas/dia                      |
| Resultados por busca     | máx 10 (free)                       |
| Workflow gasta           | 9 buscas/dia (3 termos × 3 cats)    |
| Cache no dashboard       | 2 horas em memória                  |
