-- ============================================================
-- Aventos CRI Dashboard — Schema Setup
-- Execute este arquivo no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/coitdqyhcaaxtmghpajy/editor
-- ============================================================

-- Tabela de usuários (autenticação local)
CREATE TABLE IF NOT EXISTS public.users (
  id            serial PRIMARY KEY,
  open_id       varchar(64)  NOT NULL UNIQUE,
  name          text,
  email         varchar(320),
  password_hash text,
  login_method  varchar(64),
  role          text NOT NULL DEFAULT 'user'   CHECK (role   IN ('user', 'admin')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now(),
  last_signed_in timestamp NOT NULL DEFAULT now()
);

-- CRIs aprovados
CREATE TABLE IF NOT EXISTS public.approved_cris (
  id          serial PRIMARY KEY,
  isin        varchar(30) NOT NULL UNIQUE,
  name        text        NOT NULL,
  data        jsonb       NOT NULL,
  approved_at timestamp   NOT NULL DEFAULT now()
);

-- CRIs pendentes de revisão
CREATE TABLE IF NOT EXISTS public.pending_cris (
  id           serial PRIMARY KEY,
  isin         varchar(30) NOT NULL UNIQUE,
  name         text        NOT NULL,
  debtor       text,
  securitizer  text,
  rate         text,
  maturity_date text,
  portfolio    text,
  lastro       text,
  estado       varchar(5),
  regiao       text,
  situacao     text,
  classe       text,
  motivo_filtro text,
  data         jsonb,
  scanned_at   timestamp   NOT NULL DEFAULT now()
);

-- ISINs rejeitados
CREATE TABLE IF NOT EXISTS public.rejected_isins (
  id          serial PRIMARY KEY,
  isin        varchar(30) NOT NULL UNIQUE,
  rejected_at timestamp   NOT NULL DEFAULT now()
);

-- Decisões de portfólio
CREATE TABLE IF NOT EXISTS public.portfolio_decisions (
  id         serial PRIMARY KEY,
  key        varchar(100) NOT NULL UNIQUE,
  value      jsonb        NOT NULL,
  updated_at timestamp    NOT NULL DEFAULT now()
);

-- Oportunidades de CRI
CREATE TABLE IF NOT EXISTS public.opportunities (
  id               serial PRIMARY KEY,
  cri_name         varchar(255) NOT NULL,
  debtor           varchar(255) NOT NULL,
  securitizer      varchar(255) NOT NULL,
  rate             varchar(100) NOT NULL,
  maturity_date    varchar(50),
  portfolio        text         NOT NULL,
  status           text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  source           varchar(100) NOT NULL,
  source_url       text,
  gemini_analysis  text,
  risk_level       text         CHECK (risk_level IN ('low', 'medium', 'high')),
  opportunity      text,
  discovered_at    timestamp    NOT NULL DEFAULT now(),
  accepted_at      timestamp,
  rejected_at      timestamp,
  created_at       timestamp    NOT NULL DEFAULT now(),
  updated_at       timestamp    NOT NULL DEFAULT now()
);

-- Habilita Row Level Security mas permite service_role total acesso
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_cris     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_cris      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejected_isins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities     ENABLE ROW LEVEL SECURITY;

-- Políticas: service_role (usado pelo backend) tem acesso total
CREATE POLICY "service_role_all" ON public.users             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.approved_cris     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.pending_cris      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.rejected_isins    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.portfolio_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.opportunities     FOR ALL USING (true) WITH CHECK (true);
