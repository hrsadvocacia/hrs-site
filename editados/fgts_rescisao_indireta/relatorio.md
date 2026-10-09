# Relatório de edição — FGTS / rescisão indireta

**Vídeo final:** `fgts_rescisao_indireta_final.mp4` · **58,75 s** · 1080×1920 · 30 fps · H.264 High · yuv420p · ~11 Mbps · AAC 48 kHz 192 kbps estéreo · faststart
**Loudness medido no arquivo final:** −14,0 LUFS integrado · pico −1,8 dBTP · LRA 1,2 LU

---

## 1. Inventário dos brutos

| Arquivo | Duração | Resolução (após rotação) | fps | Áudio | Conteúdo |
|---|---|---|---|---|---|
| IMG_6769.MOV | 5,30 s | 1080×1920 (gravado 1920×1080, rot. −90°) | 30 | AAC 48 kHz estéreo | Gancho: "Pausa tudo e abre seu aplicativo do FGTS agora. Sério." |
| IMG_6774.MOV | 6,63 s | 1080×1920 (rot. −90°) | 30 | AAC 48 kHz estéreo | Contexto: "a caminho do escritório… uma coisa que quase ninguém sabe." |
| IMG_6776_1.mov | 16,80 s | 1080×1920 | 30 | AAC 48 kHz estéreo | Direito: não depositar/atrasar/pular mês = falta grave; TST; toda a Justiça do Trabalho |
| IMG_6777_1.mov | 28,30 s | 1080×1920 | 30 | AAC 48 kHz estéreo | Consequência: "demitir seu empregador", verbas rescisórias |
| IMG_6778.MOV | 13,23 s | 1080×1920 (rot. −90°) | 30 | AAC 48 kHz estéreo | Alerta: não peça demissão; só vale com decisão judicial (rescisão indireta) |
| IMG_6780.MOV | 12,67 s | 1080×1920 (rot. −90°) | 30 | AAC 48 kHz estéreo | Procure um advogado; salve e mande para alguém |
| IMG_6781.MOV | 5,23 s | 1080×1920 (rot. −90°) | 30 | AAC 48 kHz estéreo | Fecho: "o escritório e os processos não esperam" |

Total bruto: 88,2 s. Todos em SDR BT.709.

## 2. Agrupamento e escolha de takes

Os 7 arquivos **não são takes repetidos**: são **trechos sequenciais de um único roteiro**, gravados um por vez. Por isso viraram **um único vídeo final**, montado na ordem 6769 → 6774 → 6776 → 6777 → 6778 → 6780 → 6781. Não havia take alternativo para comparar em nenhum trecho, então cada trecho usa o único take existente. Todos têm o olhar na câmera, a mesma luz natural (dia claro, carro parado) e áudio equivalente.

- **Gancho (IMG_6769):** "Pausa tudo e abre seu aplicativo do FGTS agora. Sério." Dito com firmeza logo na primeira palavra, sem tropeço. O vídeo começa nessa primeira palavra (0,5 s do bruto).
- **Trilha de áudio:** cada arquivo tem uma única faixa estéreo. O canal **esquerdo** teve a melhor relação voz/ruído em todos os 7 arquivos (1–4 dB acima do direito), então usei ele em mono como a faixa da lapela.

## 3. Cortes

**Remoção de pausas:** cortei as pausas acima de ~0,15 s com jump cuts secos, deixando ~30 ms de respiro em cada borda. As bordas são recuadas automaticamente quando há sibilante ("s" de "mês", "FGTS"), para não comer o fim das palavras. Conferi com reconhecimento de fala que nenhuma palavra ficou truncada; quatro pontos precisaram de ajuste manual: "mês", "preceito", "vencidas" e "está valendo".

**Cortes de conteúdo** (só remoção, sem reescrever nada; foram necessários para caber em ≤ 59 s):
1. "**Ou seja,**" antes de "multa de 40%" (muleta).
2. "**ainda assim**" em "pedir demissão judicialmente e ~~ainda assim~~ receber todos os direitos".
3. "**e por aí vai**" depois de "férias vencidas".
4. "**e sempre procure a orientação de um advogado**" depois de "manda pra alguém". É repetição de "procura um advogado pra te orientar", dito segundos antes.

**Aceleração:** mesmo com esses cortes, a fala líquida somou 66,7 s. Para manter **todas** as partes do roteiro (contexto e fecho incluídos) e ficar abaixo de 59 s, apliquei **aceleração de 1,135×** em áudio e vídeo, com o tom de voz preservado (atempo). Isso é comum em vídeo curto, e a voz continua natural. Se preferir sem aceleração, a alternativa é tirar o contexto ("Eu tô aqui agora a caminho do escritório") e o fecho ("Agora deixa eu ir…"). Isso dá ~59 s em velocidade normal, mas perde dois blocos do roteiro.

**Ritmo visual:** 45 trechos, com média de 1,3 s por plano no vídeo final e nenhum plano acima de 2,5 s. O zoom alterna entre 100% e 110% (punch-in centrado no rosto) a cada corte. Nas frases-chave entra um **punch-in de 116%**: "falta grave", "não peça demissão" e "rescisão indireta".

### Lista de cortes (EDL)

| # | Arquivo | Trecho original (s) | No vídeo final (s) | Zoom | Tipo |
|---|---|---|---|---|---|
| 1 | IMG_6769 | 0.43–2.93 | 0.00–2.20 | 100% | jump cut |
| 2 | IMG_6769 | 2.93–4.30 | 2.20–3.41 | 110% | jump cut |
| 3 | IMG_6769 | 4.47–4.97 | 3.41–3.85 | 100% | jump cut |
| 4 | IMG_6774 | 0.43–2.97 | 3.85–6.08 | 110% | jump cut |
| 5 | IMG_6774 | 3.17–5.17 | 6.08–7.84 | 100% | jump cut |
| 6 | IMG_6774 | 5.33–6.40 | 7.84–8.78 | 110% | jump cut |
| 7 | IMG_6776 | 0.20–3.03 | 8.78–11.28 | 100% | jump cut |
| 8 | IMG_6776 | 3.03–4.97 | 11.28–12.98 | 110% | jump cut |
| 9 | IMG_6776 | 5.23–6.47 | 12.98–14.07 | 100% | jump cut |
| 10 | IMG_6776 | 6.80–7.23 | 14.07–14.45 | 110% | jump cut |
| 11 | IMG_6776 | 7.33–9.20 | 14.45–16.09 | 116% | punch-in frase-chave |
| 12 | IMG_6776 | 9.63–10.83 | 16.09–17.15 | 110% | jump cut |
| 13 | IMG_6776 | 10.97–12.30 | 17.15–18.33 | 100% | jump cut |
| 14 | IMG_6776 | 12.40–12.93 | 18.33–18.80 | 110% | jump cut |
| 15 | IMG_6776 | 13.33–15.47 | 18.80–20.68 | 100% | jump cut |
| 16 | IMG_6776 | 15.77–16.47 | 20.68–21.29 | 110% | jump cut |
| 17 | IMG_6777 | 0.13–2.40 | 21.29–23.29 | 100% | jump cut |
| 18 | IMG_6777 | 2.40–4.20 | 23.29–24.88 | 110% | jump cut |
| 19 | IMG_6777 | 4.63–5.23 | 24.88–25.40 | 100% | jump cut |
| 20 | IMG_6777 | 5.80–6.70 | 25.40–26.20 | 110% | jump cut |
| 21 | IMG_6777 | 6.80–9.37 | 26.20–28.46 | 100% | jump cut |
| 22 | IMG_6777 | 10.63–11.37 | 28.46–29.10 | 110% | jump cut |
| 23 | IMG_6777 | 11.53–14.13 | 29.10–31.40 | 100% | jump cut |
| 24 | IMG_6777 | 14.37–15.33 | 31.40–32.25 | 110% | jump cut |
| 25 | IMG_6777 | 15.60–16.63 | 32.25–33.16 | 100% | jump cut |
| 26 | IMG_6777 | 18.47–19.77 | 33.16–34.30 | 110% | jump cut |
| 27 | IMG_6777 | 19.87–20.73 | 34.30–35.07 | 100% | jump cut |
| 28 | IMG_6777 | 21.20–22.67 | 35.07–36.36 | 110% | jump cut |
| 29 | IMG_6777 | 22.77–24.67 | 36.36–38.03 | 100% | jump cut |
| 30 | IMG_6777 | 24.97–26.23 | 38.03–39.15 | 110% | jump cut |
| 31 | IMG_6777 | 26.33–27.33 | 39.15–40.03 | 100% | jump cut |
| 32 | IMG_6778 | 0.27–1.70 | 40.03–41.29 | 110% | jump cut |
| 33 | IMG_6778 | 1.87–3.57 | 41.29–42.79 | 116% | punch-in frase-chave |
| 34 | IMG_6778 | 4.07–6.73 | 42.79–45.14 | 110% | jump cut |
| 35 | IMG_6778 | 6.73–7.60 | 45.14–45.90 | 100% | jump cut |
| 36 | IMG_6778 | 8.07–8.37 | 45.90–46.17 | 110% | jump cut |
| 37 | IMG_6778 | 8.67–10.67 | 46.17–47.93 | 100% | jump cut |
| 38 | IMG_6778 | 10.67–12.53 | 47.93–49.57 | 116% | punch-in frase-chave |
| 39 | IMG_6780 | 0.47–2.07 | 49.57–50.98 | 100% | jump cut |
| 40 | IMG_6780 | 2.20–3.47 | 50.98–52.10 | 110% | jump cut |
| 41 | IMG_6780 | 3.60–4.47 | 52.10–52.86 | 100% | jump cut |
| 42 | IMG_6780 | 5.33–6.60 | 52.86–53.98 | 110% | jump cut |
| 43 | IMG_6780 | 6.97–8.23 | 53.98–55.10 | 100% | jump cut |
| 44 | IMG_6781 | 0.53–2.07 | 55.10–56.45 | 110% | jump cut |
| 45 | IMG_6781 | 2.20–4.80 | 56.45–58.74 | 100% | jump cut |

## 4. Imagem

- Correção leve: contraste +5%, brilho +1,2%, gama 1,03 e saturação +7%. A luz já era boa (dia claro), então o tom de pele ficou natural.
- **Estabilização: não aplicada.** A análise de movimento (vidstab) deu deslocamento mediano de 0 px por frame, ou seja, sem tremor perceptível.
- **Desfoques aplicados:**
  - **30,25–30,80 s:** um carro branco passa colado à janela com a placa dianteira de relance. Desfoquei a região da janela abaixo do rosto.
  - **53,25–53,85 s:** um carro vermelho passa com a placa dianteira visível. Desfoquei a região.
  - Nas duas, a placa já estava borrada pelo movimento e provavelmente ilegível; desfoquei por precaução.
  - Os demais veículos passam longe ou de lado, sem placa legível.
  - Não aparecem documentos, autos, telas de celular, notificações nem nomes.

## 5. Áudio

Cadeia de processamento: canal L (lapela), passa-alta de 80 Hz, afftdn leve (nr=10, nf=−35 dB), de-esser leve, compressão suave (2,5:1) e limitador. Depois, **loudnorm em duas passadas (I = −14, TP = −1, LRA = 11)** e saída estéreo (dual-mono).
O ruído de fundo do carro/ar-condicionado é moderado (SNR ~21 dB). A redução foi leve de propósito, para a voz não ficar metálica, então sobra um leve chiado de ambiente que a música baixa do app deve cobrir.
**Sem música e sem efeitos sonoros.**

## 6. Textos na tela

| Elemento | Especificação aplicada |
|---|---|
| Gancho (0–3 s) | "SUA EMPRESA DEPOSITA / SEU **FGTS**?" em Montserrat ExtraBold, branco com "FGTS" dourado (#C9A227), tarja azul-marinho (#1F2A5A, 85%) com filete dourado, y = 262–494 px. Aparece já no frame 0. |
| Legendas | 63 blocos de 1 linha com 2–4 palavras (exceção: palavras isoladas de fim de frase, como "Sério" e "Como assim?"), sincronizados por palavra. Montserrat ExtraBold, branco, contorno preto de 6 px e sombra leve. Palavras-chave em dourado com "pop" de 100→112→100%, e cada bloco entra com pop de 100→110→100%. |
| Assinatura | "Paulo Renand · OAB/PI 22.759" em Montserrat SemiBold, branco a 85%, canto superior esquerdo (60, 262), de 3 s até o fim. Leva um contorno escuro fino para ficar legível sobre o teto claro do carro. |
| Marca d'água HRS | **Não aplicada:** o arquivo `HRS_marca_dagua_badge_v2.png` não estava na pasta nem no repositório. |
| Barra de progresso | 4 px dourada no topo, preenchendo de 0 a 100%. |

**Desvio da especificação:** as legendas ficaram centradas em **~73% da altura (y = 1405)**, e não nos 62–65% pedidos. Neste enquadramento o queixo/barba fica em ~63–67% da altura (mais baixo ainda nos punch-ins). A 62–65%, a legenda cobriria a boca e a barba. Em 73%, ela fica sobre a camisa, com a base em ~1 460 px, ainda acima da zona inferior de 420 px (limite em 1 500 px). Lateralmente, nem com o pop máximo o texto passa de x = 940 px (zona direita de 140 px livre).

**Palavras-chave destacadas:** FGTS, falta grave, Tribunal Superior do Trabalho (é o "TST" falado por extenso), demitido, 40%, não peça demissão, rescisão indireta e Salva.
"Seguro-desemprego" não é falado no vídeo; veja a seção 9.

**Correções manuais na transcrição:**
- "décimo terceiro" → **13º**
- "Toda justiça do trabalho" → **Toda a Justiça do Trabalho**
- "Salve" (Parakeet) / "Salva" (Whisper) → **Salva**, coerente com o registro informal ("procura", "manda")
- "judicialmente e ainda assim" → **judicialmente e** (o "ainda assim" foi cortado do áudio)

## 7. Transcrição final (o que se ouve no vídeo)

> Pausa tudo e abre seu aplicativo do FGTS agora. Sério. Eu tô aqui agora a caminho do escritório, mas eu preciso te falar uma coisa que quase ninguém sabe. Se a empresa não deposita seu FGTS, se ela deposita com atraso, se ela pula mês, isso é falta grave do empregador. Já está decidido pelo Tribunal Superior do Trabalho. Toda a Justiça do Trabalho segue esse preceito. E nesse caso você pode demitir seu empregador. Como assim? Você pode pedir demissão judicialmente e receber todos os direitos como se você tivesse sido demitido sem justa causa. Multa de 40% do FGTS, aviso prévio indenizado, 13º proporcional, férias proporcionais, férias vencidas. Mas atenção, não peça demissão. Isso só é válido se você recorrer à justiça e aí sim o juiz decidir que a rescisão indireta está valendo. E antes de fazer isso, procura um advogado para te orientar. Salva esse vídeo, manda pra alguém. Agora deixa eu ir que o escritório e os processos não esperam.

## 8. Checklist de compliance OAB (Provimentos 205/2021 e 206/2024)

Varri a transcrição final, todas as legendas, o gancho, a assinatura e a legenda de postagem:

| Item | Resultado |
|---|---|
| Palavra "especialista" | ✅ Não aparece |
| Promessa de resultado ("vai ganhar", "garantido", "com certeza") | ✅ Não aparece. A fala usa "**pode** demitir", "**pode** pedir" e "só é válido se… o juiz decidir", tudo condicional. |
| Valores de honorários | ✅ Não aparece |
| Superlativos ou comparação com colegas | ✅ Não aparece |
| Convite para contratar, telefone ou WhatsApp | ✅ Não aparece. "Procura um advogado pra te orientar" é orientação genérica, sem indicar o próprio escritório nem pedir contato. |
| Dado de cliente ou processo (visível ou audível) | ✅ Não aparece. As placas de veículos foram desfocadas por precaução (seção 4). |
| CTA | ✅ "Salva esse vídeo, manda pra alguém" (equivale ao "salve e compartilhe") |

**Nenhum item bloqueante: versão final exportada.**

## 9. Problemas e pontos para sua decisão (não corrigi nada por cima da fala)

1. **Contexto e fecho diferentes do roteiro.** O roteiro fala em "a caminho de uma **audiência**" e "**audiência** não espera". Na gravação, ele diz "a caminho do **escritório**" e "o escritório e os processos não esperam". Mantive como foi dito.
2. **Seguro-desemprego não foi falado.** O roteiro lista seguro-desemprego entre as consequências, mas a fala não menciona. As verbas citadas são: multa de 40% do FGTS, aviso prévio indenizado, 13º proporcional, férias proporcionais e férias vencidas. Por isso a palavra-chave "seguro-desemprego" não aparece nas legendas.
3. **Imprecisão técnica/possível confusão:** "você pode demitir seu empregador… você pode **pedir demissão judicialmente**". Rescisão indireta não é pedido de demissão, e a frase pode confundir com o alerta logo depois ("não peça demissão"). O alerta resolve a confusão em seguida, e a expressão é coloquial e comum, mas fica registrado. Se quiser mais precisão, dá para regravar só esse trecho.
4. **"Receber todos os direitos"** é afirmativo, mas vem dentro de "você pode…" e depois de "só é válido se o juiz decidir". Não considerei promessa de resultado, mas vale seu olhar.
5. **TST:** o vídeo cita o "Tribunal Superior do Trabalho", mas não o Tema 70 nem a data (24/02/2025). Incluí a referência ao Tema 70 e ao art. 483, "d", da CLT só na legenda de postagem.
6. **Marca d'água ausente:** `HRS_marca_dagua_badge_v2.png` não foi encontrado. Se você enviar o arquivo, aplico no canto superior direito (dentro da zona segura, a 70%).
7. **Ferramenta de transcrição:** o faster-whisper não conseguiu baixar o modelo (o huggingface.co está bloqueado pela rede deste ambiente). Usei o **mesmo Whisper large-v3** (versão ONNX via sherpa-onnx, baixada do GitHub) para o texto, e o **NVIDIA Parakeet TDT 0.6B v3** para os timestamps por palavra. Conferi a sincronia em 6 pontos do vídeo final (gancho, "falta grave", "Tribunal", "Como assim?", "não peça demissão", "esperam"): a legenda entra 0,06–0,12 s antes da fala.
8. **Ruído de fundo:** há um chiado moderado de carro/ar-condicionado. Reduzi de leve para não deixar a voz metálica.

## 10. Arquivos entregues

- `fgts_rescisao_indireta_final.mp4`: versão única para Reels, TikTok e Kwai
- `fgts_rescisao_indireta_capa.jpg`: 1080×1920, frame 0 (olhos abertos, olhar na câmera, gancho legível)
- `fgts_rescisao_indireta_legenda.txt`: texto da postagem
- `fgts_rescisao_indireta_legendas.srt`: legendas em arquivo separado
- `relatorio.md`: este relatório
