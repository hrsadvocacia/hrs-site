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

Verificadas por `prisma/testes/invariantes.sql`: 30 casos que tentam ativamente
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

### D-0.11 — Sem dependência para criptografia, TOTP e hash de senha

`node:crypto` resolve os três. Uma biblioteca a mais nessa camada é superfície de
supply chain no ponto exato que protege dado de saúde e segundo fator.

O TOTP em particular foi implementado em vez de importado porque a RFC 6238
publica **vetores de teste oficiais**: dá para *provar* que a implementação está
correta, em vez de confiar no changelog de um pacote. Todos os vetores do
Apêndice B passam (SHA-1, SHA-256, SHA-512).

Senhas usam **scrypt** (RFC 7914): resiste melhor que bcrypt a hardware
dedicado e evita depender de binário nativo de argon2 no runtime da Vercel.

### D-0.12 — Login em etapa única

Senha e código TOTP são conferidos na mesma chamada. Um fluxo em duas etapas
exigiria emitir uma sessão "meio autenticada" entre a senha e o código — um
estado a mais para proteger e um alvo a mais para contornar o 2FA. Ou os três
fatores conferem e nasce sessão completa, ou não nasce sessão alguma.

Todas as recusas devolvem a **mesma** mensagem, para não revelar se o e-mail
existe, se a senha estava certa ou se apenas o código falhou.

Anti-replay: o contador TOTP usado é gravado e o mesmo código não vale duas
vezes — verificado no sistema em execução, não só em teste unitário.

### D-0.13 — Sessão curta, com reconferência no banco

O `proxy` (antigo middleware) roda na borda e só confere se há JWT válido, o que
continuaria verdadeiro por até 30 minutos depois de alguém ser desligado do
escritório. `lib/sessao.ts` reconfere usuário ativo e perfil no banco a cada
página e server action, no runtime Node. Perfil revogado perde acesso na hora.

### D-0.14 — Nenhuma requisição a terceiros

Sem fonte externa, sem CDN, sem telemetria do Next. Cada chamada a partir de uma
tela com dado de cliente entregaria padrão de uso a quem não é operador
contratado formalmente. A pilha de fontes do sistema resolve a tipografia.

### D-0.15 — Segundo defeito de NULL, agora em `feriado_geral`

Mesma classe do D-0.7. Feriado nacional tem `uf` e `municipio` nulos; com índice
`UNIQUE` padrão o mesmo feriado entraria duas vezes, e o motor de prazos
descontaria o dia em dobro ao compor o calendário. Corrigido com
`NULLS NOT DISTINCT`.

Vale a generalização: **toda chave única deste schema que contenha coluna
anulável precisa de `NULLS NOT DISTINCT`**, e o Prisma não expressa isso.

### D-0.16 — Calendário incompleto por opção deliberada

O seed carrega apenas feriados nacionais de lei federal. Feriado estadual,
municipal e suspensão por portaria ficam em branco, listados em
`docs/CALENDARIO.md` para preenchimento humano com fonte registrada.

Um feriado inventado é **pior** que um ausente: o motor contaria um dia útil a
menos e entregaria data fatal errada com aparência de fundamentada. Por isso os
calendários nascem em `RASCUNHO` e as revisões anuais em `PENDENTE`.

### D-0.17 — LACUNA: rate limiting por IP não implementado

Há bloqueio de conta após 5 tentativas malsucedidas, o que contém força bruta
contra uma conta conhecida. **Não há** limite por origem, então é possível
inflar a tabela de auditoria com tentativas anônimas. Fazer isso direito exige
armazenamento compartilhado (Upstash/Redis) — dependência que não quis
adicionar sem decisão do escritório. Entra na Fase 1.

### Verificação da Fase 0

Nada aqui foi entregue "provavelmente funcionando":

- 115 testes unitários das bibliotecas puras, verdes;
- 30 testes de invariante que tentam ativamente violar cada regra, executados
  contra PostgreSQL 16 real;
- vetores de CPF, CNPJ, dígito verificador CNJ e datas de Páscoa conferidos por
  implementação independente, em Python;
- migrations aplicadas de verdade e seed executado duas vezes para provar
  idempotência;
- build de produção do Next.js;
- login exercitado de ponta a ponta com código TOTP real, e os casos negativos
  (código errado, senha errada, usuário inexistente, reuso do código) todos
  bloqueados no sistema em execução;
- imutabilidade da auditoria testada por conexão de superusuário — `UPDATE` e
  `DELETE` recusados.

---

### D-0.18 — Identidade visual extraída do timbrado, não aproximada

O layout segue o timbrado oficial (`Timbrado_HRS.docx`). A paleta foi
**amostrada da própria arte**, não escolhida por semelhança:

| Elemento | Cor | Onde aparece no timbrado |
|---|---|---|
| Azul institucional | `#3858AB` | texto "ADVOCACIA & CONSULTORIA JURÍDICA" |
| Azul do rodapé | `#709FDB` | linha de assinatura |
| Dourado (gradiente) | `#F9E08A` → `#F4CE57` → `#C08A1B` | letras "HRS" e a regra |

A arte da marca é **ativo fixo**: `public/marca/hrs-logo.png` foi recortada do
próprio `.docx` (com fundo tornado transparente), nunca recriada com fontes.

Estrutura da página espelha a folha timbrada: marca centralizada no topo, regra
dourada atravessando, navegação discreta abaixo, e o rodapé reproduzindo a
assinatura na íntegra — "Holanda, Ramalho & Sousa | Advocacia & Consultoria
Jurídica | Teresina – PI / Timon – MA / Goiânia – GO".

Tipografia Calibri, como no documento, com Carlito de fallback (métrica
idêntica). **Nenhuma fonte vem de CDN** — chamada a terceiro a partir de tela
com dado de cliente entregaria padrão de uso a quem não é operador contratado.

Há folha de impressão (`@media print`): a página impressa esconde a navegação e
fixa o rodapé, virando o timbrado literal.

### D-0.19 — Ortografia e rótulos: correções encontradas na revisão visual

Duas coisas que só apareceram ao olhar as telas:

1. **Texto sem acentuação.** O sistema exibia "fundacao", "publicacoes",
   "Socio". Inaceitável num escritório cujo próprio timbrado escreve "JURÍDICA"
   e "Goiânia". Corrigido em todo o texto visível, inclusive nas premissas que o
   motor de prazos devolve ao advogado.
2. **Valores de enum crus na tela** — "EM_ANDAMENTO", "PARTE_CONTRARIA",
   "PRIMEIRO". Identificador de banco não é texto de interface. Criado
   `lib/rotulos.ts` com um mapa único de rótulos, de modo que lista, ficha e
   relatório nunca divirjam no nome da mesma coisa.

O script de acentuação quebrou duas coisas que precisaram de conserto: um
identificador (`usuario` → `usuário`) e um nome de classe CSS (`aviso-atencao`
→ `aviso-atenção`), este último apagando silenciosamente o destaque de um
aviso. Ficou a lição: substituição em massa sobre código exige varredura de
verificação depois — foi ela que pegou os dois. A varredura de classes usadas
contra as definidas no CSS ficou no processo.

### Decisões de contagem tomadas pelo escritório (para a Fase 1)

**D-1.1 — Sem prazo em dobro.** O CPC 229, §2º já afasta a dobra por
litisconsórcio em autos eletrônicos, que é a realidade do PJe. A ausência erra
para o lado seguro: o sistema calcula data igual ou anterior à real, nunca
posterior — no pior caso protocola-se cedo demais, e não há caminho para perda
de prazo.

**D-1.2 — Recesso de 20/12 a 20/01.** Prazo processual **suspende** o curso
(CLT art. 775-A; CPC art. 220). Prazo penal, material e administrativo
**continua correndo**. Suspender não é "não contar o dia": o relógio para e
volta a correr em 21/01, de modo que prazo que venceria dentro do recesso é
empurrado para depois dele, e prazo cujo termo inicial cairia no recesso só
começa a correr no primeiro dia útil seguinte a 20/01.

**D-1.3 — Dias corridos.** Aplicável a prazo do INSS em sede administrativa
(Lei 9.784/1999) e a prazo material/decadencial. Criado também
`DIAS_CORRIDOS_PENAL` (CPP art. 798), separado porque ambos correm no recesso
mas o fundamento legal exibido ao advogado é diferente.

O comportamento no recesso ficou amarrado ao `RegimeContagem`, com o fundamento
de cada caso documentado no próprio enum — e não como regra implícita no motor.

---

## Fase 1 — Prazos

### D-1.4 — O cálculo é RECUSADO sobre calendário em rascunho

`calcularParaProcesso` exige `CalendarioTribunal` com status `VIGENTE`. Enquanto
as portarias não forem lançadas e o calendário não for aprovado, o sistema se
recusa a calcular e diz por quê.

É a decisão mais importante desta fase. Produzir uma data a partir de calendário
não conferido seria entregar um número com **aparência de fundamento** — pior
que não entregar nada, porque o advogado confiaria nele.

### D-1.5 — Sócio mantém o calendário, não só o administrador

Correção ao RBAC da Fase 0. Quem conhece as portarias do tribunal é advogado.
Deixar a manutenção do calendário apenas com o perfil `ADMIN` colocaria um leigo
decidindo o que suspende expediente — decisão com consequência de prazo.

Calendário vigente **não se edita**: cria-se nova versão, e a anterior vira
`SUBSTITUIDO` em vez de sumir, porque prazos já calculados apontam para ela e
precisam continuar reconstituíveis.

### D-1.6 — Alertas: o marco mais próximo, não a fila inteira

Se o cron ficar dois dias fora do ar, o advogado recebe "faltam 3 dias" — e não
uma enxurrada de D-10 e D-5 já superados, que confunde mais do que informa. O
que ficou para trás continua visível no painel.

Escalonamento ao sócio a partir de D-3 sem tratativa registrada, como alerta
**adicional**: o responsável continua recebendo o dele, porque escalar não é
substituir.

Idempotência pela chave única `(prazo, marco, canal, destinatário)` — o cron da
Vercel não garante execução exatamente-uma-vez.

### D-1.7 — Prazo vencido sem baixa não sai da tela

O sistema não encerra prazo sozinho. Data ultrapassada sem cumprimento nem
cancelamento registrados vira bloco vermelho no topo do painel, separado da
lista geral: no meio da rotina, passaria despercebido.

Do mesmo modo, `PENDENTE_CONFERENCIA` nunca é exibido como "normal", ainda que
falte muito tempo — prazo capturado e não conferido não é prazo controlado, e
mostrá-lo como rotina daria falsa sensação de controle.

### D-1.8 — Bug encontrado ao exercitar: o cron nunca rodaria

O `proxy` de autenticação interceptava `/api/cron/*` e devolvia redirecionamento
para a tela de login. O job da Vercel receberia um 307 e **falharia em silêncio
todos os dias** — exatamente o modo de falha que este sistema não pode ter.

Descoberto porque o endpoint foi chamado de verdade, não porque compilava. O
cron agora se autentica por `CRON_SECRET` no cabeçalho e está fora da triagem
de sessão; a recusa por segredo ausente ou errado foi verificada (401).

---

## Fase 2 — Captura (parcial)

### D-2.1 — BLOQUEIO: o contrato do DJEN não pôde ser verificado

A política de rede deste ambiente recusa a saída para `comunicaapi.pje.jus.br`
(403 no CONNECT do proxy; só o GitHub está liberado). Sem uma resposta real, o
mapeamento do payload seria suposição.

**O adaptador foi escrito até onde é verificável e para ali.** `montarUrl` está
pronto e testado; `mapear` lança `ContratoNaoVerificadoError` — e há um teste
que TRAVA essa ausência, de modo que escrever um mapeamento por suposição
quebra a suíte e força a conversa sobre de onde veio o contrato.

Motivo: um mapeamento inventado compila, passa em teste com dado fabricado e,
em produção, silenciosamente não casa nenhum processo. Prazos deixariam de ser
capturados sem que nada acusasse erro — o pior modo de falha deste sistema.

Para concluir: obter a resposta crua (instruções no cabeçalho de
`lib/publicacoes/djen.ts`), escrever `mapear` a partir dos campos observados,
guardar a amostra e escrever um teste de contrato sobre ela.

### D-2.2 — Falha nunca vira "nenhuma publicação"

`FontePublicacao.consultar` **lança** em qualquer dúvida — rede fora, HTTP não
2xx, JSON inválido, contrato não verificado. Devolver lista vazia diante de uma
resposta que não se entendeu transformaria falha em "não há publicações", que é
exatamente o desfecho que faz perder prazo sem ninguém perceber.

Verificado com o cron real: as três inscrições registraram FALHA com a razão
(`[DJEN] A consulta respondeu 403.`), e nenhuma reportou ausência de publicações.

### D-2.3 — A ausência é detectada comparando esperado com observado

`captura_diaria` é aberta em PENDENTE **antes** da consulta. Um desenho que só
grava resultado não distingue "rodou e não havia nada" de "não rodou" — e um
cron que parou de disparar não escreve log de erro nenhum.

`pendenciasDeCaptura` percorre os dias úteis esperados e cobra cada inscrição.
Linha faltando, presa em PENDENTE, em FALHA, ou concluída sem publicações e sem
confirmação humana: tudo aparece em vermelho.

### D-2.4 — Homônimo prevalece sobre vinculação automática

Nome do escritório com OAB que não confere vira `SUSPEITA_HOMONIMO` mesmo
quando o CNJ casa com processo nosso. O processo provável fica registrado para
agilizar a decisão, mas a publicação não entra como vinculada: criar prazo num
caso que não é do escritório é tão ruim quanto perder um prazo.

### D-2.5 — Deduplicação normaliza o teor antes do hash

A mesma comunicação volta da fonte com espaçamento e quebra de linha
diferentes. Hash sobre o teor com espaços colapsados e Unicode em NFC. Órfã
(sem número de processo) é o caso que mais se repete e é justamente onde a
deduplicação ingênua falha — por isso o `NULLS NOT DISTINCT` do D-0.7.

### D-2.6 — Domicílio Judicial: controle humano, e assumido como tal

Não há integração, e a tela diz isso em letras grandes. Citação e intimação com
exigência de pessoalidade correm por lá e não aparecem no DJEN. O sistema
registra o ato humano de conferir e, sobretudo, torna visível o dia em que
ninguém conferiu. Alerta acima de um dia útil de atraso.

O formulário propõe o último DIA ÚTIL, não "hoje": confirmar num sábado
registraria um dia que a vigilância não cobra, o contador não baixaria e o
usuário concluiria, com razão, que o sistema está quebrado.

### D-2.7 — Alerta que vira parede de texto deixa de ser lido

Dez dias sem captura para três inscrições produziam trinta linhas idênticas na
tela. `resumirPendencias` agrupa por inscrição: "captura desta OAB parada há 10
dias úteis, de 27/07 a 07/08". O aviso que não pode passar despercebido é
justamente o que não pode ser cansativo de ler.

### O que falta na Fase 2

- `mapear` do DJEN, quando houver payload real;
- adaptador do DEJT como fonte de conferência;
- ligar o cron de captura em horário fixo (depende do plano Vercel, D-0.4).
