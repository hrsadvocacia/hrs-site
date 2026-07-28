# Revisão de `parametros-rescisao.json` — Simulador de Verbas Rescisórias

> **Regra de ouro:** nenhum número legal foi inventado pelo desenvolvimento.
> A estrutura da CLT já vem preenchida com o fundamento legal em cada campo e
> **precisa ser conferida por advogado do escritório** antes de a ferramenta ir
> ao ar. As tabelas de INSS e IRRF ficam **pendentes de propósito**. Depois de
> mexer no arquivo, rode:
>
> ```bash
> npm run validar-parametros
> npm test
> ```
>
> O build/deploy fica **bloqueado** enquanto houver pendência bloqueante.

Edite apenas `data/parametros-rescisao.json`.

---

## Como a ferramenta se comporta hoje (v1)

O simulador calcula o **bruto** de cada verba e o FGTS, e informa ao usuário,
de forma expressa, que **INSS e imposto de renda não foram estimados**. Assim
que as tabelas fiscais forem preenchidas, o motor passa sozinho a calcular o
líquido — não é preciso mexer em código.

---

## 1. Conferir a estrutura da CLT (já preenchida)

| Campo | Valor atual | Fundamento adotado |
|---|---|---|
| `remuneracao.divisorMensal` | 30 | CLT art. 64 |
| `avisoPrevio.diasBase` | 30 | CLT art. 487, II |
| `avisoPrevio.diasAdicionaisPorAnoCompleto` | 3 | Lei nº 12.506/2011, parágrafo único |
| `avisoPrevio.diasMaximo` | 90 | Lei nº 12.506/2011 |
| `ferias.adicionalFracao` | 1/3 | CF art. 7º, XVII |
| `decimoTerceiro.diasMinimosParaAvo` | 15 | Lei nº 4.090/1962, art. 1º, §2º |
| `fgts.aliquotaDepositoPct` | 8 | Lei nº 8.036/1990, art. 15 |
| `prazoPagamento.dias` | 10 | CLT art. 477, §6º |

## 2. Conferir a matriz de verbas por modalidade

Campo `modalidades.<id>`. Cada modalidade diz, em `true`/`false`, o que é devido —
é aqui que mora quase toda a lógica jurídica da ferramenta.

| Modalidade | Aviso | 13º prop. | Férias prop. | Multa FGTS | Saque | Seguro-desemprego |
|---|---|---|---|---|---|---|
| `sem_justa_causa` | do empregador, integral | sim | sim | 40% | 100% | sim |
| `rescisao_indireta` | do empregador, integral | sim | sim | 40% | 100% | sim |
| `acordo` (art. 484-A) | do empregador, **metade** | sim | sim | **20%** | **80%** | **não** |
| `pedido_demissao` | **do empregado**, 30 dias | sim | sim (Súm. 261 TST) | 0% | 0% | não |
| `justa_causa` | nenhum | **não** | **não** | 0% | 0% | não |

> Férias **vencidas** são devidas em **todas** as modalidades, inclusive na justa
> causa (Súmula 171 do TST). Por isso `feriasVencidas` é `true` em todas.

### Pontos que merecem decisão expressa do escritório

- **`modalidades.acordo.avisoPrevio.projeta`** — hoje `true`. O art. 484-A reduz
  o aviso indenizado à metade; **projetar** esse período reduzido (gerando avos
  extras de 13º e férias) é controvertido. O simulador projeta e exibe alerta ao
  usuário. Se o escritório preferir a leitura oposta, mude para `false`.
- **`avisoPrevio.proporcional` no `pedido_demissao`** — hoje `false`: o desconto
  fica em 30 dias, porque a proporcionalidade da Lei 12.506/2011 é benefício
  exclusivo do empregado (Nota Técnica MTE/SRT nº 184/2012). Confirmar.

## 3. Matriz de incidências (`incidencias`)

Diz, verba a verba, se incide INSS e IRRF. Só produz efeito quando as tabelas
fiscais estiverem preenchidas.

- `aviso_previo_indenizado.irrf` está **`null` (em aberto)** — é o único ponto
  fiscal que o desenvolvimento não fechou. Definir `true` ou `false` conforme a
  orientação do escritório e substituir a `fonte` pelo fundamento adotado.
- Os demais estão preenchidos: férias indenizadas e o terço fora da base de INSS
  e IR (art. 28, §9º, "d", da Lei nº 8.212/1991 e Súmula 386 do STJ); aviso
  indenizado fora da base do INSS (Tema 478 do STJ); 13º com tributação
  exclusiva na fonte.

## 4. Tabelas fiscais — **PENDENTES**

### `tabelaINSS`
Contribuição do segurado empregado, por faixas progressivas. Preencher
`competencia` (ex.: `"2026"`), `fonte` (portaria/decreto) e `faixas`:

```json
"faixas": [
  { "ate": 1621.00, "aliquotaPct": 7.5 },
  { "ate": 0000.00, "aliquotaPct": 9 },
  { "ate": 0000.00, "aliquotaPct": 12 },
  { "ate": 0000.00, "aliquotaPct": 14 }
]
```
A última faixa é o **teto**: acima dele a contribuição não cresce.

### `tabelaIRRF`
Tabela progressiva mensal. Preencher `competencia`, `fonte`,
`deducaoPorDependente`, `descontoSimplificado` e `faixas`:

```json
"faixas": [
  { "ate": 0000.00, "aliquotaPct": 0,    "deduzir": 0 },
  { "ate": 0000.00, "aliquotaPct": 7.5,  "deduzir": 000.00 },
  { "ate": 0000.00, "aliquotaPct": 15,   "deduzir": 000.00 },
  { "ate": 0000.00, "aliquotaPct": 22.5, "deduzir": 000.00 },
  { "ate": null,    "aliquotaPct": 27.5, "deduzir": 000.00 }
]
```
A última faixa usa `"ate": null` (sem limite superior). O motor aplica a
dedução **mais favorável** entre a legal (INSS + dependentes) e o desconto
simplificado.

> **Atenção:** conferir os efeitos da reforma do imposto de renda em vigor a
> partir de 2026 sobre a faixa de isenção e a redução parcial.

---

## Checklist antes do merge em `main`

- [ ] Matriz `modalidades` conferida verba a verba contra a CLT e as súmulas citadas.
- [ ] Decisão expressa sobre a projeção do aviso pela metade no acordo (art. 484-A).
- [ ] Decisão expressa sobre `incidencias.aviso_previo_indenizado.irrf`.
- [ ] `tabelaINSS` e `tabelaIRRF` preenchidas **ou** decisão consciente de manter
      a v1 apresentando o valor bruto.
- [ ] `npm run validar-parametros` **passa** (sai sem erro).
- [ ] `npm test` **verde**.
- [ ] Revisão dos parâmetros **assinada por sócio**.
- [ ] `LEAD_ENDPOINT` configurado em `simulador/rescisao-wizard.js` (ver
      `scripts/google-apps-script/README.md`).
