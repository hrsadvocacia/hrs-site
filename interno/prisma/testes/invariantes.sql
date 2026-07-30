-- =============================================================================
-- Teste das invariantes de banco (Fase 0).
--
-- Uma CHECK constraint que nunca foi violada de proposito nao e uma garantia:
-- e uma esperanca. Este script tenta ativamente quebrar cada regra e falha
-- ruidosamente se o banco aceitar o que deveria recusar.
--
-- Execucao:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/testes/invariantes.sql
-- =============================================================================

\set ON_ERROR_STOP on
SET client_min_messages TO NOTICE;

-- Harness: executa `sql` esperando que ele SEJA REJEITADO.
CREATE OR REPLACE FUNCTION deve_falhar(nome text, sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PASS  %  (rejeitado: %)', nome, left(SQLERRM, 70);
    RETURN;
  END;
  RAISE EXCEPTION 'FALHA  %  -> o banco ACEITOU o que deveria recusar', nome;
END;
$$;

-- Harness: executa `sql` esperando que ele SEJA ACEITO.
CREATE OR REPLACE FUNCTION deve_passar(nome text, sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE NOTICE 'PASS  %', nome;
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'FALHA  %  -> o banco RECUSOU o que deveria aceitar: %', nome, SQLERRM;
END;
$$;

-- -----------------------------------------------------------------------------
-- Fixtures minimas
-- -----------------------------------------------------------------------------
INSERT INTO "usuario" (id, nome, email, perfil, unidade, "senhaHash", "atualizadoEm")
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Advogada Teste', 'adv@teste.local', 'ADVOGADO', 'GOIANIA', 'x', now()),
  ('22222222-2222-2222-2222-222222222222', 'Estagiario Teste', 'est@teste.local', 'ESTAGIARIO', 'GOIANIA', 'x', now());

INSERT INTO "tribunal" (id, codigo, nome, sigla, ramo, uf, "regimeContagemPadrao")
VALUES ('33333333-3333-3333-3333-333333333333', 'TRT18', 'TRT da 18a Regiao', 'TRT-18', 'TRABALHISTA', 'GO', 'DIAS_UTEIS_TRABALHISTA');

INSERT INTO "processo" (id, "numeroCnj", "numeroCnjDigitos", "cnjSequencial", "cnjDigito",
  "cnjAno", "cnjSegmento", "cnjTribunal", "cnjOrigem", "tribunalId", grau, "poloCliente",
  "advogadoResponsavelId", unidade, "atualizadoEm")
VALUES ('44444444-4444-4444-4444-444444444444', '0010123-45.2024.5.18.0011', '00101234520245180011',
  '0010123', '45', 2024, '5', '18', '0011', '33333333-3333-3333-3333-333333333333',
  'PRIMEIRO', 'ATIVO', '11111111-1111-1111-1111-111111111111', 'GOIANIA', now());

INSERT INTO "inscricao_oab" (id, "usuarioId", numero, uf)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '12345', 'GO');

-- Fragmento reutilizavel de colunas obrigatorias do prazo.
CREATE OR REPLACE FUNCTION sql_prazo(id text, origem text, status text, extra_cols text DEFAULT '', extra_vals text DEFAULT '')
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format($f$
    INSERT INTO "prazo" (id, "processoId", titulo, origem, status,
      "dataPublicacaoConsiderada", "dataInicioContagem", "prazoDias", "regimeContagem",
      "tribunalId", "dataFatal", "diasUteisContados", "feriadosAplicados",
      "fundamentoLegal", premissas, "versaoMotor", "responsavelId", "atualizadoEm" %s)
    VALUES (%L, '44444444-4444-4444-4444-444444444444', 'Contestacao', %L, %L,
      DATE '2026-03-02', DATE '2026-03-03', 8, 'DIAS_UTEIS_TRABALHISTA',
      '33333333-3333-3333-3333-333333333333', DATE '2026-03-12', 8, '[]'::jsonb,
      'CLT art. 775', '[]'::jsonb, 'motor-1.0.0', '11111111-1111-1111-1111-111111111111', now() %s)
  $f$, extra_cols, id, origem, status, extra_vals);
$$;

-- =============================================================================
-- 1. "O sistema assiste; o advogado decide."
-- =============================================================================
SELECT deve_falhar(
  'prazo automatico NAO pode nascer CONFIRMADO sem confirmante',
  sql_prazo('a0000000-0000-0000-0000-000000000001', 'CAPTURA_AUTOMATICA', 'CONFIRMADO'));

SELECT deve_falhar(
  'prazo automatico NAO pode pular para EM_TRATATIVA sem conferencia',
  sql_prazo('a0000000-0000-0000-0000-000000000002', 'CAPTURA_AUTOMATICA', 'EM_TRATATIVA'));

SELECT deve_passar(
  'prazo automatico nasce PENDENTE_CONFERENCIA',
  sql_prazo('a0000000-0000-0000-0000-000000000003', 'CAPTURA_AUTOMATICA', 'PENDENTE_CONFERENCIA'));

SELECT deve_passar(
  'prazo manual pode nascer CONFIRMADO com carimbo nominal',
  sql_prazo('a0000000-0000-0000-0000-000000000004', 'MANUAL', 'CONFIRMADO',
    ', "confirmadoPorId", "confirmadoEm"',
    $v$, '11111111-1111-1111-1111-111111111111', now()$v$));

SELECT deve_falhar(
  'confirmacao sem data e recusada',
  sql_prazo('a0000000-0000-0000-0000-000000000005', 'MANUAL', 'CONFIRMADO',
    ', "confirmadoPorId"', $v$, '11111111-1111-1111-1111-111111111111'$v$));

SELECT deve_falhar(
  'status CONFIRMADO sem confirmante e recusado',
  sql_prazo('a0000000-0000-0000-0000-000000000006', 'MANUAL', 'CONFIRMADO'));

-- =============================================================================
-- 2. Prazo nao se apaga
-- =============================================================================
SELECT deve_falhar(
  'DELETE em prazo e bloqueado por trigger',
  $$DELETE FROM "prazo" WHERE id = 'a0000000-0000-0000-0000-000000000003'$$);

SELECT deve_falhar(
  'cancelamento sem justificativa e recusado',
  $$UPDATE "prazo" SET status = 'CANCELADO', "canceladoPorId" = '11111111-1111-1111-1111-111111111111',
      "canceladoEm" = now() WHERE id = 'a0000000-0000-0000-0000-000000000003'$$);

SELECT deve_passar(
  'cancelamento com autor, data e motivo e aceito',
  $$UPDATE "prazo" SET status = 'CANCELADO', "canceladoPorId" = '11111111-1111-1111-1111-111111111111',
      "canceladoEm" = now(), "justificativaCancelamento" = 'Publicacao referente a outro processo (homonimo)'
    WHERE id = 'a0000000-0000-0000-0000-000000000003'$$);

SELECT deve_falhar(
  'cumprimento sem carimbo nominal e recusado',
  $$UPDATE "prazo" SET status = 'CUMPRIDO' WHERE id = 'a0000000-0000-0000-0000-000000000004'$$);

-- =============================================================================
-- 3. Coerencia do calculo
-- =============================================================================
-- INSERT explicito: passar "dataFatal" pelo harness duplicaria a coluna e o
-- teste passaria pelo motivo errado (erro de sintaxe em vez da CHECK).
SELECT deve_falhar(
  'dataFatal anterior ao inicio da contagem e recusada',
  $$INSERT INTO "prazo" (id, "processoId", titulo, origem, status,
      "dataPublicacaoConsiderada", "dataInicioContagem", "prazoDias", "regimeContagem",
      "tribunalId", "dataFatal", "diasUteisContados", "feriadosAplicados",
      "fundamentoLegal", premissas, "versaoMotor", "responsavelId", "atualizadoEm")
    VALUES ('a0000000-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444',
      'Contestacao', 'MANUAL', 'PENDENTE_CONFERENCIA',
      DATE '2026-03-02', DATE '2026-03-03', 8, 'DIAS_UTEIS_TRABALHISTA',
      '33333333-3333-3333-3333-333333333333', DATE '2020-01-01', 8, '[]'::jsonb,
      'CLT art. 775', '[]'::jsonb, 'motor-1.0.0',
      '11111111-1111-1111-1111-111111111111', now())$$);

SELECT deve_falhar(
  'prazo em dobro sem fundamento legal e recusado',
  sql_prazo('a0000000-0000-0000-0000-000000000008', 'MANUAL', 'PENDENTE_CONFERENCIA',
    ', "prazoEmDobro"', ', true'));

SELECT deve_passar(
  'prazo em dobro COM fundamento e aceito',
  sql_prazo('a0000000-0000-0000-0000-000000000009', 'MANUAL', 'PENDENTE_CONFERENCIA',
    ', "prazoEmDobro", "fundamentoDobro"', $v$, true, 'CPC art. 183 - Fazenda Publica'$v$));

-- =============================================================================
-- 4. Auditoria append-only
-- =============================================================================
INSERT INTO "auditoria" ("usuarioId", "usuarioEmail", acao, entidade, "entidadeId", descricao)
VALUES ('11111111-1111-1111-1111-111111111111', 'adv@teste.local', 'CONFIRMACAO_PRAZO',
        'prazo', 'a0000000-0000-0000-0000-000000000004', 'Prazo conferido e confirmado');

SELECT deve_falhar(
  'UPDATE em auditoria e bloqueado',
  $$UPDATE "auditoria" SET descricao = 'adulterado'$$);

SELECT deve_falhar(
  'DELETE em auditoria e bloqueado',
  $$DELETE FROM "auditoria"$$);

SELECT deve_falhar(
  'DELETE em auditoria com WHERE que nao casa TAMBEM e bloqueado',
  $$DELETE FROM "auditoria" WHERE id = -1$$);

-- =============================================================================
-- 5. Captura: "nao houve publicacao" e afirmacao humana
-- =============================================================================
SELECT deve_falhar(
  'captura CONCLUIDA_SEM_PUBLICACOES sem confirmacao humana e recusada',
  $$INSERT INTO "captura_diaria" (id, data, fonte, "inscricaoOabId", status)
    VALUES ('b0000000-0000-0000-0000-000000000001', DATE '2026-03-02', 'DJEN',
            '55555555-5555-5555-5555-555555555555', 'CONCLUIDA_SEM_PUBLICACOES')$$);

SELECT deve_passar(
  'captura CONCLUIDA_SEM_PUBLICACOES com confirmacao humana e aceita',
  $$INSERT INTO "captura_diaria" (id, data, fonte, "inscricaoOabId", status, "confirmadaPorId", "confirmadaEm")
    VALUES ('b0000000-0000-0000-0000-000000000002', DATE '2026-03-03', 'DJEN',
            '55555555-5555-5555-5555-555555555555', 'CONCLUIDA_SEM_PUBLICACOES',
            '11111111-1111-1111-1111-111111111111', now())$$);

SELECT deve_passar(
  'captura FALHA e registrada normalmente (evento visivel)',
  $$INSERT INTO "captura_diaria" (id, data, fonte, "inscricaoOabId", status, "mensagemErro")
    VALUES ('b0000000-0000-0000-0000-000000000003', DATE '2026-03-04', 'DJEN',
            '55555555-5555-5555-5555-555555555555', 'FALHA', 'HTTP 503 na consulta ao DJEN')$$);

-- =============================================================================
-- 6. Publicacao: nunca descartada em silencio
-- =============================================================================
SELECT deve_passar(
  'publicacao orfa e preservada para triagem',
  $$INSERT INTO "publicacao" (id, fonte, "hashConteudo", "dataDisponibilizacao", teor, "payloadBruto", status)
    VALUES ('c0000000-0000-0000-0000-000000000001', 'DJEN', 'hash-orfa', DATE '2026-03-02',
            'Intimacao...', '{}'::jsonb, 'ORFA')$$);

SELECT deve_falhar(
  'descarte de publicacao sem justificativa e recusado',
  $$UPDATE "publicacao" SET status = 'DESCARTADA',
      "triadaPorId" = '11111111-1111-1111-1111-111111111111'
    WHERE id = 'c0000000-0000-0000-0000-000000000001'$$);

SELECT deve_falhar(
  'publicacao VINCULADA sem processo e recusada',
  $$UPDATE "publicacao" SET status = 'VINCULADA'
    WHERE id = 'c0000000-0000-0000-0000-000000000001'$$);

SELECT deve_falhar(
  'DELETE em publicacao e bloqueado',
  $$DELETE FROM "publicacao" WHERE id = 'c0000000-0000-0000-0000-000000000001'$$);

SELECT deve_passar(
  'deduplicacao: mesmo hash + processo + data e recusado na 2a insercao',
  $$INSERT INTO "publicacao" (id, fonte, "hashConteudo", "dataDisponibilizacao", teor, "payloadBruto", status)
    VALUES ('c0000000-0000-0000-0000-000000000002', 'DJEN', 'hash-dup', DATE '2026-03-02',
            'Sentenca...', '{}'::jsonb, 'PENDENTE_TRIAGEM')$$);

-- Caso critico: publicacao ORFA tem numeroProcessoDigitos NULL. Com indice
-- UNIQUE padrao, NULL <> NULL e a duplicata passaria — inundando a triagem a
-- cada execucao do cron. Cobre a correcao NULLS NOT DISTINCT.
SELECT deve_falhar(
  'deduplicacao efetiva com numero de processo NULO (publicacao orfa)',
  $$INSERT INTO "publicacao" (id, fonte, "hashConteudo", "dataDisponibilizacao", teor, "payloadBruto", status)
    VALUES ('c0000000-0000-0000-0000-000000000003', 'DJEN', 'hash-dup', DATE '2026-03-02',
            'Sentenca...', '{}'::jsonb, 'PENDENTE_TRIAGEM')$$);

SELECT deve_passar(
  'deduplicacao: mesmo hash em data diferente NAO e duplicata',
  $$INSERT INTO "publicacao" (id, fonte, "hashConteudo", "dataDisponibilizacao", teor, "payloadBruto", status)
    VALUES ('c0000000-0000-0000-0000-000000000004', 'DJEN', 'hash-dup', DATE '2026-03-05',
            'Sentenca...', '{}'::jsonb, 'PENDENTE_TRIAGEM')$$);

SELECT deve_passar(
  'deduplicacao: mesmo hash e data, processos distintos NAO e duplicata',
  $$INSERT INTO "publicacao" (id, fonte, "hashConteudo", "numeroProcessoDigitos",
      "dataDisponibilizacao", teor, "payloadBruto", status)
    VALUES ('c0000000-0000-0000-0000-000000000005', 'DJEN', 'hash-dup', '00101234520245180011',
            DATE '2026-03-02', 'Sentenca...', '{}'::jsonb, 'PENDENTE_TRIAGEM')$$);

-- =============================================================================
-- 7. Prov. 205/2021 — lead sem consentimento datado nao vira contato
-- =============================================================================
SELECT deve_falhar(
  'lead marcado para contato sem consentimento datado e recusado',
  $$INSERT INTO "lead" (id, simulador, nome, whatsapp, payload, "solicitouContato")
    VALUES ('d0000000-0000-0000-0000-000000000001', 'PRECATORIO_RPV', 'Fulano', '86999999999',
            '{}'::jsonb, true)$$);

SELECT deve_passar(
  'lead com consentimento datado e aceito',
  $$INSERT INTO "lead" (id, simulador, nome, whatsapp, payload, "solicitouContato", "consentimentoEm")
    VALUES ('d0000000-0000-0000-0000-000000000002', 'PRECATORIO_RPV', 'Fulano', '86999999999',
            '{}'::jsonb, true, now())$$);

-- =============================================================================
-- 8. Financeiro — provisao de exito nunca e receita realizada
-- =============================================================================
SELECT deve_falhar(
  'provisao marcada como recebida e recusada',
  $$INSERT INTO "lancamento_honorarios" (id, natureza, valor, "dataReconhecimento", provisao, recebido, "recebidoEm", unidade)
    VALUES ('e0000000-0000-0000-0000-000000000001', 'CONTRATUAL', 1000, DATE '2026-03-02', true, true, DATE '2026-03-02', 'GOIANIA')$$);

SELECT deve_falhar(
  'recebimento sem data e recusado',
  $$INSERT INTO "lancamento_honorarios" (id, natureza, valor, "dataReconhecimento", recebido, unidade)
    VALUES ('e0000000-0000-0000-0000-000000000002', 'SUCUMBENCIA', 1000, DATE '2026-03-02', true, 'GOIANIA')$$);

SELECT deve_passar(
  'provisao de exito registrada como provisao e aceita',
  $$INSERT INTO "lancamento_honorarios" (id, natureza, valor, "dataReconhecimento", provisao, unidade)
    VALUES ('e0000000-0000-0000-0000-000000000003', 'CONTRATUAL', 50000, DATE '2026-03-02', true, 'GOIANIA')$$);

-- -----------------------------------------------------------------------------
DROP FUNCTION deve_falhar(text, text);
DROP FUNCTION deve_passar(text, text);
DROP FUNCTION sql_prazo(text, text, text, text, text);

\echo ''
\echo '================================================='
\echo ' TODAS AS INVARIANTES DE BANCO FORAM VERIFICADAS'
\echo '================================================='
