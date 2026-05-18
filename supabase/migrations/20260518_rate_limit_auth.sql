-- ─────────────────────────────────────────────────────────────────────────────
-- OLI Health Hub — Rate Limiting de Autenticação
-- Migration: 20260518_rate_limit_auth
-- Máx. 5 tentativas de login por IP em janela de 15 minutos.
-- Implementado via tabela de log + função RPC chamada antes do signIn.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabela de registro de tentativas
CREATE TABLE IF NOT EXISTS auth_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   text        NOT NULL,   -- email ou IP (o que estiver disponível)
  ip_address   inet,
  succeeded    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para consulta por janela de tempo
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_time
  ON auth_attempts (identifier, created_at DESC);

-- RLS: tabela protegida — somente funções server-side escrevem
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

-- Nenhuma política de SELECT para usuários comuns — dados de auditoria apenas
CREATE POLICY "auth_attempts_admin_read" ON auth_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- ── Função: check_auth_rate_limit ─────────────────────────────────────────────
-- Retorna true se o identificador ainda tem tentativas disponíveis.
-- Retorna false (bloqueado) se >= 5 tentativas falhas nos últimos 15 min.
-- Chamada pelo app via supabase.rpc('check_auth_rate_limit', { p_identifier })

CREATE OR REPLACE FUNCTION check_auth_rate_limit(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_window    interval := interval '15 minutes';
  v_max_tries integer  := 5;
  v_failed    integer;
  v_blocked_until timestamptz;
BEGIN
  SELECT COUNT(*)
  INTO   v_failed
  FROM   auth_attempts
  WHERE  identifier = p_identifier
    AND  succeeded  = false
    AND  created_at >= (now() - v_window);

  IF v_failed >= v_max_tries THEN
    -- Calcula quando o bloqueio expira (janela a partir da 1ª tentativa recente)
    SELECT MIN(created_at) + v_window
    INTO   v_blocked_until
    FROM   auth_attempts
    WHERE  identifier = p_identifier
      AND  succeeded  = false
      AND  created_at >= (now() - v_window);

    RETURN jsonb_build_object(
      'allowed',        false,
      'failed_count',   v_failed,
      'blocked_until',  v_blocked_until
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed',       true,
    'failed_count',  v_failed,
    'remaining',     v_max_tries - v_failed
  );
END;
$$;

-- ── Função: record_auth_attempt ───────────────────────────────────────────────
-- Registra tentativa de login (chamada pelo app após resultado do signIn).

CREATE OR REPLACE FUNCTION record_auth_attempt(
  p_identifier text,
  p_succeeded  boolean,
  p_ip         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO auth_attempts (identifier, ip_address, succeeded)
  VALUES (p_identifier, p_ip::inet, p_succeeded);

  -- Limpa tentativas antigas para controle de tamanho da tabela
  -- (mantém apenas últimas 24h por identificador)
  DELETE FROM auth_attempts
  WHERE identifier = p_identifier
    AND created_at < (now() - interval '24 hours');
END;
$$;

-- ── Função: clear_auth_attempts ───────────────────────────────────────────────
-- Limpa tentativas após login bem-sucedido ou manualmente pelo admin.

CREATE OR REPLACE FUNCTION clear_auth_attempts(p_identifier text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth_attempts WHERE identifier = p_identifier;
END;
$$;

-- ── Limpeza agendada (opcional — via pg_cron se disponível) ───────────────────
-- Mantém a tabela leve. Executar manualmente se pg_cron não estiver ativo:
-- DELETE FROM auth_attempts WHERE created_at < now() - interval '24 hours';
