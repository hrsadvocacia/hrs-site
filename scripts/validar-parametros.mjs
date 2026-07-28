#!/usr/bin/env node
// @ts-check
/**
 * Guarda de build: FALHA (exit 1) se qualquer parâmetro legal obrigatório dos
 * simuladores ainda estiver PENDENTE (null, vazio ou com fonte começando por
 * "PREENCHER"). Impede que uma ferramenta vá ao ar com número inventado ou
 * faltando revisão jurídica.
 *
 * Cobre dois arquivos:
 *   - data/parametros.json          → Simulador de Precatório/RPV
 *   - data/parametros-rescisao.json → Simulador de Verbas Rescisórias
 *
 * Uso:  node scripts/validar-parametros.mjs
 * Plugado em package.json → "prebuild" e "predeploy".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMINHO = resolve(__dirname, '..', 'data', 'parametros.json');
const CAMINHO_RESCISAO = resolve(__dirname, '..', 'data', 'parametros-rescisao.json');

/** @type {string[]} */ const erros = [];
/** @type {string[]} */ const avisos = [];

/** @param {unknown} v */
const pendente = (v) =>
  v == null ||
  (typeof v === 'string' && (v.trim() === '' || v.trim().toUpperCase().startsWith('PREENCHER')));

let params;
try {
  params = JSON.parse(readFileSync(CAMINHO, 'utf8'));
} catch (e) {
  console.error(`✖ Não foi possível ler/parsear ${CAMINHO}:\n  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

// ── Salário mínimo (necessário para todo teto em salários mínimos) ──────────
if (pendente(params?.salarioMinimo?.valor)) erros.push('salarioMinimo.valor');
if (pendente(params?.salarioMinimo?.vigenciaDesde)) erros.push('salarioMinimo.vigenciaDesde');
if (pendente(params?.salarioMinimo?.fonte)) erros.push('salarioMinimo.fonte');

// ── Entes ────────────────────────────────────────────────────────────────────
if (!Array.isArray(params?.entes) || params.entes.length === 0) {
  erros.push('entes (lista vazia)');
} else {
  for (const ente of params.entes) {
    const p = `entes[${ente?.id ?? '?'}]`;
    // Entes cujo teto é informado em runtime pelo usuário (ex.: "Outro ente")
    // não exigem quantidade fixa nos parâmetros.
    if (!ente?.tetoInformadoPeloUsuario && pendente(ente?.tetoRPV?.quantidade)) erros.push(`${p}.tetoRPV.quantidade`);
    if (pendente(ente?.tetoRPV?.fonte)) erros.push(`${p}.tetoRPV.fonte`);
    if (ente?.regimeEspecial == null) erros.push(`${p}.regimeEspecial`);
    if (pendente(ente?.prazoRPVMeses?.min)) erros.push(`${p}.prazoRPVMeses.min`);
    if (pendente(ente?.prazoRPVMeses?.max)) erros.push(`${p}.prazoRPVMeses.max`);
  }
}

// ── Corte orçamentário ───────────────────────────────────────────────────────
if (pendente(params?.cortePrecatorio?.dataLimiteApresentacao)) erros.push('cortePrecatorio.dataLimiteApresentacao');

// ── Atualização (v1 NÃO aplica correção → aviso, não bloqueia) ───────────────
if (pendente(params?.atualizacao?.indice) || pendente(params?.atualizacao?.fonte)) {
  avisos.push('atualizacao.* pendente — ok para a v1 (não aplica correção monetária), mas confira antes de habilitar correção.');
}

// ═══════════════════════════════════════════════════════════════════════════
// Simulador de Verbas Rescisórias — data/parametros-rescisao.json
// ═══════════════════════════════════════════════════════════════════════════

let resc;
try {
  resc = JSON.parse(readFileSync(CAMINHO_RESCISAO, 'utf8'));
} catch (e) {
  console.error(`✖ Não foi possível ler/parsear ${CAMINHO_RESCISAO}:\n  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

/** @param {string} caminho @param {unknown} valor */
const exigir = (caminho, valor) => { if (pendente(valor)) erros.push(`[rescisao] ${caminho}`); };

// ── Estrutura da CLT (bloqueante: sem isso o motor não calcula) ─────────────
exigir('remuneracao.divisorMensal', resc?.remuneracao?.divisorMensal);
exigir('avisoPrevio.diasBase', resc?.avisoPrevio?.diasBase);
exigir('avisoPrevio.diasAdicionaisPorAnoCompleto', resc?.avisoPrevio?.diasAdicionaisPorAnoCompleto);
exigir('avisoPrevio.diasMaximo', resc?.avisoPrevio?.diasMaximo);
exigir('avisoPrevio.fonte', resc?.avisoPrevio?.fonte);
exigir('ferias.adicionalFracao.numerador', resc?.ferias?.adicionalFracao?.numerador);
exigir('ferias.adicionalFracao.denominador', resc?.ferias?.adicionalFracao?.denominador);
exigir('decimoTerceiro.avosPorAno', resc?.decimoTerceiro?.avosPorAno);
exigir('decimoTerceiro.diasMinimosParaAvo', resc?.decimoTerceiro?.diasMinimosParaAvo);
exigir('fgts.aliquotaDepositoPct', resc?.fgts?.aliquotaDepositoPct);
exigir('fgts.fonte', resc?.fgts?.fonte);
exigir('prazoPagamento.dias', resc?.prazoPagamento?.dias);

if (!Array.isArray(resc?.fgts?.incideSobreVerbas) || resc.fgts.incideSobreVerbas.length === 0) {
  erros.push('[rescisao] fgts.incideSobreVerbas (lista vazia)');
}

// ── Modalidades de rescisão ─────────────────────────────────────────────────
const MODALIDADES_ESPERADAS = ['sem_justa_causa', 'rescisao_indireta', 'acordo', 'pedido_demissao', 'justa_causa'];
const modalidades = resc?.modalidades;
if (!modalidades || typeof modalidades !== 'object') {
  erros.push('[rescisao] modalidades (ausente)');
} else {
  for (const id of MODALIDADES_ESPERADAS) {
    if (!modalidades[id]) { erros.push(`[rescisao] modalidades.${id} (ausente)`); continue; }
    const m = modalidades[id];
    const p = `modalidades.${id}`;
    exigir(`${p}.rotulo`, m.rotulo);
    exigir(`${p}.descricao`, m.descricao);
    exigir(`${p}.fonte`, m.fonte);
    exigir(`${p}.multaFGTSPct`, m.multaFGTSPct);
    exigir(`${p}.saqueFGTSPct`, m.saqueFGTSPct);
    // Flags booleanas: `false` é resposta válida, `null`/ausente não é.
    for (const campo of ['saldoSalario', 'decimoTerceiroProporcional', 'feriasVencidas', 'feriasProporcionais', 'seguroDesemprego']) {
      if (typeof m[campo] !== 'boolean') erros.push(`${'[rescisao] '}${p}.${campo}`);
    }
    const av = m.avisoPrevio;
    if (!av) {
      erros.push(`[rescisao] ${p}.avisoPrevio (ausente)`);
    } else {
      if (!['empregador', 'empregado', 'nenhum'].includes(av.devidoPor)) erros.push(`[rescisao] ${p}.avisoPrevio.devidoPor`);
      if (typeof av.fator !== 'number') erros.push(`[rescisao] ${p}.avisoPrevio.fator`);
      if (typeof av.proporcional !== 'boolean') erros.push(`[rescisao] ${p}.avisoPrevio.proporcional`);
      if (typeof av.projeta !== 'boolean') erros.push(`[rescisao] ${p}.avisoPrevio.projeta`);
    }
  }
}

// ── Incidências: a `fonte` é obrigatória; flags null = fica em aberto ───────
const incidencias = resc?.incidencias ?? {};
for (const [id, inc] of Object.entries(incidencias)) {
  exigir(`incidencias.${id}.fonte`, /** @type {any} */ (inc)?.fonte);
  for (const tributo of ['inss', 'irrf']) {
    if (/** @type {any} */ (inc)?.[tributo] == null) {
      avisos.push(`[rescisao] incidencias.${id}.${tributo} em aberto — confirmar antes de habilitar o cálculo do líquido.`);
    }
  }
}

// ── Tabelas fiscais (v1 NÃO calcula o líquido → aviso, não bloqueia) ────────
const semINSS = !Array.isArray(resc?.tabelaINSS?.faixas) || resc.tabelaINSS.faixas.length === 0;
const semIRRF = !Array.isArray(resc?.tabelaIRRF?.faixas) || resc.tabelaIRRF.faixas.length === 0;
if (semINSS || semIRRF) {
  avisos.push(
    '[rescisao] tabelaINSS/tabelaIRRF pendentes — ok para a v1: o simulador exibe o valor BRUTO e avisa o ' +
    'usuário de que INSS e IR não foram estimados. Preencha para habilitar o cálculo do líquido.'
  );
} else {
  // Tabelas preenchidas passam a ser parâmetro de produção: exigir competência e fonte.
  exigir('tabelaINSS.competencia', resc?.tabelaINSS?.competencia);
  exigir('tabelaINSS.fonte', resc?.tabelaINSS?.fonte);
  exigir('tabelaIRRF.competencia', resc?.tabelaIRRF?.competencia);
  exigir('tabelaIRRF.fonte', resc?.tabelaIRRF?.fonte);
  exigir('tabelaIRRF.deducaoPorDependente', resc?.tabelaIRRF?.deducaoPorDependente);
}

// ── Relatório ────────────────────────────────────────────────────────────────
if (avisos.length) {
  console.warn('\n⚠  Avisos:');
  for (const a of avisos) console.warn(`   - ${a}`);
}

if (erros.length) {
  console.error(`\n✖ Há ${erros.length} campo(s) legal(is) PENDENTE(s). Deploy bloqueado até revisão de advogado:\n`);
  for (const e of erros) console.error(`   - ${e}`);
  console.error('\n  Campos marcados com [rescisao] estão em data/parametros-rescisao.json;');
  console.error('  os demais, em data/parametros.json.');
  console.error('\n  Preencha os valores conferidos contra a legislação vigente e rode novamente.');
  console.error('  O Claude Code não deve inventar esses valores.\n');
  process.exit(1);
}

console.log('✓ parametros.json e parametros-rescisao.json: todos os parâmetros legais obrigatórios estão preenchidos.');
process.exit(0);
