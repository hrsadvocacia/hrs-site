#!/usr/bin/env node
// @ts-check
/**
 * Guarda de build: FALHA (exit 1) se qualquer parâmetro legal obrigatório em
 * data/parametros.json ainda estiver PENDENTE (null, vazio ou com fonte
 * começando por "PREENCHER"). Impede que o simulador vá ao ar com número
 * inventado ou faltando revisão jurídica.
 *
 * Uso:  node scripts/validar-parametros.mjs
 * Plugado em package.json → "prebuild" e "predeploy".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMINHO = resolve(__dirname, '..', 'data', 'parametros.json');

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
    if (pendente(ente?.tetoRPV?.quantidade)) erros.push(`${p}.tetoRPV.quantidade`);
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

// ── Relatório ────────────────────────────────────────────────────────────────
if (avisos.length) {
  console.warn('\n⚠  Avisos:');
  for (const a of avisos) console.warn(`   - ${a}`);
}

if (erros.length) {
  console.error(`\n✖ parametros.json tem ${erros.length} campo(s) legal(is) PENDENTE(s). Deploy bloqueado até revisão de advogado:\n`);
  for (const e of erros) console.error(`   - ${e}`);
  console.error('\n  Preencha os valores conferidos contra a legislação vigente e rode novamente.');
  console.error('  O Claude Code não deve inventar esses valores.\n');
  process.exit(1);
}

console.log('✓ parametros.json: todos os parâmetros legais obrigatórios estão preenchidos.');
process.exit(0);
