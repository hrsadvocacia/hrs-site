# Decisões de arquitetura — Sistema interno HRS

Registro do que foi decidido e por quê. Uma entrada por fase.

---

## Fase 0 — Fundação

### D-0.1 — O repositório não era Next.js

O briefing partia de "monorepo existente (Next.js, deploy Vercel)". A inspeção
mostrou outra coisa: `hrs-site` é um **site estático puro** — HTML na raiz,
`style.css`, `script.js`, simuladores em `simulador/*.js` carregados como ES
modules pelo navegador. Sem `app/`, sem `next.config`, sem `tsconfig`, sem
`vercel.json`, sem workflow em `.github/`, zero dependências instaladas.

Consequência: a opção (a) do briefing — "route group isolado `app/(interno)`" —
**não existia**. Adotá-la exigiria converter o site institucional inteiro em
Next.js, obra de risco e sem benefício para o marketing, colocando dado sob
sigilo dentro do mesmo build. Descartada antes da comparação entre (b) e (c).

### D-0.2 — Projeto Vercel separado (opção c)

**Decisão:** o sistema interno vive em `interno/`, no mesmo repositório, como um
segundo projeto Vercel com *Root Directory* próprio.

O argumento de "runtime separado" não é o que distingue (b) de (c): na Vercel
cada invocação de função já é isolada. O que é **escopado por projeto**, e por
isso só (c) separa, é:

| Superfície | (b) host no middleware | (c) projeto separado |
|---|---|---|
| Variáveis de ambiente | compartilhadas — `DATABASE_URL` e chave de criptografia presentes no runtime que serve `index.html` | escopo próprio |
| Deployment Protection / Trusted IPs | por projeto: ou protege o site público junto, ou não protege | só no interno |
| Regras de firewall/WAF | por projeto | só no interno |
| Cadência de deploy | um typo em `areas.html` redeploya o sistema de prazos | independentes |
| Logs | misturados | separados |

Os três primeiros itens eram requisito explícito ("restringir por IP/WAF sem
afetar o público") e **(b) não entrega nenhum deles**. O quarto é o que mais
pesa tecnicamente: o módulo de prazos é sistema de responsabilidade civil e não
pode ser redeployado por mudança de copy institucional.

**Custo aceito:** o repositório passa a ser monorepo de fato. Cada projeto
Vercel precisa de *Ignored Build Step* por caminho para não rebuildar à toa.

### D-0.3 — Postgres gerenciado na Neon, região São Paulo

Dado de saúde (CID, laudos) em território nacional simplifica o argumento de
LGPD e reduz latência com funções em `gru1`. O *branching* da Neon é útil para
testar migration contra cópia do dado real sem tocar produção.

### D-0.4 — RISCO ABERTO: plano Vercel Hobby

O escritório está hoje no plano Hobby. Isso quebra três coisas:

1. **Trusted IPs e regras de firewall são de plano pago.** No Hobby o sistema
   interno fica exposto na internet aberta, protegido apenas por senha + TOTP na
   camada da aplicação — exatamente o controle que motivou rejeitar a opção (a).
2. **Cron do Hobby é limitado e impreciso** (quantidade, granularidade diária,
   disparo dentro de uma janela e não em horário fixo, sem retry). A captura
   diária do DJEN "em horário fixo" não é entregável assim.
3. **Os termos do Hobby vedam uso comercial.** Sistema de gestão de escritório
   de advocacia é uso comercial. Suspensão de conta por violação de ToS derruba
   o sistema de prazos sem aviso e sem prazo de defesa.

O item 3 é o mais grave: 1 e 2 são mitigáveis com trabalho; 3 é um interruptor
na mão de terceiro. **Recomendação: migrar para Pro antes da Fase 2.**
Não bloqueia a Fase 0. Retomar antes de iniciar a captura.

### D-0.5 — Criptografia de coluna na aplicação, não em `pgcrypto`

Dados sensíveis de saúde (`dado_sensivel_cliente.conteudoCifrado`) e o segredo
TOTP são cifrados com AES-256-GCM **na aplicação**, gravados como `Bytes` no
layout `iv(12) || tag(16) || ciphertext`.

Motivo para recusar `pgcrypto`: a chave viajaria no texto do comando SQL e
acabaria em log de *slow query* ou de erro do Postgres — ou seja, o mecanismo de
proteção vazaria a própria chave. A coluna `versaoChave` permite rotação da
chave mestra sem reescrever histórico.

### D-0.6 — Invariantes no banco, não só na aplicação

Regra que vive só no código da aplicação é contornada por script pontual,
console de admin ou bug futuro. Como perda de prazo gera responsabilidade civil
do advogado, as regras estruturantes estão em CHECK constraints e triggers
(`20260730120100_invariantes_prazo_e_auditoria`):

- prazo de `CAPTURA_AUTOMATICA` só existe em `PENDENTE_CONFERENCIA` enquanto não
  houver confirmante nominal;
- confirmação, cumprimento e cancelamento exigem autor + data (cancelamento
  exige ainda justificativa com ao menos 10 caracteres);
- `DELETE` bloqueado por trigger em `prazo` e `publicacao`;
- `auditoria` e `acesso_dado_sensivel` são append-only por trigger de nível
  *statement* (a tentativa falha mesmo atingindo zero linhas) e por `REVOKE` de
  `UPDATE`/`DELETE` no role da aplicação;
- captura `CONCLUIDA_SEM_PUBLICACOES` exige confirmação humana — "não houve
  publicação" é uma afirmação, não um silêncio;
- lead só é contatável com consentimento datado (Prov. 205/2021 + LGPD art. 7º, I);
- provisão de êxito nunca pode estar marcada como recebida.

Verificadas por `prisma/testes/invariantes.sql`: 32 casos que tentam ativamente
quebrar cada regra, executados contra PostgreSQL 16 real. Constraint que nunca
foi violada de propósito não é garantia, é esperança.

### D-0.7 — Defeito encontrado e corrigido: deduplicação de publicação órfã

A chave de deduplicação especificada é
`(hashConteudo, numeroProcessoDigitos, dataDisponibilizacao)`. Com índice
`UNIQUE` padrão isso **não deduplica publicação órfã**: em SQL `NULL <> NULL`, e
`numeroProcessoDigitos` é exatamente NULL quando o número do processo não foi
identificado — o caso que cai na fila de triagem manual. Cada execução do cron
reinseriria a mesma publicação órfã, inundando a triagem.

Corrigido com `NULLS NOT DISTINCT` (PostgreSQL 15+) no índice, recriado na
migration de invariantes. É uma divergência consciente do datamodel do Prisma,
que ainda não expressa essa opção. Coberto por três testes de deduplicação.

### D-0.8 — Feriado municipal segue o órgão julgador, não o tribunal

O calendário é por tribunal e versionado, como pedido. Mas a aplicação dos
feriados **municipais** não pode seguir a sede do tribunal: um processo do TRT-18
em Anápolis não para no feriado de Goiânia. Por isso `OrgaoJulgador` carrega
`municipio`/`uf`, `Processo` aponta para ele, e o motor compõe:

```
feriados nacionais
  + estaduais (UF do órgão)
  + municipais (município do órgão)
  + calendário do tribunal (filtrado por órgão quando a portaria for específica)
```

`DiaNaoUtilTribunal.orgaoJulgadorId` existe porque portaria frequentemente
suspende expediente só em uma vara ou comarca. `suspendeExpediente` é booleano
explícito e não inferido do tipo, porque ponto facultativo pode ou não suspender
expediente — depende de ato do tribunal. `fonte` é obrigatório: dado de
calendário sem origem registrada não é defensável.

### D-0.9 — Versionamento do cálculo

`Prazo` guarda `versaoMotor` e `calendarioId`. Sem isso, um recálculo futuro
apagaria o raciocínio que fundamentou a decisão tomada à época — que é
justamente o que o escritório precisaria exibir em caso de questionamento.

### D-0.10 — Leads dos simuladores hoje vivem numa planilha Google

O site envia leads (nome, WhatsApp, e-mail, valor estimado) por `fetch` para um
Google Apps Script que grava em Planilha Google
(`scripts/google-apps-script/Codigo.gs`). O consentimento já é capturado de forma
adequada — checkbox obrigatório, com `consentimentoLGPD`, `timestamp` e `origem`
(UTM) no payload, e o contato é iniciado pelo próprio titular via WhatsApp, o que
está correto perante o Prov. 205/2021.

Pendências registradas: o Google atua como **operador** sem contrato formalizado,
e o dado fica fora do banco com controle de acesso próprio. Migração para a
tabela `lead` fica na Fase 3.

---

### Perguntas em aberto para a Fase 1

1. **Prazo em dias corridos no previdenciário administrativo (INSS).** O enum
   `RegimeContagem` prevê `DIAS_CORRIDOS`, mas quais atos do escritório usam esse
   regime precisa ser confirmado antes de o motor decidir sozinho.
2. **Recesso de 20/12 a 20/01 — suspensão x prorrogação.** Precisa confirmar o
   tratamento desejado para prazo que *iniciaria* dentro do recesso versus prazo
   que apenas o atravessa.
3. **Prazo em dobro por litisconsortes (CPC 229).** Só se aplica a autos físicos;
   como o escritório trabalha majoritariamente em PJe, confirmar se deve
   permanecer disponível como opção manual.
