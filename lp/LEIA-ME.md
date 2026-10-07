# Landing page trabalhista — `/lp/trabalhista/`

Página de campanha para conteúdo trabalhista patrocinado (Instagram, TikTok, Google Ads) e para o link do Perfil da Empresa no Google. Fica fora do Google orgânico (`noindex`).

## Antes de patrocinar

1. **Revisão jurídica** (Dr. Paulo Renand): seção "Prazos que você precisa conhecer" e respostas de "Dúvidas comuns".
2. **Número de WhatsApp**: a página usa `5586988064858` (o mesmo do perfil do Google de Timon). Para trocar, altere `WHATSAPP` no script no fim de `index.html`.
3. **Pixels (opcional, recomendado)**: preencha os IDs no topo de `/rastreamento.js`. Campo vazio = nada é carregado.
   - Google Ads: `googleAds.id` (AW-…) e `googleAds.rotulo` da conversão "Contato WhatsApp".
   - Meta: `metaPixel`. TikTok: `tiktokPixel`. Analytics: `ga4`.

## Link para cada canal

Use sempre o link do canal. É a etiqueta UTM que diz de onde veio cada conversa.

| Canal | Link |
| --- | --- |
| Instagram patrocinado | `https://hrsadvocacia.adv.br/lp/trabalhista/?utm_source=instagram&utm_medium=pago&utm_campaign=rescisao-out26` |
| Instagram bio / stories | `https://hrsadvocacia.adv.br/lp/trabalhista/?utm_source=instagram&utm_medium=organico&utm_campaign=bio` |
| TikTok Ads | `https://hrsadvocacia.adv.br/lp/trabalhista/?utm_source=tiktok&utm_medium=pago&utm_campaign=rescisao-out26` |
| Google Ads (URL final) | `https://hrsadvocacia.adv.br/lp/trabalhista/?utm_source=google&utm_medium=cpc&utm_campaign=trabalhista` |
| Perfil Google — Timon | `https://hrsadvocacia.adv.br/lp/trabalhista/?utm_source=google&utm_medium=perfil&utm_campaign=gbp-timon` |

Ao trocar o criativo ou o mês, troque só o `utm_campaign` (ex.: `rescisao-nov26`).

## Como ler os resultados

Toda mensagem que chega pela página termina com uma etiqueta, por exemplo:

```
[origem: instagram/pago/rescisao-out26 · rescisao · checklist]
```

- 1º campo: canal/tipo/campanha.
- 2º campo: página (`rescisao`) ou `simulador-rescisao`.
- 3º campo: botão usado (`topo`, `checklist` ou `barra`).

Na planilha de funil, registre cada conversa com a etiqueta, o sócio responsável e o desfecho (qualificada → proposta → contrato). Ao fim de cada semana:

- **Custo por conversa** = gasto do canal ÷ conversas com aquela etiqueta.
- **Taxa de qualificação** = conversas qualificadas ÷ conversas.
- **Custo por contrato** = gasto ÷ contratos.

Regra de decisão sugerida para o teste de 14 dias: o canal continua se gerar conversa qualificada; criativo com cliques e sem mensagem indica problema na página ou no público, não no anúncio.
