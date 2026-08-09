# HRS Interno — sistema de gestão do escritório

Ferramenta de back office do HRS Advocacia & Consultoria Jurídica (Goiânia/GO,
Teresina/PI, Timon/MA). **Não é o site público de captação.** Os dados aqui estão
sob sigilo profissional (art. 34, VII, EAOAB) e incluem dados pessoais sensíveis
de saúde em matéria previdenciária.

> **Princípio estruturante: o sistema assiste; o advogado decide.**
> Nenhum prazo de origem automática é válido sem confirmação humana nominal.
> Nenhum prazo é apagado. Nenhuma data é exibida sem os insumos do cálculo.

## Arquitetura

Projeto Vercel **separado** do site institucional, com *Root Directory* em
`interno/`. Variáveis de ambiente, Trusted IPs/WAF, cadência de deploy e logs
são escopados por projeto na Vercel — um route group ou middleware de host no
projeto do site público não separaria nenhum dos quatro. Ver `docs/DECISOES.md`.

- Next.js 16 (App Router) · React 19 · TypeScript
- PostgreSQL gerenciado (Neon, região São Paulo) · Prisma 7
- Auth.js v5 com credenciais + **TOTP obrigatório para todos os perfis**

## Como rodar

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL, AUTH_SECRET e as chaves
npm run migrate:deploy
npm run seed                # imprime as credenciais iniciais UMA vez
npm run dev
```

### Scripts

| Script | O que faz |
|---|---|
| `npm test` | Testes unitários das bibliotecas puras |
| `npm run test:invariantes` | Tenta violar cada invariante do banco (exige `DATABASE_URL`) |
| `npm run typecheck` | Verificação de tipos |
| `npm run migrate:deploy` | Aplica as migrations |
| `npm run seed` | Estrutura inicial e contas |

## Bases legais do tratamento (LGPD)

Registro exigido pelo art. 37 da LGPD. Cada tratamento e sua base:

| Tratamento | Base legal | Onde vive |
|---|---|---|
| Cadastro de cliente (nome, endereço, contatos) | Art. 7º, V — execução de contrato | `cliente`, `endereco_cliente`, `contato_cliente` |
| CPF/CNPJ, dados para procuração e petição | Art. 7º, II — obrigação legal | `cliente` |
| Dados de saúde (CID, laudos, perícia) | **Art. 11, II, "d"** — exercício regular de direitos em processo | `dado_sensivel_cliente` (tabela apartada, cifrada) |
| Processos, movimentações, prazos | Art. 7º, V e art. 7º, II | `processo`, `movimentacao`, `prazo` |
| Honorários, parcelas, recibos | Art. 7º, II — obrigação legal fiscal | `contrato_honorarios`, `parcela`, `lancamento_honorarios` |
| Leads dos simuladores | **Art. 7º, I — consentimento** (datado e com origem) | `lead` |
| Log de auditoria | Art. 7º, II e art. 16, I | `auditoria`, `acesso_dado_sensivel` |

**Dados de saúde** ficam em tabela apartada, cifrados com AES-256-GCM na
aplicação, com o id do registro como AAD — um blob copiado para a linha de outro
cliente não decifra. Cada leitura é registrada individualmente em
`acesso_dado_sensivel`, que é append-only.

## Segurança

- **2FA obrigatório.** Senha e código TOTP são conferidos na mesma chamada: um
  fluxo em duas etapas exigiria uma sessão "meio autenticada" entre elas, que é
  um estado a mais para proteger e um alvo a mais para contornar o 2FA.
- **Anti-replay no TOTP.** O contador usado é gravado; o mesmo código não vale
  duas vezes. Sem isso, quem visse o código por cima do ombro teria até 90s.
- **Senhas em scrypt** (RFC 7914), nativo do Node. Sem senha padrão no código.
- **Sessão de 30 minutos.** O `proxy` na borda só confere se há JWT; usuário
  ainda ativo e permissão são reconferidos no banco a cada página e server
  action (`lib/sessao.ts`) — o JWT sozinho continuaria válido por até 30 minutos
  depois de alguém ser desligado do escritório.
- **Log append-only garantido pelo banco**, não pelo Prisma: trigger de nível
  *statement* mais `REVOKE` de `UPDATE`/`DELETE` no role da aplicação.
- **Sem dado de cliente em log.** `lib/auditoria-regras.ts` recusa descrição que
  contenha o que aparente ser CPF, CNPJ, e-mail ou telefone.
- **Sem requisição a terceiros.** Nenhuma fonte externa, CDN ou telemetria: cada
  chamada a partir de uma tela com dado de cliente entregaria padrão de uso a
  quem não é operador contratado.

### Lacunas conhecidas nesta fase

- **Rate limiting por IP não implementado.** Há bloqueio de conta após 5
  tentativas malsucedidas, o que contém força bruta contra uma conta conhecida,
  mas não há limite por origem. Consequência: é possível inflar a tabela de
  auditoria com tentativas anônimas. Exige um armazenamento compartilhado
  (decisão pendente) e entra na Fase 1.
- **Plano Vercel Hobby** não oferece Trusted IPs nem regras de firewall, e seus
  termos vedam uso comercial. Ver `docs/DECISOES.md`, D-0.4.

## Estado por fase

| Fase | Situação |
|---|---|
| 0 — Fundação | **Entregue**: schema, migrations, auth com 2FA, RBAC, auditoria, CRUD de clientes e processos, seed |
| 1 — Prazos manuais | **Entregue**: motor de contagem, calendário por tribunal, cadastro e conferência de prazo, alertas escalonados, painel |
| 2 — Captura DJEN | **Parcial**: interface de fontes, deduplicação, triagem, vigilância da captura, checklist do Domicílio e lançamento manual entregues. O adaptador do DJEN aguarda verificação do contrato da API (ver `docs/DECISOES.md`, D-2.1) |
| 3 — Honorários e contato | Não iniciada |
| 4 — Portal do cliente | Não iniciada |

Até a Fase 2 **não há captura automática de publicações**: todo prazo é lançado
à mão. O painel diz isso em tela, para que a ausência de alerta nunca seja lida
como ausência de prazo.

### Antes de usar o módulo de prazos em produção

O cálculo é **recusado** enquanto o calendário do tribunal estiver em rascunho.
Para liberá-lo, um sócio precisa, em **Calendários**, lançar as suspensões de
expediente por portaria e os feriados estaduais e municipais da praça (lista em
`docs/CALENDARIO.md`) e aprovar a versão. Sem isso, o sistema se recusa a
calcular e diz por quê — é deliberado: data sobre calendário não conferido é
número com aparência de fundamento.

### Variáveis adicionais

`CRON_SECRET` — segredo que autentica o job diário de alertas
(`/api/cron/alertas`, agendado em `vercel.json` para 11h UTC / 8h em Brasília).
