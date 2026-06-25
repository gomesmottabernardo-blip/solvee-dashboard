-- ========================================
-- SOLVEE DASHBOARD - SUPABASE SETUP
-- Execute esta query no SQL Editor do Supabase
-- ========================================

-- 1. Criar tabela de cache do HTML
CREATE TABLE IF NOT EXISTS dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  html_content TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT CHECK (status IN ('success', 'failed')) DEFAULT 'success'
);

-- 2. Criar tabela de usuários autorizados
CREATE TABLE IF NOT EXISTS authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Adicionar seu e-mail como primeiro usuário autorizado
INSERT INTO authorized_users (email)
VALUES ('gomesmotta.bernardo@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;

-- 5. Política de leitura: qualquer usuário autenticado pode ler o cache
CREATE POLICY "Usuarios autenticados podem ler cache" ON dashboard_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. Política de escrita: só o backend (via service role) escreve no cache
CREATE POLICY "Backend escreve no cache" ON dashboard_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Backend atualiza cache" ON dashboard_cache
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Política de leitura: qualquer usuário autenticado pode ver lista de autorizados
CREATE POLICY "Usuarios autenticados podem ler usuarios" ON authorized_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. Índices para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_fetched_at ON dashboard_cache(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_authorized_users_email ON authorized_users(email);
