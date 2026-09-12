-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AcaoAuditoria" ADD VALUE 'ANONIMIZACAO';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'ACESSO_PORTAL';

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "exigeTrocaSenha" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "documento_conteudo" (
    "documentoId" UUID NOT NULL,
    "conteudoCifrado" BYTEA NOT NULL,
    "versaoChave" INTEGER NOT NULL,

    CONSTRAINT "documento_conteudo_pkey" PRIMARY KEY ("documentoId")
);

-- CreateTable
CREATE TABLE "acesso_portal" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3),
    "quantidadeAcessos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "acesso_portal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acesso_portal_tokenHash_key" ON "acesso_portal"("tokenHash");

-- CreateIndex
CREATE INDEX "acesso_portal_clienteId_revogadoEm_idx" ON "acesso_portal"("clienteId", "revogadoEm");

-- AddForeignKey
ALTER TABLE "documento_conteudo" ADD CONSTRAINT "documento_conteudo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_portal" ADD CONSTRAINT "acesso_portal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_portal" ADD CONSTRAINT "acesso_portal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Invariantes de produto da Fase 3/4 (mesma filosofia da migration de
-- invariantes: a regra vive no banco, que é a última fronteira).
-- =============================================================================

-- Pagamento é ato datado e valorado. Sem data e valor não há "PAGO".
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_pagamento_datado" CHECK (
  "status" <> 'PAGO' OR ("pagoEm" IS NOT NULL AND "valorPago" IS NOT NULL)
);
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "lancamento_honorarios" ADD CONSTRAINT "lancamento_valor_positivo" CHECK ("valor" > 0);

-- Link do portal nasce com validade futura.
ALTER TABLE "acesso_portal" ADD CONSTRAINT "acesso_portal_validade" CHECK ("expiraEm" > "criadoEm");

-- Template sem validação anti-promessa NÃO pode ser usado em envio, e
-- template inativo tampouco. Regra cruzada entre tabelas: trigger.
CREATE OR REPLACE FUNCTION hrs_exige_template_validado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_validado TIMESTAMP(3);
  v_ativo BOOLEAN;
BEGIN
  SELECT "validadoEm", "ativo" INTO v_validado, v_ativo
    FROM "template_mensagem" WHERE "id" = NEW."templateId";
  IF v_validado IS NULL THEN
    RAISE EXCEPTION 'Template sem validacao anti-promessa nao pode ser usado em envio.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Template inativo nao pode ser usado em envio.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER envio_exige_template_validado
  BEFORE INSERT ON "envio_mensagem"
  FOR EACH ROW EXECUTE FUNCTION hrs_exige_template_validado();

-- Envio de mensagem é registro de comunicação com o cliente: não se apaga.
CREATE TRIGGER envio_mensagem_sem_delete
  BEFORE DELETE ON "envio_mensagem"
  FOR EACH STATEMENT EXECUTE FUNCTION hrs_bloqueia_alteracao();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hrs_app') THEN
    REVOKE DELETE ON TABLE "envio_mensagem" FROM hrs_app;
  END IF;
END
$$;
