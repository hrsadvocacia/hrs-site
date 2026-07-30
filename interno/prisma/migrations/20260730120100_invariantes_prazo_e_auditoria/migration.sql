-- =============================================================================
-- Invariantes de produto aplicadas NO BANCO.
--
-- Motivo: o Prisma nao impede UPDATE/DELETE nem valida transicao de estado.
-- Se a garantia depender apenas do codigo da aplicacao, um script pontual, um
-- console de admin ou um bug futuro apaga prazo ou "confirma" prazo sem gente.
-- Perda de prazo gera responsabilidade civil do advogado: a regra vive no
-- banco, que e a ultima fronteira.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AUDITORIA E ACESSO A DADO SENSIVEL SAO APPEND-ONLY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hrs_bloqueia_alteracao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'A tabela % e append-only: operacao % nao permitida.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Triggers de nivel STATEMENT: disparam mesmo quando o comando atingiria zero
-- linhas, de modo que a TENTATIVA ja falha.
CREATE TRIGGER auditoria_sem_update
  BEFORE UPDATE ON "auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

CREATE TRIGGER auditoria_sem_delete
  BEFORE DELETE ON "auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

CREATE TRIGGER acesso_dado_sensivel_sem_update
  BEFORE UPDATE ON "acesso_dado_sensivel"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

CREATE TRIGGER acesso_dado_sensivel_sem_delete
  BEFORE DELETE ON "acesso_dado_sensivel"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

-- Prazo e publicacao nunca sao apagados. Prazo se cancela com justificativa;
-- publicacao se descarta na triagem, com motivo, mas o registro permanece.
CREATE TRIGGER prazo_sem_delete
  BEFORE DELETE ON "prazo"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

CREATE TRIGGER publicacao_sem_delete
  BEFORE DELETE ON "publicacao"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

-- Defesa em profundidade: o role da aplicacao nao recebe UPDATE/DELETE nessas
-- tabelas. Guardado por IF EXISTS para a migration rodar antes do provisionamento
-- do role (ambiente local, CI) sem quebrar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hrs_app') THEN
    REVOKE UPDATE, DELETE ON TABLE "auditoria"            FROM hrs_app;
    REVOKE UPDATE, DELETE ON TABLE "acesso_dado_sensivel" FROM hrs_app;
    REVOKE         DELETE ON TABLE "prazo"                FROM hrs_app;
    REVOKE         DELETE ON TABLE "publicacao"           FROM hrs_app;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. PRAZO DE CAPTURA AUTOMATICA NASCE PENDENTE DE CONFERENCIA
--    "O sistema assiste; o advogado decide."
-- -----------------------------------------------------------------------------

-- Enquanto nao houver confirmacao humana nominal, prazo capturado
-- automaticamente so pode estar em PENDENTE_CONFERENCIA ou CANCELADO.
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_captura_exige_conferencia" CHECK (
  "origem" <> 'CAPTURA_AUTOMATICA'
  OR "confirmadoPorId" IS NOT NULL
  OR "status" IN ('PENDENTE_CONFERENCIA', 'CANCELADO')
);

-- Confirmar exige quem confirmou e quando. Sem carimbo, nao ha confirmacao.
-- (Que o confirmante seja SOCIO ou ADVOGADO depende de outra tabela e e
--  verificado na aplicacao, com teste dedicado.)
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_confirmacao_nominal" CHECK (
  ("confirmadoPorId" IS NULL) = ("confirmadoEm" IS NULL)
);

ALTER TABLE "prazo" ADD CONSTRAINT "prazo_status_confirmado_exige_carimbo" CHECK (
  "status" <> 'CONFIRMADO' OR "confirmadoPorId" IS NOT NULL
);

-- Cancelamento exige autor e motivo — e o unico caminho de saida sem cumprimento.
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_cancelamento_motivado" CHECK (
  "status" <> 'CANCELADO'
  OR ("canceladoPorId" IS NOT NULL
      AND "canceladoEm" IS NOT NULL
      AND "justificativaCancelamento" IS NOT NULL
      AND length(btrim("justificativaCancelamento")) >= 10)
);

-- Cumprimento tambem e ato nominal.
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_cumprimento_nominal" CHECK (
  "status" <> 'CUMPRIDO' OR ("cumpridoPorId" IS NOT NULL AND "cumpridoEm" IS NOT NULL)
);

-- Sanidade do calculo: a data fatal nao pode preceder o inicio da contagem, e
-- a contagem nao pode comecar antes da publicacao considerada.
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_datas_coerentes" CHECK (
  "dataFatal" >= "dataInicioContagem"
  AND "dataInicioContagem" >= "dataPublicacaoConsiderada"
);

ALTER TABLE "prazo" ADD CONSTRAINT "prazo_dias_positivos" CHECK ("prazoDias" > 0);

-- Prazo em dobro exige fundamento explicito (CPC 183 / 186 / 229).
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_dobro_fundamentado" CHECK (
  "prazoEmDobro" = false OR "fundamentoDobro" IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 3. CAPTURA: "nao houve publicacao" e uma AFIRMACAO, nao um silencio
-- -----------------------------------------------------------------------------
ALTER TABLE "captura_diaria" ADD CONSTRAINT "captura_sem_publicacoes_exige_confirmacao" CHECK (
  "status" <> 'CONCLUIDA_SEM_PUBLICACOES' OR "confirmadaPorId" IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 4. PUBLICACAO: descarte exige motivo; orfa jamais some
-- -----------------------------------------------------------------------------
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_descarte_motivado" CHECK (
  "status" <> 'DESCARTADA'
  OR ("triadaPorId" IS NOT NULL
      AND "justificativaDescarte" IS NOT NULL
      AND length(btrim("justificativaDescarte")) >= 10)
);

ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_vinculada_exige_processo" CHECK (
  "status" <> 'VINCULADA' OR "processoId" IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 5. LEAD: sem consentimento datado nao ha contato (Prov. 205/2021 + LGPD art. 7, I)
-- -----------------------------------------------------------------------------
ALTER TABLE "lead" ADD CONSTRAINT "lead_consentimento_datado" CHECK (
  "solicitouContato" = false OR "consentimentoEm" IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. HONORARIOS: provisao de exito nunca e recebimento
-- -----------------------------------------------------------------------------
ALTER TABLE "lancamento_honorarios" ADD CONSTRAINT "provisao_nao_e_receita" CHECK (
  "provisao" = false OR ("recebido" = false AND "recebidoEm" IS NULL)
);

ALTER TABLE "lancamento_honorarios" ADD CONSTRAINT "recebimento_datado" CHECK (
  "recebido" = false OR "recebidoEm" IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. DEDUPLICACAO DE PUBLICACAO — correcao do comportamento de NULL
--
-- A chave de deduplicacao e (hashConteudo, numeroProcessoDigitos,
-- dataDisponibilizacao). Em SQL, NULL nunca e igual a NULL, entao o indice
-- UNIQUE padrao NAO deduplica justamente as publicacoes ORFAS — aquelas em que
-- o numero do processo nao foi identificado, que sao exatamente as que caem na
-- fila de triagem manual. Sem esta correcao, cada reexecucao do cron reinsere
-- a mesma publicacao orfa e inunda a triagem com duplicatas.
--
-- NULLS NOT DISTINCT (PostgreSQL 15+) trata NULL = NULL para fins do indice.
-- Divergencia consciente do datamodel do Prisma, que ainda nao expressa isso.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS "publicacao_hashConteudo_numeroProcessoDigitos_dataDisponibi_key";

CREATE UNIQUE INDEX "publicacao_hashConteudo_numeroProcessoDigitos_dataDisponibi_key"
  ON "publicacao" ("hashConteudo", "numeroProcessoDigitos", "dataDisponibilizacao")
  NULLS NOT DISTINCT;
