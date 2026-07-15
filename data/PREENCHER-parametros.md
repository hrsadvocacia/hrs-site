# Preenchimento de `parametros.json` — revisão jurídica obrigatória

> **Regra de ouro:** nenhum número legal foi inventado pelo desenvolvimento.
> Todos os campos abaixo estão pendentes (`null` / `""` / fonte começando por
> `PREENCHER`) e **precisam ser conferidos por advogado do escritório** contra a
> legislação vigente antes de a ferramenta ir ao ar. Depois de preencher, rode:
>
> ```bash
> npm run validar-parametros
> ```
>
> O build/deploy fica **bloqueado** enquanto houver qualquer pendência.

Edite apenas o arquivo `data/parametros.json`. Ao preencher um número, substitua
também a `fonte` `PREENCHER — …` pelo fundamento legal real.

---

## 1. Salário mínimo (gate de tudo)

Campo `salarioMinimo`. É a base dos tetos em salários mínimos — sem ele, nenhum
ente calcula.

- `valor`: valor vigente em **reais** (ex.: `1518`).
- `vigenciaDesde`: data ISO de início da vigência (ex.: `2025-01-01`).
- `fonte`: norma que fixou o valor (decreto/lei + ano).

## 2. Tetos de RPV por ente

Campo `entes[].tetoRPV`. Regra: crédito atualizado **≤ teto → RPV**; acima →
precatório.

| Ente | `id` | O que confirmar |
|---|---|---|
| União / autarquias / fundações federais | `uniao-federal` | Teto **já preenchido** (60 salários mínimos — art. 17, §1º, Lei 10.259/2001). **Só confirmar** que segue vigente. |
| Estado de Goiás | `estado-goias` | `quantidade` (nº de salários mínimos **ou** valor em reais — ajuste `modo`) conforme a **lei estadual de Goiás**, atentando à alteração de **nov/2025**. |
| Município de Goiânia | `municipio-goiania` | `quantidade` conforme a **lei municipal de Goiânia**. À falta de lei, aplica-se o parâmetro do art. 87 do ADCT (conferir). |
| Estado do Piauí | `estado-piaui` | `quantidade` conforme a **lei estadual do Piauí**. |
| Outro ente | `outro` | Valor genérico/conservador para "demais entes" (ou orientar o usuário a procurar o escritório). |

> `modo` aceita `"salarios_minimos"` (usa o salário mínimo acima) ou `"reais"`
> (valor fixo em reais). Ajuste conforme a lei de cada ente.

## 3. Regime especial de precatórios

Campo `entes[].regimeEspecial` (`true` / `false`). Indica se o ente paga
precatórios de forma parcelada (regime especial). Afeta o alerta de prazo.
Confirmar por ente (a União é `false`; estados/municípios variam).

## 4. Janela de pagamento da RPV (prazo)

Campo `entes[].prazoRPVMeses` (`min` e `max`, em meses). Estimativa de quanto
tempo, após a expedição, a RPV costuma ser paga naquele ente/tribunal. Preencher
com a faixa praticada (ex.: `min: 2, max: 6`).

## 5. Data-corte orçamentária dos precatórios

Campo `cortePrecatorio.dataLimiteApresentacao` (formato `DD-MM`). Está em `02-04`
(2 de abril — art. 100, §5º, CF). **Conferir se a EC 136/2025 alterou essa data**
e ajustar se necessário.

## 6. Atualização monetária (opcional na v1)

Campo `atualizacao` (`indice`, `juros`, `fonte`). A **v1 não aplica correção
monetária** (o valor informado é tratado como já atualizado — ver premissa
exibida ao usuário), então estes campos ficam como **aviso**, não bloqueiam o
deploy. Preencher só quando/ se a correção automática for habilitada numa versão
futura.

---

## Checklist antes do merge em `main`

- [ ] `salarioMinimo` preenchido e conferido.
- [ ] Teto de RPV de **cada** ente preenchido/confirmado, com `fonte` real.
- [ ] `regimeEspecial` definido por ente.
- [ ] `prazoRPVMeses` preenchido por ente.
- [ ] Data-corte conferida (efeitos da EC 136/2025).
- [ ] `npm run validar-parametros` **passa** (sai sem erro).
- [ ] `npm test` **verde**.
- [ ] Revisão dos parâmetros **assinada por sócio** (critério de aceite do escopo).
- [ ] `LEAD_ENDPOINT` configurado em `simulador/wizard.js` (ver `scripts/google-apps-script/README.md`).
