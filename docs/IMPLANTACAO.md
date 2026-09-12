# Implantação — passo a passo

Este documento descreve o que precisa ser feito **por uma pessoa do escritório**
para colocar o sistema no ar. Nada aqui é automático, e há duas decisões de
contratação que só os sócios podem tomar (plano da Vercel e plano do Neon).

Ordem recomendada: 1 → 8. Os passos 6 e 7 são os que impedem o sistema de ser
usado para valer se forem pulados.

---

## 1. Banco de dados (Neon)

1. Criar projeto no [Neon](https://neon.tech), região **`sa-east-1` (São Paulo)**
   — dado de cliente sob sigilo não precisa atravessar fronteira, e a latência
   para GO/PI/MA é menor.
2. Plano: **Launch ou superior**. O plano Free tem janela de recuperação de
   apenas 24 horas e o banco hiberna — o primeiro acesso do dia esperaria o
   banco acordar.
3. Copiar a *connection string* com `?sslmode=require`.

## 2. Projeto na Vercel

1. Novo projeto apontando para o repositório, **branch a definir com o escritório**.
2. **Root Directory: `interno/`** — isto é essencial. O repositório contém
   também o site institucional, que é outro projeto.
3. Framework: Next.js (detectado automaticamente).
4. Plano: **Pro**. Duas razões, ambas concretas:
   - os termos do plano Hobby **vedam uso comercial**;
   - Trusted IPs e regras de firewall, que restringem o acesso ao sistema às
     redes do escritório, só existem a partir do Pro.

## 3. Variáveis de ambiente

No projeto da Vercel, em *Settings → Environment Variables* (Production):

| Variável | Como gerar / obter |
|---|---|
| `DATABASE_URL` | Connection string do Neon, com `?sslmode=require` |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CHAVE_CRIPTOGRAFIA_V1` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL` | `1` |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `NEXT_PUBLIC_URL_BASE` | A URL final do sistema, ex.: `https://interno.hrsadvocacia.com.br` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

> **Guarde `CHAVE_CRIPTOGRAFIA_V1` no cofre do escritório, separada do backup do
> banco.** Sem ela, segredo TOTP e dado de saúde ficam ilegíveis para sempre.
> Junto do backup, ela anula a criptografia. Nunca no repositório.

## 4. Primeiro deploy e carga inicial

```bash
# Localmente, apontando para o banco de produção:
export DATABASE_URL="postgresql://...neon.tech/...?sslmode=require"
cd interno
npm ci
npm run migrate:deploy      # cria tabelas, CHECKs e triggers
npm run seed                # tribunais, feriados nacionais, contas e templates
```

O `seed` imprime **uma única vez** a senha temporária e o QR/URI do 2FA de cada
conta. Anote e entregue **pessoalmente** a cada pessoa. Cada um troca a senha no
primeiro acesso (o sistema exige).

Depois, endurecer o acesso do banco:

```sql
-- Role da aplicação sem poder alterar o que é append-only
CREATE ROLE hrs_app LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hrs_app;
REVOKE UPDATE, DELETE ON "auditoria", "acesso_dado_sensivel" FROM hrs_app;
REVOKE DELETE ON "prazo", "publicacao", "envio_mensagem" FROM hrs_app;
```
E trocar a `DATABASE_URL` da Vercel para esse role.

## 5. Restrição de rede (assim que o plano permitir)

Em *Settings → Firewall*, restringir o acesso aos IPs do escritório. O portal do
cliente (`/portal/*`) precisa continuar aberto — é a única rota pública, e ela
se protege por token com validade e revogação.

## 6. Calendários — sem isto o sistema recusa calcular prazo

O motor **se recusa** a calcular enquanto o calendário do tribunal estiver em
rascunho. Isto é deliberado: data sobre calendário não conferido é número com
aparência de fundamento.

Para cada um dos nove tribunais (TRT-18, TRT-22, TRT-16, TRF-1, TJGO, TJPI,
TJMA, TST, STJ), um **sócio** precisa, em **Calendários**:

1. lançar os feriados estaduais de GO, PI e MA;
2. lançar os feriados municipais de Goiânia, Teresina e Timon (e das comarcas
   onde houver processo — o feriado que conta é o do **município do órgão
   julgador**, não o da sede do tribunal);
3. lançar as suspensões de expediente por portaria do tribunal;
4. **aprovar** a versão, que passa a VIGENTE.

A lista do que precisa ser preenchido, com espaço para a fonte de cada data,
está em `docs/CALENDARIO.md`. Cada lançamento exige a fonte — portaria, número e
data — porque calendário errado perde prazo e ninguém percebe.

## 7. Teste de restauração do backup

Antes de confiar o controle de prazos ao sistema, executar **uma vez** o
procedimento de `docs/BACKUP.md` e preencher a tabela de testes. Com o banco
ainda vazio é o momento mais barato de descobrir que falta algo.

## 8. Conferência final antes de usar para valer

- [ ] Cada pessoa entrou, trocou a senha e cadastrou o 2FA no aplicativo
- [ ] Os nove calendários estão VIGENTES para o ano corrente
- [ ] Um prazo de teste foi lançado e a data fatal confere com a conta feita à mão
- [ ] O job de alertas rodou (ver `/auditoria`, ação "Alteração", entidade `alerta_prazo`)
- [ ] O teste de restauração está registrado em `docs/BACKUP.md`
- [ ] O escritório decidiu **quando** parar de conferir prazo pelo método antigo
      — e essa data é depois de o sistema ter sido conferido em paralelo por
      pelo menos um mês

> O último item é o mais importante. Enquanto a captura automática não existir
> (DJEN não verificado), este sistema é um **controle de prazos lançados à
> mão** — melhor que planilha, mas não substitui a conferência diária que o
> escritório já faz. Desligar o método antigo antes disso é trocar um controle
> que funciona por um que ainda não foi provado no dia a dia.
