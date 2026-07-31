# Calendário forense — o que precisa ser preenchido por gente

O seed carrega **apenas** os feriados nacionais de lei federal, que são
verificáveis e não mudam de praça para praça. Tudo o mais fica em branco de
propósito.

> **Por que não seedei o resto.** Feriado estadual, feriado municipal e,
> sobretudo, suspensão de expediente por portaria de tribunal são exatamente a
> maior fonte de erro real de prazo. Eu não tenho como verificar essas datas
> aqui dentro. Um feriado inventado é **pior** do que um feriado ausente,
> porque parece correto: o motor contaria um dia útil a menos e entregaria uma
> data fatal errada com aparência de fundamentada. Prefiro que o calendário
> esteja visivelmente incompleto a silenciosamente errado.

**Enquanto esta lista não estiver preenchida e o calendário do tribunal não
estiver em `VIGENTE`, o motor de prazos da Fase 1 não deve ser usado em
produção.**

## O que o seed já traz

- 9 feriados nacionais fixos por ano (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023)
- 5 datas móveis derivadas da Páscoa (Carnaval, Cinzas, Sexta-feira Santa, Corpus Christi)
- 9 tribunais e 10 órgãos julgadores das três praças
- Um `CalendarioTribunal` por tribunal por ano, em **`RASCUNHO`**
- Uma `RevisaoAnualCalendario` por tribunal por ano, em **`PENDENTE`**

### Atenção às datas móveis

Carnaval, quarta-feira de cinzas e Corpus Christi **não são feriado civil por
lei federal** — são ponto facultativo. Entram no seed com
`suspendeExpediente = false` e precisam ser confirmados no calendário de cada
tribunal, porque quem decide se há expediente é o ato do tribunal, não o
costume. Sexta-feira Santa entra como `true`.

## O que falta preencher

### 1. Feriados estaduais

| UF | Datas a confirmar | Fonte a registrar |
|---|---|---|
| GO | | Lei estadual |
| PI | | Lei estadual |
| MA | | Lei estadual |

### 2. Feriados municipais

Aplicam-se pelo **município do órgão julgador**, não pela sede do tribunal — um
processo do TRT-18 em Anápolis não para no feriado de Goiânia.

| Município | Datas a confirmar | Fonte a registrar |
|---|---|---|
| Goiânia/GO | | Lei municipal |
| Anápolis/GO | | Lei municipal |
| Teresina/PI | | Lei municipal |
| Timon/MA | | Lei municipal |
| São Luís/MA | | Lei municipal |

### 3. Suspensões de expediente por portaria — **o item mais importante**

Uma por tribunal, por ano. É onde mora o erro que faz perder prazo.

| Tribunal | Portaria | Período | Alcance |
|---|---|---|---|
| TRT-18 | | | todo o tribunal / vara específica |
| TRT-22 | | | |
| TRT-16 | | | |
| TJGO | | | |
| TJPI | | | |
| TJMA | | | |
| TRF-1 | | | |
| TST | | | |
| STJ | | | |

Cada lançamento exige `fonte` preenchida (ex.: "Portaria Conjunta 3/2026 —
TRT-18") — o campo é obrigatório no banco. Dado de calendário sem origem
registrada não é defensável perante o cliente nem perante o juízo.

Quando a portaria alcança apenas uma vara ou comarca, preencha
`orgaoJulgadorId`. Deixar nulo significa "todo o tribunal", e aplicar a todo o
tribunal uma suspensão que era de uma vara só faz o motor **atrasar** a data
fatal — o erro perigoso.

### 4. Recesso forense (20/12 a 20/01)

Já é regra do motor, não precisa ser cadastrado dia a dia. Comportamento
decidido pelo escritório:

- prazo **processual** (`DIAS_UTEIS_TRABALHISTA`, `DIAS_UTEIS_CPC`) — o curso
  **suspende** (CLT art. 775-A; CPC art. 220);
- prazo **penal** (`DIAS_CORRIDOS_PENAL`, CPP art. 798), **material** e
  **administrativo** (`DIAS_CORRIDOS`) — **continua correndo**.

Suspender não é o mesmo que "não contar o dia": o relógio para e volta a correr
em 21/01. Prazo que venceria dentro do recesso é empurrado para depois dele, e
prazo cujo termo inicial cairia no recesso só começa a correr no primeiro dia
útil seguinte a 20/01.

## Rotina anual

Cada `RevisaoAnualCalendario` nasce `PENDENTE`. A partir da Fase 1 um alerta
dispara em dezembro para as revisões que continuarem pendentes. Um calendário só
passa de `RASCUNHO` a `VIGENTE` depois que alguém confere as portarias e assina
a revisão — o carimbo fica em `revisadoPorId` e `revisadoEm`.

Calendário vigente **não se edita**: cria-se nova versão. Todo prazo já
calculado guarda o `calendarioId` e a `versaoMotor` que produziram a data, para
que um recálculo futuro não apague o raciocínio que fundamentou a decisão
tomada à época.
