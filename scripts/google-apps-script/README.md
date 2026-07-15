# Recebimento de leads na planilha (Google Apps Script)

Este script grava os leads do Simulador de Precatório/RPV em uma Planilha Google,
sem custo e sem servidor próprio. O contato com o cliente continua sendo humano,
feito a partir da planilha — nada é enviado automaticamente.

## Passo a passo (uma vez só)

1. **Crie a planilha**
   - Em https://drive.google.com → **Novo → Planilha Google**.
   - Nomeie (ex.: `Leads — Simulador Precatório`).
   - Copie o **ID** da planilha: na URL
     `https://docs.google.com/spreadsheets/d/`**`ESTE_TRECHO`**`/edit`.

2. **Cole o código do Apps Script**
   - Na planilha: menu **Extensões → Apps Script**.
   - Apague o conteúdo padrão e cole todo o `Codigo.gs` desta pasta.
   - Na linha `const SHEET_ID = '...'`, **cole o ID** copiado no passo 1.
   - Salve (ícone de disquete).

3. **Publique como Aplicativo da Web**
   - No editor do Apps Script: **Implantar → Nova implantação**.
   - Engrenagem **⚙ → Aplicativo da Web**.
   - **Descrição**: `Leads simulador`.
   - **Executar como**: *Eu* (sua conta).
   - **Quem pode acessar**: **Qualquer pessoa** (necessário para o site enviar sem login).
   - Clique **Implantar** e **autorize** o acesso quando pedir.
   - Copie a **URL do aplicativo da Web** (termina em `/exec`).

4. **Ligue o site ao script**
   - Abra `simulador/wizard.js`.
   - Na constante `LEAD_ENDPOINT`, cole a URL `/exec`:
     ```js
     const LEAD_ENDPOINT = 'https://script.google.com/macros/s/XXXX/exec';
     ```
   - Faça commit/deploy. Pronto: cada envio do formulário grava uma linha.

## Testar

- Abrir a URL `/exec` no navegador deve mostrar **`ok`** (health check).
- Preencher o formulário no site e conferir a nova linha na aba **Leads**.

## Observações

- **Colunas gravadas**: `timestamp, nome, whatsapp, email, ente, natureza, valorBruto, classificacao, consentimentoLGPD, origem`.
- **Anti-bot**: honeypot (campo oculto) + limite de 1 gravação a cada 30s por número.
  O Apps Script não expõe o IP de forma confiável, então o limite por IP citado
  no escopo não é aplicável aqui; se precisar de limite por IP, seria necessário
  um backend (fora do escopo da v1).
- **LGPD**: o script só grava com `consentimentoLGPD = true`. Defina, na sua
  política de privacidade, a finalidade, o prazo de retenção e o canal de
  exclusão dos dados.
- **Atualizar o código depois**: edite no Apps Script e faça
  **Implantar → Gerenciar implantações → editar → Nova versão**. A URL `/exec`
  continua a mesma.
