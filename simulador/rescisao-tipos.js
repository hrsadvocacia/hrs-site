// @ts-check
/**
 * Tipos do motor de cálculo do Simulador de Verbas Rescisórias.
 *
 * Como em `tipos.js`, este arquivo contém APENAS definições de tipo
 * (JSDoc @typedef): não há código executável. Ele documenta o contrato do
 * motor e dá checagem de tipos no editor sem exigir passo de build.
 *
 * @module simulador/rescisao-tipos
 */

/**
 * Modalidade de término do contrato de trabalho.
 * @typedef {'sem_justa_causa' | 'rescisao_indireta' | 'acordo' | 'pedido_demissao' | 'justa_causa'} Modalidade
 */

/**
 * Situação do aviso prévio.
 * - `indenizado`   — não é trabalhado; pago em dinheiro e projeta o contrato.
 * - `trabalhado`   — cumprido em serviço; já remunerado como salário.
 * - `nao_cumprido` — devido pelo empregado e não cumprido: vira desconto.
 * - `dispensado`   — o empregador dispensou o cumprimento, sem desconto.
 * @typedef {'indenizado' | 'trabalhado' | 'nao_cumprido' | 'dispensado'} SituacaoAviso
 */

/**
 * Entrada da simulação (dados fornecidos pelo usuário).
 * @typedef {Object} EntradaRescisao
 * @property {Modalidade}     modalidade
 * @property {number}         salarioMensal            R$, último salário-base mensal
 * @property {string}         dataAdmissao             ISO (YYYY-MM-DD)
 * @property {string}         dataSaida                ISO (YYYY-MM-DD), último dia efetivamente trabalhado
 * @property {SituacaoAviso}  situacaoAviso
 * @property {number}        [feriasVencidasPeriodos]  períodos aquisitivos completos e não gozados (default 0)
 * @property {number}        [mediaVariaveisMensal]    R$, média de horas extras/comissões/adicionais (default 0)
 * @property {number}        [saldoFGTSInformado]      R$, saldo da conta vinculada. Ausente → estimado
 * @property {number}        [dependentesIR]           quantidade de dependentes para o IRRF (default 0)
 */

/**
 * Faixa de tabela progressiva (INSS).
 * @typedef {Object} FaixaINSS
 * @property {number} ate         limite superior da faixa, em reais
 * @property {number} aliquotaPct alíquota da faixa
 */

/**
 * Faixa da tabela progressiva do IRRF.
 * @typedef {Object} FaixaIRRF
 * @property {number | null} ate         limite superior em reais (`null` na última faixa)
 * @property {number}        aliquotaPct
 * @property {number}        deduzir     parcela a deduzir, em reais
 */

/**
 * Regras de aviso prévio de uma modalidade.
 * @typedef {Object} RegraAviso
 * @property {'empregador' | 'empregado' | 'nenhum'} devidoPor
 * @property {number}  fator        multiplicador do valor (ex.: 0.5 no art. 484-A)
 * @property {boolean} proporcional se aplica os 3 dias por ano da Lei 12.506/2011
 * @property {boolean} projeta      se o aviso indenizado projeta o contrato
 */

/**
 * Regras de uma modalidade de rescisão.
 * @typedef {Object} RegraModalidade
 * @property {string}     rotulo
 * @property {string}     descricao
 * @property {RegraAviso} avisoPrevio
 * @property {boolean}    saldoSalario
 * @property {boolean}    decimoTerceiroProporcional
 * @property {boolean}    feriasVencidas
 * @property {boolean}    feriasProporcionais
 * @property {number}     multaFGTSPct
 * @property {number}     saqueFGTSPct
 * @property {boolean}    seguroDesemprego
 * @property {string}     fonte
 */

/**
 * Regra de incidência tributária de uma verba.
 * @typedef {Object} Incidencia
 * @property {boolean | null}  inss
 * @property {boolean | null}  irrf
 * @property {boolean}        [tributacaoExclusiva]
 * @property {string}          fonte
 */

/**
 * Conteúdo tipado de /data/parametros-rescisao.json.
 * @typedef {Object} ParametrosRescisao
 * @property {{ divisorMensal: number, fonte: string }} remuneracao
 * @property {{ diasBase: number, diasAdicionaisPorAnoCompleto: number, diasMaximo: number, fonte: string }} avisoPrevio
 * @property {{ adicionalFracao: { numerador: number, denominador: number }, fonte: string }} ferias
 * @property {{ avosPorAno: number, diasMinimosParaAvo: number, fonte: string }} decimoTerceiro
 * @property {{ aliquotaDepositoPct: number, incideSobreVerbas: string[], fonte: string, fonteIncidencia: string }} fgts
 * @property {Record<string, RegraModalidade>} modalidades
 * @property {Record<string, Incidencia>} incidencias
 * @property {{ competencia: string, faixas: FaixaINSS[], fonte: string }} tabelaINSS
 * @property {{ competencia: string, faixas: FaixaIRRF[], deducaoPorDependente: number | null, descontoSimplificado: number | null, fonte: string }} tabelaIRRF
 * @property {{ dias: number, contadoDe: string, multaAtraso: string, fonte: string }} prazoPagamento
 */

/**
 * Uma linha do demonstrativo — verba devida ou expressamente não devida.
 * @typedef {Object} Verba
 * @property {string}  id
 * @property {string}  rotulo
 * @property {number}  valor          R$ (0 quando não devida)
 * @property {boolean} devida
 * @property {string}  memoria        como o número foi obtido, em linguagem comum
 * @property {string} [motivoNaoDevida]
 */

/**
 * Uma linha de desconto.
 * @typedef {Object} Desconto
 * @property {string} id
 * @property {string} rotulo
 * @property {number} valor    R$
 * @property {string} memoria
 */

/**
 * Bloco do FGTS — pago pela conta vinculada, não pela folha da rescisão.
 * @typedef {Object} BlocoFGTS
 * @property {number}  saldoBase              R$ na conta antes dos depósitos rescisórios
 * @property {boolean} saldoEstimado          true quando o usuário não informou o saldo
 * @property {number}  depositoRescisorio     R$, 8% sobre as verbas de natureza salarial
 * @property {number}  multaPct
 * @property {number}  multaValor             R$
 * @property {number}  saquePct
 * @property {number}  valorDisponivelSaque   R$ (saque do saldo + multa integral)
 * @property {string}  observacao
 */

/**
 * Saída da simulação.
 * @typedef {Object} ResultadoRescisao
 * @property {Modalidade} modalidade
 * @property {string}     rotuloModalidade
 * @property {number}     remuneracaoBase        R$ (salário + médias)
 * @property {number}     avisoPrevioDias        dias de aviso apurados
 * @property {string}     dataFimProjetada       ISO — fim do contrato após a projeção do aviso
 * @property {boolean}    houveProjecao
 * @property {number}     anosDeCasa
 * @property {Verba[]}    verbas
 * @property {number}     totalBruto             R$
 * @property {Desconto[]} descontos
 * @property {number}     totalDescontos         R$
 * @property {number}     liquidoEstimado        R$ (rescisão, sem o FGTS)
 * @property {boolean}    descontosFiscaisCalculados  false quando as tabelas estão pendentes
 * @property {BlocoFGTS}  fgts
 * @property {number}     totalGeralEstimado     R$ (líquido da rescisão + FGTS disponível)
 * @property {{ direito: boolean, texto: string }} seguroDesemprego
 * @property {{ dias: number, texto: string }} prazoPagamento
 * @property {string[]}   alertas
 * @property {string[]}   premissas
 */

export {};
