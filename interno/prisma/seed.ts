/**
 * Seed da estrutura inicial.
 *
 * ATENCAO ao e-mail das contas: ele e a IDENTIDADE DE LOGIN. Os enderecos
 * abaixo seguem o dominio do escritorio (hrsadvocacia.adv.br), mas se as caixas
 * reais forem outras — inclusive de outro provedor —, troque-os ANTES da
 * primeira execucao. Depois do seed, a correcao passa a exigir alteracao de
 * cadastro pela tela de Contas.
 *
 * O que ENTRA: estrutura verificavel — tribunais, orgaos julgadores, feriados
 * nacionais de lei federal, e as contas da equipe com as inscricoes na OAB
 * publicadas no site do escritorio.
 *
 * O que NAO entra: feriado estadual, feriado municipal e suspensao de
 * expediente por portaria. Eu nao tenho como verificar essas datas aqui, e
 * calendario errado perde prazo. Um feriado inventado e PIOR que um ausente,
 * porque parece correto. Eles entram pelo cadastro de calendario, com a fonte
 * registrada — e a revisao anual ja nasce PENDENTE para cada tribunal.
 *
 * Execucao:  npm run seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { cifrar, gerarHashSenha, gerarTokenAleatorio, versaoChaveAtual } from "../lib/cripto.ts";
import { gerarSegredoTotp, uriTotp } from "../lib/totp.ts";
import { feriadosNacionais } from "../lib/feriados.ts";
import { validarTexto } from "../lib/mensagens/compliance.ts";
import { variaveisIndevidas, type Categoria } from "../lib/mensagens/variaveis.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
});

const ANOS_CALENDARIO = [2026, 2027];

const TRIBUNAIS = [
  { codigo: "TRT18", sigla: "TRT-18", nome: "Tribunal Regional do Trabalho da 18ª Região", ramo: "TRABALHISTA", uf: "GO", regime: "DIAS_UTEIS_TRABALHISTA" },
  { codigo: "TRT22", sigla: "TRT-22", nome: "Tribunal Regional do Trabalho da 22ª Região", ramo: "TRABALHISTA", uf: "PI", regime: "DIAS_UTEIS_TRABALHISTA" },
  { codigo: "TRT16", sigla: "TRT-16", nome: "Tribunal Regional do Trabalho da 16ª Região", ramo: "TRABALHISTA", uf: "MA", regime: "DIAS_UTEIS_TRABALHISTA" },
  { codigo: "TST", sigla: "TST", nome: "Tribunal Superior do Trabalho", ramo: "TRABALHISTA", uf: null, regime: "DIAS_UTEIS_TRABALHISTA" },
  { codigo: "TRF1", sigla: "TRF-1", nome: "Tribunal Regional Federal da 1ª Região", ramo: "FEDERAL", uf: null, regime: "DIAS_UTEIS_CPC" },
  { codigo: "TJGO", sigla: "TJGO", nome: "Tribunal de Justiça do Estado de Goiás", ramo: "ESTADUAL", uf: "GO", regime: "DIAS_UTEIS_CPC" },
  { codigo: "TJPI", sigla: "TJPI", nome: "Tribunal de Justiça do Estado do Piauí", ramo: "ESTADUAL", uf: "PI", regime: "DIAS_UTEIS_CPC" },
  { codigo: "TJMA", sigla: "TJMA", nome: "Tribunal de Justiça do Estado do Maranhão", ramo: "ESTADUAL", uf: "MA", regime: "DIAS_UTEIS_CPC" },
  { codigo: "STJ", sigla: "STJ", nome: "Superior Tribunal de Justiça", ramo: "SUPERIOR", uf: null, regime: "DIAS_UTEIS_CPC" },
] as const;

/** Orgaos das tres pracas onde o escritorio atua. O MUNICIPIO importa: e ele
 *  que determina quais feriados municipais alcancam o prazo do processo. */
const ORGAOS: ReadonlyArray<{ tribunal: string; nome: string; municipio: string; uf: string }> = [
  { tribunal: "TRT18", nome: "Varas do Trabalho de Goiânia", municipio: "Goiânia", uf: "GO" },
  { tribunal: "TRT18", nome: "Vara do Trabalho de Anápolis", municipio: "Anápolis", uf: "GO" },
  { tribunal: "TRT22", nome: "Varas do Trabalho de Teresina", municipio: "Teresina", uf: "PI" },
  { tribunal: "TRT16", nome: "Vara do Trabalho de Timon", municipio: "Timon", uf: "MA" },
  { tribunal: "TRT16", nome: "Varas do Trabalho de São Luís", municipio: "São Luís", uf: "MA" },
  { tribunal: "TJGO", nome: "Comarca de Goiânia", municipio: "Goiânia", uf: "GO" },
  { tribunal: "TJPI", nome: "Comarca de Teresina", municipio: "Teresina", uf: "PI" },
  { tribunal: "TJMA", nome: "Comarca de Timon", municipio: "Timon", uf: "MA" },
  { tribunal: "TRF1", nome: "Subseção Judiciária de Goiânia", municipio: "Goiânia", uf: "GO" },
  { tribunal: "TRF1", nome: "Subseção Judiciária de Teresina", municipio: "Teresina", uf: "PI" },
];

/** Equipe conforme publicado em equipe.html do site institucional. */
const EQUIPE = [
  {
    nome: "Aluísio Henrique de Holanda Filho",
    email: "aluisio@hrsadvocacia.adv.br",
    perfil: "SOCIO",
    unidade: "TERESINA",
    oab: [{ numero: "8815", uf: "PI", principal: true }],
  },
  {
    nome: "Paulo Renand da Silva Ramalho",
    email: "paulo@hrsadvocacia.adv.br",
    perfil: "SOCIO",
    unidade: "TERESINA",
    oab: [{ numero: "22759", uf: "PI", principal: true }],
  },
  {
    nome: "Adrielly Sousa Oliveira",
    email: "adrielly@hrsadvocacia.adv.br",
    perfil: "SOCIO",
    unidade: "GOIANIA",
    oab: [{ numero: "76478", uf: "GO", principal: true }],
  },
  {
    nome: "Administração do sistema",
    email: "admin@hrsadvocacia.adv.br",
    perfil: "ADMIN",
    unidade: "GOIANIA",
    oab: [],
  },
] as const;

const TEMPLATES: ReadonlyArray<{
  codigo: string;
  titulo: string;
  canal: "EMAIL" | "WHATSAPP";
  categoria: Categoria;
  corpo: string;
}> = [
  {
    codigo: "DOC-RECEBIDO",
    titulo: "Documento recebido",
    canal: "WHATSAPP",
    categoria: "RECEBIMENTO_DOCUMENTO",
    corpo:
      "Olá, {{primeiro_nome}}. Recebemos o documento {{documento}} em {{data_recebimento}} " +
      "e ele já está com a equipe. Qualquer dúvida, fale com o escritório pelo {{telefone_escritorio}}. " +
      "{{escritorio}} — {{unidade}}.",
  },
  {
    codigo: "AUDIENCIA",
    titulo: "Audiência designada",
    canal: "WHATSAPP",
    categoria: "AUDIENCIA_DESIGNADA",
    corpo:
      "Olá, {{primeiro_nome}}. A audiência do processo {{processo}} foi designada para " +
      "{{data_audiencia}}, às {{hora_audiencia}}, em {{local}}. {{orientacoes}} " +
      "Em caso de impossibilidade, avise o escritório o quanto antes. {{advogado}} — {{escritorio}}.",
  },
  {
    codigo: "MOVIMENTACAO",
    titulo: "Movimentação no processo",
    canal: "EMAIL",
    categoria: "MOVIMENTACAO_PROCESSO",
    corpo:
      "Prezado(a) {{nome}},\n\nHouve movimentação no processo {{processo}} em {{data_movimentacao}}: " +
      "{{resumo_movimentacao}}.\n\nO escritório continua acompanhando e avisará a cada novo passo relevante. " +
      "Não é possível prever o desfecho nem a data de término.\n\nAtenciosamente,\n{{advogado}}\n{{escritorio}} — {{unidade}}",
  },
  {
    codigo: "REUNIAO",
    titulo: "Convite para reunião",
    canal: "WHATSAPP",
    categoria: "CONVITE_REUNIAO",
    corpo:
      "Olá, {{primeiro_nome}}. Gostaríamos de conversar sobre {{assunto}}. Propomos uma reunião em " +
      "{{data_reuniao}}, às {{hora_reuniao}}, em {{local}}. Confirma? {{advogado}} — {{escritorio}}.",
  },
  {
    codigo: "COBRANCA",
    titulo: "Lembrete de parcela de honorários",
    canal: "WHATSAPP",
    categoria: "COBRANCA_PARCELA",
    corpo:
      "Olá, {{primeiro_nome}}. Lembramos que a parcela {{numero_parcela}} do contrato de honorários, " +
      "no valor de {{valor}}, vence em {{vencimento}}. Forma de pagamento: {{forma_pagamento}}. " +
      "Se já pagou, desconsidere. {{escritorio}} — {{unidade}}.",
  },
];

async function main() {
  console.log("Seed da Fase 0 — HRS Interno\n");

  // ---------------------------------------------------------------- tribunais
  for (const t of TRIBUNAIS) {
    await prisma.tribunal.upsert({
      where: { codigo: t.codigo },
      update: {},
      create: {
        codigo: t.codigo,
        sigla: t.sigla,
        nome: t.nome,
        ramo: t.ramo,
        uf: t.uf,
        regimeContagemPadrao: t.regime,
        observaRecesso: true,
      },
    });
  }
  console.log(`  ${TRIBUNAIS.length} tribunais`);

  for (const o of ORGAOS) {
    const tribunal = await prisma.tribunal.findUniqueOrThrow({
      where: { codigo: o.tribunal },
      select: { id: true },
    });
    await prisma.orgaoJulgador.upsert({
      where: { tribunalId_nome: { tribunalId: tribunal.id, nome: o.nome } },
      update: { municipio: o.municipio, uf: o.uf },
      create: { tribunalId: tribunal.id, nome: o.nome, municipio: o.municipio, uf: o.uf },
    });
  }
  console.log(`  ${ORGAOS.length} orgaos julgadores`);

  // -------------------------------------------------------- feriados nacionais
  let totalFeriados = 0;
  for (const ano of ANOS_CALENDARIO) {
    for (const f of feriadosNacionais(ano)) {
      // Prisma nao consegue expressar NULL numa chave unica composta, entao a
      // idempotencia aqui e por consulta previa. O banco garante o resto: o
      // indice usa NULLS NOT DISTINCT (ver migration de invariantes), sem o
      // que o mesmo feriado nacional entraria duas vezes e o motor de prazos
      // descontaria o dia em dobro.
      const data = new Date(`${f.data}T00:00:00Z`);
      const existente = await prisma.feriadoGeral.findFirst({
        where: { data, abrangencia: "NACIONAL", uf: null, municipio: null },
        select: { id: true },
      });
      if (!existente) {
        await prisma.feriadoGeral.create({
          data: {
            data,
            nome: f.nome,
            abrangencia: "NACIONAL",
            // Ponto facultativo NAO suspende expediente por si so: quem decide
            // e o ato do tribunal. Por isso os moveis entram como false e serao
            // confirmados no calendario de cada tribunal.
            suspendeExpediente: !f.fonte.includes("portaria"),
            fonte: f.fonte,
          },
        });
      }
      totalFeriados++;
    }
  }
  console.log(`  ${totalFeriados} feriados nacionais (${ANOS_CALENDARIO.join(", ")})`);

  // ------------------------------------------------------------------ usuarios
  const credenciais: string[] = [];
  for (const membro of EQUIPE) {
    const jaExiste = await prisma.usuario.findUnique({
      where: { email: membro.email },
      select: { id: true },
    });
    if (jaExiste) continue;

    // Senha temporaria aleatoria e segredo TOTP, exibidos UMA vez no console.
    // Nao ha senha padrao no codigo: senha previsivel em sistema sob sigilo
    // profissional e porta aberta.
    const senhaTemporaria = gerarTokenAleatorio(12);
    const segredoTotp = gerarSegredoTotp();

    const usuario = await prisma.usuario.create({
      data: {
        nome: membro.nome,
        email: membro.email,
        perfil: membro.perfil,
        unidade: membro.unidade,
        senhaHash: gerarHashSenha(senhaTemporaria),
        totpAtivadoEm: new Date(),
      },
      select: { id: true },
    });

    // O segredo TOTP so pode ser cifrado depois de existir o id, porque o id
    // entra como AAD — blob copiado para outra linha nao decifra.
    const { blob, versaoChave } = cifrar(segredoTotp, `totp:${usuario.id}`, versaoChaveAtual());
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpSegredoCifrado: new Uint8Array(blob), totpVersaoChave: versaoChave },
    });

    for (const inscricao of membro.oab) {
      await prisma.inscricaoOab.upsert({
        where: { numero_uf: { numero: inscricao.numero, uf: inscricao.uf } },
        update: {},
        create: {
          usuarioId: usuario.id,
          numero: inscricao.numero,
          uf: inscricao.uf,
          principal: inscricao.principal,
        },
      });
    }

    credenciais.push(
      [
        `  ${membro.nome} <${membro.email}>`,
        `    senha temporaria: ${senhaTemporaria}`,
        `    2FA (cadastre no app autenticador): ${uriTotp(segredoTotp, membro.email)}`,
      ].join("\n"),
    );
  }
  console.log(`  ${EQUIPE.length} contas`);

  // ------------------------------------------------------------- templates
  // Um template por categoria do catalogo fechado. Cada um passa pela mesma
  // validacao anti-promessa da tela antes de receber o carimbo `validadoEm` —
  // o seed nao tem passe livre: se a validacao recusar, o template entra sem
  // carimbo e o banco recusa usa-lo em envio.
  const socia = await prisma.usuario.findUniqueOrThrow({
    where: { email: "adrielly@hrsadvocacia.adv.br" },
    select: { id: true },
  });
  let templatesValidados = 0;
  for (const t of TEMPLATES) {
    const violacoes = [...validarTexto(t.corpo), ...variaveisIndevidas(t.corpo, t.categoria)];
    if (violacoes.length > 0) {
      console.warn(`  template ${t.codigo} NAO validado: ${violacoes.map((v) => v.trecho).join(", ")}`);
    } else {
      templatesValidados++;
    }
    await prisma.templateMensagem.upsert({
      where: { codigo: t.codigo },
      update: {},
      create: {
        codigo: t.codigo,
        titulo: t.titulo,
        canal: t.canal,
        categoria: t.categoria,
        corpo: t.corpo,
        criadoPorId: socia.id,
        validadoEm: violacoes.length === 0 ? new Date() : null,
      },
    });
  }
  console.log(`  ${TEMPLATES.length} templates de mensagem (${templatesValidados} validados)`);

  // ---------------------------------------------- calendarios e revisao anual
  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { email: "admin@hrsadvocacia.adv.br" },
    select: { id: true },
  });

  for (const t of TRIBUNAIS) {
    const tribunal = await prisma.tribunal.findUniqueOrThrow({
      where: { codigo: t.codigo },
      select: { id: true },
    });
    for (const ano of ANOS_CALENDARIO) {
      await prisma.calendarioTribunal.upsert({
        where: { tribunalId_ano_versao: { tribunalId: tribunal.id, ano, versao: 1 } },
        update: {},
        create: {
          tribunalId: tribunal.id,
          ano,
          versao: 1,
          // RASCUNHO de proposito: um calendario so vira VIGENTE depois que
          // alguem conferir as portarias do tribunal e assinar a revisao.
          status: "RASCUNHO",
          criadoPorId: admin.id,
          observacao:
            "Aguardando lancamento das suspensões de expediente por portaria " +
            "e dos feriados estaduais e municipais da praca.",
        },
      });
      await prisma.revisaoAnualCalendario.upsert({
        where: { tribunalId_ano: { tribunalId: tribunal.id, ano } },
        update: {},
        create: { tribunalId: tribunal.id, ano, status: "PENDENTE" },
      });
    }
  }
  console.log(
    `  ${TRIBUNAIS.length * ANOS_CALENDARIO.length} calendarios em RASCUNHO + revisoes PENDENTES`,
  );

  if (credenciais.length > 0) {
    console.log(
      "\n" +
        "=".repeat(72) +
        "\nCREDENCIAIS INICIAIS — anote agora, nao serao exibidas de novo.\n" +
        "Troque a senha no primeiro acesso.\n" +
        "=".repeat(72) +
        "\n" +
        credenciais.join("\n\n") +
        "\n" +
        "=".repeat(72),
    );
  }

  console.log(
    "\nPENDENTE DE PREENCHIMENTO HUMANO (ver docs/CALENDARIO.md):\n" +
      "  - feriados estaduais de GO, PI e MA;\n" +
      "  - feriados municipais de Goiania, Teresina e Timon;\n" +
      "  - suspensoes de expediente por portaria de cada tribunal.\n" +
      "  Sem isso o motor de prazos da Fase 1 NAO deve ser usado em producao.\n",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
