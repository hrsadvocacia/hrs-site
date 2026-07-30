-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Unidade" AS ENUM ('GOIANIA', 'TERESINA', 'TIMON');

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('SOCIO', 'ADVOGADO', 'ESTAGIARIO', 'FINANCEIRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('LOGIN', 'LOGIN_FALHO', 'LOGOUT', 'LEITURA', 'ACESSO_DADO_SENSIVEL', 'CRIACAO', 'ALTERACAO', 'INATIVACAO', 'EXPORTACAO', 'CONFIRMACAO_PRAZO', 'CANCELAMENTO_PRAZO', 'TRIAGEM_PUBLICACAO', 'ENVIO_MENSAGEM', 'ALTERACAO_PERMISSAO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "OrigemCliente" AS ENUM ('INDICACAO', 'SIMULADOR_SITE', 'REDES_SOCIAIS', 'BALCAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "CategoriaDadoSensivel" AS ENUM ('LAUDO_MEDICO', 'CID', 'EXAME', 'ATESTADO', 'BENEFICIO_INSS', 'PERICIA_MEDICA', 'OUTRO');

-- CreateEnum
CREATE TYPE "RamoJustica" AS ENUM ('TRABALHISTA', 'FEDERAL', 'ESTADUAL', 'SUPERIOR');

-- CreateEnum
CREATE TYPE "RegimeContagem" AS ENUM ('DIAS_UTEIS_TRABALHISTA', 'DIAS_UTEIS_CPC', 'DIAS_CORRIDOS');

-- CreateEnum
CREATE TYPE "AbrangenciaFeriado" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "StatusCalendario" AS ENUM ('RASCUNHO', 'VIGENTE', 'SUBSTITUIDO');

-- CreateEnum
CREATE TYPE "TipoDiaNaoUtil" AS ENUM ('FERIADO_FORENSE', 'SUSPENSAO_EXPEDIENTE', 'PONTO_FACULTATIVO', 'RECESSO_FORENSE', 'SUSPENSAO_PRAZOS');

-- CreateEnum
CREATE TYPE "StatusRevisao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "GrauJurisdicao" AS ENUM ('PRIMEIRO', 'SEGUNDO', 'SUPERIOR', 'EXTRAORDINARIO');

-- CreateEnum
CREATE TYPE "PoloProcessual" AS ENUM ('ATIVO', 'PASSIVO', 'TERCEIRO_INTERESSADO');

-- CreateEnum
CREATE TYPE "SituacaoProcesso" AS ENUM ('EM_ANDAMENTO', 'SUSPENSO', 'ARQUIVADO', 'BAIXADO', 'EXTINTO', 'TRANSITADO_JULGADO', 'EM_EXECUCAO');

-- CreateEnum
CREATE TYPE "TipoParte" AS ENUM ('CLIENTE', 'PARTE_CONTRARIA', 'TERCEIRO');

-- CreateEnum
CREATE TYPE "OrigemMovimentacao" AS ENUM ('MANUAL', 'PUBLICACAO', 'DATAJUD');

-- CreateEnum
CREATE TYPE "OrigemPrazo" AS ENUM ('CAPTURA_AUTOMATICA', 'MANUAL', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "StatusPrazo" AS ENUM ('PENDENTE_CONFERENCIA', 'CONFIRMADO', 'EM_TRATATIVA', 'CUMPRIDO', 'PERDIDO', 'PREJUDICADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MarcoAlerta" AS ENUM ('D_10', 'D_5', 'D_3', 'D_2', 'D_1', 'D_0');

-- CreateEnum
CREATE TYPE "CanalAlerta" AS ENUM ('PAINEL', 'EMAIL');

-- CreateEnum
CREATE TYPE "FontePublicacao" AS ENUM ('DJEN', 'DEJT', 'DOMICILIO_JUDICIAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusPublicacao" AS ENUM ('PENDENTE_TRIAGEM', 'VINCULADA', 'ORFA', 'SUSPEITA_HOMONIMO', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "StatusCaptura" AS ENUM ('PENDENTE', 'EM_EXECUCAO', 'CONCLUIDA', 'CONCLUIDA_SEM_PUBLICACOES', 'FALHA');

-- CreateEnum
CREATE TYPE "TipoCompromisso" AS ENUM ('AUDIENCIA', 'PERICIA', 'REUNIAO', 'SUSTENTACAO_ORAL', 'DILIGENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusCompromisso" AS ENUM ('AGENDADO', 'REALIZADO', 'ADIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CanalAtendimento" AS ENUM ('PRESENCIAL', 'TELEFONE', 'WHATSAPP', 'EMAIL', 'VIDEOCHAMADA', 'OUTRO');

-- CreateEnum
CREATE TYPE "CategoriaTemplate" AS ENUM ('RECEBIMENTO_DOCUMENTO', 'AUDIENCIA_DESIGNADA', 'MOVIMENTACAO_PROCESSO', 'CONVITE_REUNIAO', 'COBRANCA_PARCELA');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'FALHA');

-- CreateEnum
CREATE TYPE "OrigemSimulador" AS ENUM ('PRECATORIO_RPV', 'VERBAS_RESCISORIAS', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('AGUARDANDO_CONTATO', 'EM_CONTATO', 'CONVERTIDO', 'DESCARTADO', 'SEM_CONSENTIMENTO');

-- CreateEnum
CREATE TYPE "ModalidadeHonorarios" AS ENUM ('FIXO', 'EXITO', 'MISTO', 'PRO_LABORE_MAIS_EXITO', 'CONSULTIVO_MENSAL');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('A_VENCER', 'PAGO', 'EM_ATRASO', 'RENEGOCIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'TRANSFERENCIA', 'BOLETO', 'DINHEIRO', 'CARTAO', 'DEPOSITO_JUDICIAL');

-- CreateEnum
CREATE TYPE "NaturezaHonorarios" AS ENUM ('CONTRATUAL', 'SUCUMBENCIA', 'CONTRATUAL_DESTACADO');

-- CreateEnum
CREATE TYPE "StatusAntivirus" AS ENUM ('PENDENTE', 'LIMPO', 'INFECTADO', 'ERRO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "unidade" "Unidade" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "senhaHash" TEXT NOT NULL,
    "senhaAtualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totpSegredoCifrado" BYTEA,
    "totpVersaoChave" INTEGER,
    "totpAtivadoEm" TIMESTAMP(3),
    "totpUltimoContador" BIGINT,
    "totpCodigosBackupHash" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ultimoLoginEm" TIMESTAMP(3),
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricao_oab" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "monitorada" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricao_oab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadaEm" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" UUID,
    "usuarioEmail" TEXT NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "camposAlterados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sucesso" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeSocial" TEXT,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT NOT NULL,
    "rg" TEXT,
    "orgaoExpedidor" TEXT,
    "dataNascimento" DATE,
    "estadoCivil" TEXT,
    "profissao" TEXT,
    "nacionalidade" TEXT DEFAULT 'brasileira',
    "origem" "OrigemCliente" NOT NULL,
    "origemDetalhe" TEXT,
    "unidadeResponsavel" "Unidade" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endereco_cliente" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "cep" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "endereco_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contato_cliente" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "tipo" "TipoContato" NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "autorizaContato" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contato_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dado_sensivel_cliente" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "categoria" "CategoriaDadoSensivel" NOT NULL,
    "dadoSensivel" BOOLEAN NOT NULL DEFAULT true,
    "conteudoCifrado" BYTEA NOT NULL,
    "versaoChave" INTEGER NOT NULL DEFAULT 1,
    "rotulo" TEXT NOT NULL,
    "baseLegal" TEXT NOT NULL DEFAULT 'LGPD art. 11, II, d — exercicio regular de direitos em processo',
    "descartarApos" DATE,
    "anonimizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dado_sensivel_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acesso_dado_sensivel" (
    "id" UUID NOT NULL,
    "dadoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalidade" TEXT,
    "ip" TEXT,

    CONSTRAINT "acesso_dado_sensivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribunal" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "ramo" "RamoJustica" NOT NULL,
    "uf" CHAR(2),
    "regimeContagemPadrao" "RegimeContagem" NOT NULL,
    "observaRecesso" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tribunal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orgao_julgador" (
    "id" UUID NOT NULL,
    "tribunalId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,

    CONSTRAINT "orgao_julgador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriado_geral" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "abrangencia" "AbrangenciaFeriado" NOT NULL,
    "uf" CHAR(2),
    "municipio" TEXT,
    "suspendeExpediente" BOOLEAN NOT NULL DEFAULT true,
    "fonte" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriado_geral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_tribunal" (
    "id" UUID NOT NULL,
    "tribunalId" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusCalendario" NOT NULL DEFAULT 'RASCUNHO',
    "vigenteDesde" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadoPorId" UUID,
    "revisadoEm" TIMESTAMP(3),

    CONSTRAINT "calendario_tribunal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dia_nao_util_tribunal" (
    "id" UUID NOT NULL,
    "calendarioId" UUID NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoDiaNaoUtil" NOT NULL,
    "descricao" TEXT NOT NULL,
    "suspendeExpediente" BOOLEAN NOT NULL DEFAULT true,
    "orgaoJulgadorId" UUID,
    "fonte" TEXT NOT NULL,
    "urlFonte" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dia_nao_util_tribunal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisao_anual_calendario" (
    "id" UUID NOT NULL,
    "tribunalId" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" "StatusRevisao" NOT NULL DEFAULT 'PENDENTE',
    "alertaDisparadoEm" TIMESTAMP(3),
    "concluidoPorId" UUID,
    "concluidoEm" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "revisao_anual_calendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo" (
    "id" UUID NOT NULL,
    "numeroCnj" TEXT NOT NULL,
    "numeroCnjDigitos" TEXT NOT NULL,
    "cnjSequencial" TEXT NOT NULL,
    "cnjDigito" CHAR(2) NOT NULL,
    "cnjAno" INTEGER NOT NULL,
    "cnjSegmento" CHAR(1) NOT NULL,
    "cnjTribunal" CHAR(2) NOT NULL,
    "cnjOrigem" TEXT NOT NULL,
    "tribunalId" UUID NOT NULL,
    "orgaoJulgadorId" UUID,
    "grau" "GrauJurisdicao" NOT NULL,
    "classeProcessual" TEXT,
    "assunto" TEXT,
    "valorCausa" DECIMAL(14,2),
    "poloCliente" "PoloProcessual" NOT NULL,
    "situacao" "SituacaoProcesso" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "dataDistribuicao" DATE,
    "segredoJustica" BOOLEAN NOT NULL DEFAULT false,
    "regimeContagem" "RegimeContagem",
    "advogadoResponsavelId" UUID NOT NULL,
    "unidade" "Unidade" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parte_processo" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "tipo" "TipoParte" NOT NULL,
    "polo" "PoloProcessual" NOT NULL,
    "clienteId" UUID,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "advogadoAdverso" TEXT,
    "oabAdverso" TEXT,

    CONSTRAINT "parte_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "origem" "OrigemMovimentacao" NOT NULL,
    "publicacaoId" UUID,
    "payloadBruto" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anotacao_privilegiada" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "privilegiado" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anotacao_privilegiada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prazo" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricaoAto" TEXT,
    "origem" "OrigemPrazo" NOT NULL,
    "status" "StatusPrazo" NOT NULL DEFAULT 'PENDENTE_CONFERENCIA',
    "publicacaoId" UUID,
    "dataDisponibilizacao" DATE,
    "dataPublicacaoConsiderada" DATE NOT NULL,
    "dataInicioContagem" DATE NOT NULL,
    "prazoDias" INTEGER NOT NULL,
    "regimeContagem" "RegimeContagem" NOT NULL,
    "tribunalId" UUID NOT NULL,
    "prazoEmDobro" BOOLEAN NOT NULL DEFAULT false,
    "fundamentoDobro" TEXT,
    "dataFatal" DATE NOT NULL,
    "diasUteisContados" INTEGER NOT NULL,
    "feriadosAplicados" JSONB NOT NULL,
    "fundamentoLegal" TEXT NOT NULL,
    "premissas" JSONB NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versaoMotor" TEXT NOT NULL,
    "calendarioId" UUID,
    "responsavelId" UUID NOT NULL,
    "confirmadoPorId" UUID,
    "confirmadoEm" TIMESTAMP(3),
    "primeiraTratativaEm" TIMESTAMP(3),
    "escalonadoParaId" UUID,
    "escalonadoEm" TIMESTAMP(3),
    "cumpridoPorId" UUID,
    "cumpridoEm" TIMESTAMP(3),
    "canceladoPorId" UUID,
    "canceladoEm" TIMESTAMP(3),
    "justificativaCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prazo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tratativa_prazo" (
    "id" UUID NOT NULL,
    "prazoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tratativa_prazo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta_prazo" (
    "id" UUID NOT NULL,
    "prazoId" UUID NOT NULL,
    "marco" "MarcoAlerta" NOT NULL,
    "canal" "CanalAlerta" NOT NULL,
    "destinatarioId" UUID NOT NULL,
    "escalonamento" BOOLEAN NOT NULL DEFAULT false,
    "enviadoEm" TIMESTAMP(3),
    "lidoEm" TIMESTAMP(3),
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_prazo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicacao" (
    "id" UUID NOT NULL,
    "fonte" "FontePublicacao" NOT NULL,
    "hashConteudo" TEXT NOT NULL,
    "numeroProcessoDigitos" TEXT,
    "dataDisponibilizacao" DATE NOT NULL,
    "dataPublicacao" DATE,
    "teor" TEXT NOT NULL,
    "payloadBruto" JSONB NOT NULL,
    "urlCertidao" TEXT,
    "inscricaoOabId" UUID,
    "nomeAdvogadoCitado" TEXT,
    "suspeitaHomonimo" BOOLEAN NOT NULL DEFAULT false,
    "processoId" UUID,
    "status" "StatusPublicacao" NOT NULL DEFAULT 'PENDENTE_TRIAGEM',
    "triadaPorId" UUID,
    "triadaEm" TIMESTAMP(3),
    "justificativaDescarte" TEXT,
    "capturaId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captura_diaria" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "fonte" "FontePublicacao" NOT NULL,
    "inscricaoOabId" UUID NOT NULL,
    "status" "StatusCaptura" NOT NULL DEFAULT 'PENDENTE',
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "quantidadeObtida" INTEGER,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "mensagemErro" TEXT,
    "httpStatus" INTEGER,
    "confirmadaPorId" UUID,
    "confirmadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "captura_diaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_domicilio" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "unidade" "Unidade" NOT NULL,
    "responsavelId" UUID NOT NULL,
    "confirmadoPorId" UUID,
    "confirmadoEm" TIMESTAMP(3),
    "houveNovidade" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_domicilio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromisso" (
    "id" UUID NOT NULL,
    "tipo" "TipoCompromisso" NOT NULL,
    "titulo" TEXT NOT NULL,
    "processoId" UUID,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "duracaoMinutos" INTEGER DEFAULT 60,
    "municipio" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "forum" TEXT,
    "endereco" TEXT,
    "virtual" BOOLEAN NOT NULL DEFAULT false,
    "linkVirtual" TEXT,
    "responsavelId" UUID NOT NULL,
    "unidadeResponsavel" "Unidade" NOT NULL,
    "exigeDeslocamento" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusCompromisso" NOT NULL DEFAULT 'AGENDADO',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "processoId" UUID,
    "data" TIMESTAMP(3) NOT NULL,
    "canal" "CanalAtendimento" NOT NULL,
    "atendidoPorId" UUID NOT NULL,
    "resumo" TEXT NOT NULL,
    "proximoPasso" TEXT,
    "proximoPassoEm" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_mensagem" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "canal" "TipoContato" NOT NULL,
    "categoria" "CategoriaTemplate" NOT NULL,
    "corpo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "nomeTemplateWhatsapp" TEXT,
    "aprovadoWhatsappEm" TIMESTAMP(3),
    "validadoEm" TIMESTAMP(3),
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_mensagem" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "canal" "TipoContato" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "variaveis" JSONB NOT NULL,
    "status" "StatusEnvio" NOT NULL DEFAULT 'PENDENTE',
    "enviadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "enviadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" UUID NOT NULL,
    "simulador" "OrigemSimulador" NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT,
    "payload" JSONB NOT NULL,
    "solicitouContato" BOOLEAN NOT NULL DEFAULT false,
    "consentimentoEm" TIMESTAMP(3),
    "origemUtm" JSONB,
    "status" "StatusLead" NOT NULL DEFAULT 'AGUARDANDO_CONTATO',
    "responsavelId" UUID,
    "clienteConvertidoId" UUID,
    "descartarApos" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_honorarios" (
    "id" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "modalidade" "ModalidadeHonorarios" NOT NULL,
    "valorFixo" DECIMAL(14,2),
    "percentualExito" DECIMAL(5,2),
    "valorProLabore" DECIMAL(14,2),
    "valorMensal" DECIMAL(14,2),
    "objeto" TEXT NOT NULL,
    "dataAssinatura" DATE NOT NULL,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE,
    "unidade" "Unidade" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_processo" (
    "contratoId" UUID NOT NULL,
    "processoId" UUID NOT NULL,

    CONSTRAINT "contrato_processo_pkey" PRIMARY KEY ("contratoId","processoId")
);

-- CreateTable
CREATE TABLE "parcela" (
    "id" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'A_VENCER',
    "pagoEm" DATE,
    "valorPago" DECIMAL(14,2),
    "formaPagamento" "FormaPagamento",
    "comprovanteId" UUID,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_honorarios" (
    "id" UUID NOT NULL,
    "natureza" "NaturezaHonorarios" NOT NULL,
    "contratoId" UUID,
    "processoId" UUID,
    "valor" DECIMAL(14,2) NOT NULL,
    "dataReconhecimento" DATE NOT NULL,
    "provisao" BOOLEAN NOT NULL DEFAULT false,
    "recebido" BOOLEAN NOT NULL DEFAULT false,
    "recebidoEm" DATE,
    "unidade" "Unidade" NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamento_honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "clienteId" UUID,
    "processoId" UUID,
    "nome" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "chaveStorage" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "documentoPaiId" UUID,
    "sensivel" BOOLEAN NOT NULL DEFAULT false,
    "privilegiado" BOOLEAN NOT NULL DEFAULT false,
    "antivirusStatus" "StatusAntivirus" NOT NULL DEFAULT 'PENDENTE',
    "antivirusVerificadoEm" TIMESTAMP(3),
    "enviadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_perfil_ativo_idx" ON "usuario"("perfil", "ativo");

-- CreateIndex
CREATE INDEX "usuario_unidade_idx" ON "usuario"("unidade");

-- CreateIndex
CREATE INDEX "inscricao_oab_monitorada_ativa_idx" ON "inscricao_oab"("monitorada", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_oab_numero_uf_key" ON "inscricao_oab"("numero", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_tokenHash_key" ON "sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "sessao_usuarioId_revogadaEm_idx" ON "sessao"("usuarioId", "revogadaEm");

-- CreateIndex
CREATE INDEX "sessao_expiraEm_idx" ON "sessao"("expiraEm");

-- CreateIndex
CREATE INDEX "auditoria_ocorridoEm_idx" ON "auditoria"("ocorridoEm");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_ocorridoEm_idx" ON "auditoria"("usuarioId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_acao_ocorridoEm_idx" ON "auditoria"("acao", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_cpfCnpj_key" ON "cliente"("cpfCnpj");

-- CreateIndex
CREATE INDEX "cliente_nome_idx" ON "cliente"("nome");

-- CreateIndex
CREATE INDEX "cliente_unidadeResponsavel_ativo_idx" ON "cliente"("unidadeResponsavel", "ativo");

-- CreateIndex
CREATE INDEX "cliente_origem_idx" ON "cliente"("origem");

-- CreateIndex
CREATE INDEX "endereco_cliente_clienteId_idx" ON "endereco_cliente"("clienteId");

-- CreateIndex
CREATE INDEX "contato_cliente_clienteId_idx" ON "contato_cliente"("clienteId");

-- CreateIndex
CREATE INDEX "dado_sensivel_cliente_clienteId_idx" ON "dado_sensivel_cliente"("clienteId");

-- CreateIndex
CREATE INDEX "dado_sensivel_cliente_descartarApos_idx" ON "dado_sensivel_cliente"("descartarApos");

-- CreateIndex
CREATE INDEX "acesso_dado_sensivel_dadoId_ocorridoEm_idx" ON "acesso_dado_sensivel"("dadoId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "acesso_dado_sensivel_usuarioId_ocorridoEm_idx" ON "acesso_dado_sensivel"("usuarioId", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "tribunal_codigo_key" ON "tribunal"("codigo");

-- CreateIndex
CREATE INDEX "orgao_julgador_municipio_uf_idx" ON "orgao_julgador"("municipio", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "orgao_julgador_tribunalId_nome_key" ON "orgao_julgador"("tribunalId", "nome");

-- CreateIndex
CREATE INDEX "feriado_geral_data_idx" ON "feriado_geral"("data");

-- CreateIndex
CREATE UNIQUE INDEX "feriado_geral_data_abrangencia_uf_municipio_key" ON "feriado_geral"("data", "abrangencia", "uf", "municipio");

-- CreateIndex
CREATE INDEX "calendario_tribunal_tribunalId_ano_status_idx" ON "calendario_tribunal"("tribunalId", "ano", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_tribunal_tribunalId_ano_versao_key" ON "calendario_tribunal"("tribunalId", "ano", "versao");

-- CreateIndex
CREATE INDEX "dia_nao_util_tribunal_calendarioId_data_idx" ON "dia_nao_util_tribunal"("calendarioId", "data");

-- CreateIndex
CREATE INDEX "dia_nao_util_tribunal_data_idx" ON "dia_nao_util_tribunal"("data");

-- CreateIndex
CREATE INDEX "revisao_anual_calendario_status_ano_idx" ON "revisao_anual_calendario"("status", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "revisao_anual_calendario_tribunalId_ano_key" ON "revisao_anual_calendario"("tribunalId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "processo_numeroCnj_key" ON "processo"("numeroCnj");

-- CreateIndex
CREATE UNIQUE INDEX "processo_numeroCnjDigitos_key" ON "processo"("numeroCnjDigitos");

-- CreateIndex
CREATE INDEX "processo_advogadoResponsavelId_situacao_idx" ON "processo"("advogadoResponsavelId", "situacao");

-- CreateIndex
CREATE INDEX "processo_unidade_situacao_idx" ON "processo"("unidade", "situacao");

-- CreateIndex
CREATE INDEX "processo_tribunalId_idx" ON "processo"("tribunalId");

-- CreateIndex
CREATE INDEX "parte_processo_processoId_idx" ON "parte_processo"("processoId");

-- CreateIndex
CREATE INDEX "parte_processo_clienteId_idx" ON "parte_processo"("clienteId");

-- CreateIndex
CREATE INDEX "movimentacao_processoId_data_idx" ON "movimentacao"("processoId", "data");

-- CreateIndex
CREATE INDEX "anotacao_privilegiada_processoId_idx" ON "anotacao_privilegiada"("processoId");

-- CreateIndex
CREATE INDEX "prazo_status_dataFatal_idx" ON "prazo"("status", "dataFatal");

-- CreateIndex
CREATE INDEX "prazo_responsavelId_status_dataFatal_idx" ON "prazo"("responsavelId", "status", "dataFatal");

-- CreateIndex
CREATE INDEX "prazo_processoId_idx" ON "prazo"("processoId");

-- CreateIndex
CREATE INDEX "prazo_dataFatal_idx" ON "prazo"("dataFatal");

-- CreateIndex
CREATE INDEX "tratativa_prazo_prazoId_criadoEm_idx" ON "tratativa_prazo"("prazoId", "criadoEm");

-- CreateIndex
CREATE INDEX "alerta_prazo_destinatarioId_lidoEm_idx" ON "alerta_prazo"("destinatarioId", "lidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "alerta_prazo_prazoId_marco_canal_destinatarioId_key" ON "alerta_prazo"("prazoId", "marco", "canal", "destinatarioId");

-- CreateIndex
CREATE INDEX "publicacao_status_dataDisponibilizacao_idx" ON "publicacao"("status", "dataDisponibilizacao");

-- CreateIndex
CREATE INDEX "publicacao_numeroProcessoDigitos_idx" ON "publicacao"("numeroProcessoDigitos");

-- CreateIndex
CREATE INDEX "publicacao_processoId_idx" ON "publicacao"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_hashConteudo_numeroProcessoDigitos_dataDisponibi_key" ON "publicacao"("hashConteudo", "numeroProcessoDigitos", "dataDisponibilizacao");

-- CreateIndex
CREATE INDEX "captura_diaria_data_status_idx" ON "captura_diaria"("data", "status");

-- CreateIndex
CREATE UNIQUE INDEX "captura_diaria_data_fonte_inscricaoOabId_key" ON "captura_diaria"("data", "fonte", "inscricaoOabId");

-- CreateIndex
CREATE INDEX "checklist_domicilio_data_confirmadoEm_idx" ON "checklist_domicilio"("data", "confirmadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_domicilio_data_unidade_key" ON "checklist_domicilio"("data", "unidade");

-- CreateIndex
CREATE INDEX "compromisso_responsavelId_dataHora_idx" ON "compromisso"("responsavelId", "dataHora");

-- CreateIndex
CREATE INDEX "compromisso_dataHora_status_idx" ON "compromisso"("dataHora", "status");

-- CreateIndex
CREATE INDEX "atendimento_clienteId_data_idx" ON "atendimento"("clienteId", "data");

-- CreateIndex
CREATE INDEX "atendimento_atendidoPorId_data_idx" ON "atendimento"("atendidoPorId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "template_mensagem_codigo_key" ON "template_mensagem"("codigo");

-- CreateIndex
CREATE INDEX "envio_mensagem_clienteId_criadoEm_idx" ON "envio_mensagem"("clienteId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "lead_clienteConvertidoId_key" ON "lead"("clienteConvertidoId");

-- CreateIndex
CREATE INDEX "lead_status_criadoEm_idx" ON "lead"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "lead_solicitouContato_idx" ON "lead"("solicitouContato");

-- CreateIndex
CREATE INDEX "contrato_honorarios_clienteId_ativo_idx" ON "contrato_honorarios"("clienteId", "ativo");

-- CreateIndex
CREATE INDEX "parcela_status_vencimento_idx" ON "parcela"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_contratoId_numero_key" ON "parcela"("contratoId", "numero");

-- CreateIndex
CREATE INDEX "lancamento_honorarios_natureza_dataReconhecimento_idx" ON "lancamento_honorarios"("natureza", "dataReconhecimento");

-- CreateIndex
CREATE INDEX "lancamento_honorarios_unidade_recebido_idx" ON "lancamento_honorarios"("unidade", "recebido");

-- CreateIndex
CREATE UNIQUE INDEX "documento_chaveStorage_key" ON "documento"("chaveStorage");

-- CreateIndex
CREATE INDEX "documento_processoId_idx" ON "documento"("processoId");

-- CreateIndex
CREATE INDEX "documento_clienteId_idx" ON "documento"("clienteId");

-- AddForeignKey
ALTER TABLE "inscricao_oab" ADD CONSTRAINT "inscricao_oab_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endereco_cliente" ADD CONSTRAINT "endereco_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contato_cliente" ADD CONSTRAINT "contato_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dado_sensivel_cliente" ADD CONSTRAINT "dado_sensivel_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_dado_sensivel" ADD CONSTRAINT "acesso_dado_sensivel_dadoId_fkey" FOREIGN KEY ("dadoId") REFERENCES "dado_sensivel_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_dado_sensivel" ADD CONSTRAINT "acesso_dado_sensivel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orgao_julgador" ADD CONSTRAINT "orgao_julgador_tribunalId_fkey" FOREIGN KEY ("tribunalId") REFERENCES "tribunal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_tribunal" ADD CONSTRAINT "calendario_tribunal_tribunalId_fkey" FOREIGN KEY ("tribunalId") REFERENCES "tribunal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_tribunal" ADD CONSTRAINT "calendario_tribunal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_tribunal" ADD CONSTRAINT "calendario_tribunal_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dia_nao_util_tribunal" ADD CONSTRAINT "dia_nao_util_tribunal_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "calendario_tribunal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dia_nao_util_tribunal" ADD CONSTRAINT "dia_nao_util_tribunal_orgaoJulgadorId_fkey" FOREIGN KEY ("orgaoJulgadorId") REFERENCES "orgao_julgador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisao_anual_calendario" ADD CONSTRAINT "revisao_anual_calendario_tribunalId_fkey" FOREIGN KEY ("tribunalId") REFERENCES "tribunal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisao_anual_calendario" ADD CONSTRAINT "revisao_anual_calendario_concluidoPorId_fkey" FOREIGN KEY ("concluidoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_tribunalId_fkey" FOREIGN KEY ("tribunalId") REFERENCES "tribunal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_orgaoJulgadorId_fkey" FOREIGN KEY ("orgaoJulgadorId") REFERENCES "orgao_julgador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_advogadoResponsavelId_fkey" FOREIGN KEY ("advogadoResponsavelId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_processo" ADD CONSTRAINT "parte_processo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_processo" ADD CONSTRAINT "parte_processo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacao_privilegiada" ADD CONSTRAINT "anotacao_privilegiada_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacao_privilegiada" ADD CONSTRAINT "anotacao_privilegiada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_tribunalId_fkey" FOREIGN KEY ("tribunalId") REFERENCES "tribunal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "calendario_tribunal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_escalonadoParaId_fkey" FOREIGN KEY ("escalonadoParaId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_cumpridoPorId_fkey" FOREIGN KEY ("cumpridoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratativa_prazo" ADD CONSTRAINT "tratativa_prazo_prazoId_fkey" FOREIGN KEY ("prazoId") REFERENCES "prazo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratativa_prazo" ADD CONSTRAINT "tratativa_prazo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_prazo" ADD CONSTRAINT "alerta_prazo_prazoId_fkey" FOREIGN KEY ("prazoId") REFERENCES "prazo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_prazo" ADD CONSTRAINT "alerta_prazo_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_inscricaoOabId_fkey" FOREIGN KEY ("inscricaoOabId") REFERENCES "inscricao_oab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_triadaPorId_fkey" FOREIGN KEY ("triadaPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_capturaId_fkey" FOREIGN KEY ("capturaId") REFERENCES "captura_diaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captura_diaria" ADD CONSTRAINT "captura_diaria_inscricaoOabId_fkey" FOREIGN KEY ("inscricaoOabId") REFERENCES "inscricao_oab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captura_diaria" ADD CONSTRAINT "captura_diaria_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_domicilio" ADD CONSTRAINT "checklist_domicilio_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_domicilio" ADD CONSTRAINT "checklist_domicilio_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_atendidoPorId_fkey" FOREIGN KEY ("atendidoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_mensagem" ADD CONSTRAINT "template_mensagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_mensagem" ADD CONSTRAINT "envio_mensagem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "template_mensagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_mensagem" ADD CONSTRAINT "envio_mensagem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_mensagem" ADD CONSTRAINT "envio_mensagem_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_clienteConvertidoId_fkey" FOREIGN KEY ("clienteConvertidoId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_honorarios" ADD CONSTRAINT "contrato_honorarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_processo" ADD CONSTRAINT "contrato_processo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contrato_honorarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_processo" ADD CONSTRAINT "contrato_processo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contrato_honorarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela" ADD CONSTRAINT "parcela_comprovanteId_fkey" FOREIGN KEY ("comprovanteId") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_honorarios" ADD CONSTRAINT "lancamento_honorarios_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contrato_honorarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_honorarios" ADD CONSTRAINT "lancamento_honorarios_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_documentoPaiId_fkey" FOREIGN KEY ("documentoPaiId") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
