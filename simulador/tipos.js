// @ts-check
/**
 * Tipos do motor de cálculo do Simulador de Precatório/RPV.
 *
 * Este arquivo contém APENAS definições de tipo (JSDoc @typedef). Não há
 * código executável — ele existe para dar checagem de tipos no editor e
 * documentar o contrato do motor, sem exigir um passo de build no site
 * estático. Importe os tipos com:
 *
 *   /** @typedef {import('./tipos.js').EntradaSimulacao} EntradaSimulacao *\/
 *
 * @module simulador/tipos
 */

/**
 * Natureza do crédito.
 * @typedef {'alimentar' | 'comum'} NaturezaCredito
 */

/**
 * Classificação do crédito quanto ao rito de pagamento.
 * @typedef {'RPV' | 'PRECATORIO'} Classificacao
 */

/**
 * Entrada da simulação (dados fornecidos pelo usuário).
 * @typedef {Object} EntradaSimulacao
 * @property {string}          ente                       id do ente devedor (ver parametros.json → entes[].id)
 * @property {NaturezaCredito} naturezaCredito            'alimentar' | 'comum'
 * @property {number}          valorBruto                 R$, valor da condenação/execução
 * @property {string}          dataBaseValor              ISO (YYYY-MM-DD) — data a que o valor se refere
 * @property {boolean}         temPreferencia             idoso 60+, doença grave, PcD
 * @property {boolean}         jaExpedido                 se a RPV/precatório já foi expedido
 * @property {string}         [dataExpedicao]             ISO (YYYY-MM-DD), obrigatório quando jaExpedido
 * @property {number}         [honorariosContratuaisPct]  0–100, opcional, default 0
 * @property {boolean}        [destacarHonorarios]        destaque na origem (art. 22, §4º, EAOAB)
 */

/**
 * Teto de RPV de um ente devedor, expresso em salários mínimos ou em reais.
 * @typedef {Object} TetoRPV
 * @property {'salarios_minimos' | 'reais'} modo
 * @property {number | null} quantidade   qtd de salários mínimos OU valor em reais. `null` = PENDENTE (não usar em produção)
 * @property {string}        fonte        fundamento legal
 */

/**
 * Faixa de prazo em meses (estimativa), parametrizada por ente.
 * @typedef {Object} FaixaMeses
 * @property {number | null} min  `null` = PENDENTE
 * @property {number | null} max  `null` = PENDENTE
 */

/**
 * Ente devedor.
 * @typedef {Object} Ente
 * @property {string}          id
 * @property {string}          nome
 * @property {TetoRPV}         tetoRPV
 * @property {boolean | null}  regimeEspecial      regime especial de precatórios (parcelamento). `null` = PENDENTE
 * @property {FaixaMeses}     [prazoRPVMeses]      janela estimada de pagamento da RPV após expedição
 * @property {FaixaMeses}     [prazoPrecatorioMesesAdicional]  meses adicionais dentro do ano orçamentário (ajuste fino opcional)
 */

/**
 * Conteúdo tipado de /data/parametros.json.
 * @typedef {Object} Parametros
 * @property {{ valor: number | null, vigenciaDesde: string, fonte: string }} salarioMinimo
 * @property {Ente[]} entes
 * @property {{ dataLimiteApresentacao: string, obs: string }} cortePrecatorio
 * @property {{ indice: string, juros: string, fonte: string }} atualizacao
 * @property {{
 *   irrfRRA: { aplicavel: boolean, obs: string },
 *   contribuicaoPrevidenciaria: { aplicavel: boolean, obs: string }
 * }} tributacao
 */

/**
 * Cenário de renúncia ao excedente (art. 100, §4º, CF).
 * @typedef {Object} CenarioRenuncia
 * @property {number} valorAposRenuncia
 * @property {number} perdaEmReais
 * @property {number} ganhoEmTempoMeses
 * @property {string} textoTradeoff
 */

/**
 * Estimativa de descontos.
 * @typedef {Object} DescontosEstimados
 * @property {number} [irrfRRA]
 * @property {number} [previdenciario]
 * @property {number} [honorariosContratuais]
 * @property {string} observacao
 */

/**
 * Faixa de prazo com texto explicativo.
 * @typedef {Object} FaixaPrazo
 * @property {number} minMeses
 * @property {number} maxMeses
 * @property {string} textoExplicativo
 */

/**
 * Saída da simulação.
 * @typedef {Object} ResultadoSimulacao
 * @property {Classificacao}     classificacao
 * @property {number}            tetoRPVAplicavel
 * @property {number}            valorAtualizadoEstimado
 * @property {FaixaPrazo}        faixaPrazo
 * @property {CenarioRenuncia}  [cenarioRenuncia]
 * @property {DescontosEstimados} descontosEstimados
 * @property {number}            liquidoEstimado
 * @property {boolean}           preferencial
 * @property {string[]}          alertas
 * @property {string[]}          premissas
 */

export {};
