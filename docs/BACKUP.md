# Backup e restauração

Perder o banco deste sistema significa perder o controle de prazos do
escritório. Backup que nunca foi restaurado não é backup: é uma esperança.
Este documento descreve o procedimento e **exige o teste de restauração
documentado** — sem ele, a rotina não está concluída.

## O que o provedor já faz

O Neon mantém *point-in-time recovery* (PITR) na região `sa-east-1`. A janela
depende do plano contratado:

| Plano Neon | Janela de recuperação |
|---|---|
| Free | 24 horas |
| Launch | 7 dias |
| Scale | 30 dias |

O PITR do provedor cobre falha de infraestrutura e erro humano recente
(`DELETE` sem `WHERE`, migration equivocada). **Não cobre** encerramento da
conta, disputa comercial com o provedor nem exclusão da organização. Por isso
existe a cópia própria abaixo.

## Cópia própria — semanal, fora do provedor

Gerada por quem administra o sistema, guardada em local sob controle do
escritório (disco cifrado ou cofre de arquivos do escritório — **não** em
serviço de terceiro não contratado como operador, LGPD art. 39).

```bash
# 1. Dump lógico completo, com dados
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --file="hrs_interno_$(date +%Y-%m-%d).dump"

# 2. Cifrar antes de guardar. O dump contém dado sob sigilo profissional
#    e dado sensível de saúde — ainda que as colunas sensíveis já estejam
#    cifradas na aplicação, o restante (nome, CPF, teor de publicação) não está.
age -p -o "hrs_interno_$(date +%Y-%m-%d).dump.age" "hrs_interno_$(date +%Y-%m-%d).dump"
#    (ou: gpg --symmetric --cipher-algo AES256 <arquivo>)

# 3. Apagar o dump em claro
shred -u "hrs_interno_$(date +%Y-%m-%d).dump"
```

> A chave de criptografia da aplicação (`CHAVE_CRIPTOGRAFIA_V*`) **não** está no
> dump. Guarde-a separadamente, no mesmo cofre onde ficam as credenciais da
> Vercel. Dump sem a chave não recupera segredo TOTP nem dado de saúde; chave
> sem dump não recupera nada. Perder as duas coisas juntas é perder tudo — e
> guardá-las juntas anula a criptografia.

## Restauração

```bash
# Banco vazio de destino (Neon: criar um branch novo, ou base local)
createdb hrs_restauracao

# Restaurar
pg_restore --dbname="postgresql://.../hrs_restauracao" \
  --no-owner --no-privileges \
  hrs_interno_2026-09-12.dump

# Conferir que as invariantes vieram junto (triggers e CHECKs)
psql "postgresql://.../hrs_restauracao" -v ON_ERROR_STOP=1 \
  -f interno/prisma/testes/invariantes.sql
```

O último passo é o que distingue restauração de cópia de arquivos: se as
triggers de *append-only* e as CHECKs de prazo não vierem, o banco restaurado
aceita o que o original recusava.

## Teste de restauração — obrigatório e registrado

A cada trimestre, restaure o dump mais recente num banco descartável e
registre o resultado na tabela abaixo. O teste confere quatro coisas:

1. `pg_restore` termina sem erro;
2. `invariantes.sql` passa inteiro (todas as invariantes vieram);
3. contagem de linhas de `prazo`, `cliente`, `processo` e `auditoria` bate com
   a do dia do dump;
4. a aplicação sobe contra o banco restaurado e um login funciona — o que
   prova que a chave de criptografia guardada abre os segredos TOTP.

| Data do teste | Dump testado | Quem fez | Invariantes | Login | Observação |
|---|---|---|---|---|---|
| _(preencher no primeiro teste)_ | | | | | |

**Enquanto a primeira linha desta tabela estiver vazia, o escritório não sabe
se consegue restaurar.** Faça o primeiro teste antes de colocar o sistema em
produção, com o banco ainda vazio: é o momento mais barato de descobrir que
falta alguma coisa no procedimento.

## O que restaurar NÃO recupera

- Variáveis de ambiente da Vercel (guardadas no cofre do escritório);
- a chave `CHAVE_CRIPTOGRAFIA_V*`, se perdida — sem ela, segredo TOTP e dado de
  saúde ficam ilegíveis para sempre, e as contas precisam de novo cadastro de
  2FA;
- arquivos que estivessem em bucket externo (hoje não há: documento é cifrado
  dentro do próprio Postgres, D-3.6 — logo, entra no dump).
