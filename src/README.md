# UMA MUSUME: STAR VELOCITY — README (V1.0)

Jogo de corrida multiplayer (pixel art HD, horizontal 16:9) inspirado em Uma Musume,
com identidade própria. **V1.0 = só corrida multiplayer** (sem mundo aberto — v2.0).

## Arquitetura
- `main.pjs`: $meta + imports (`createServerSocket`, `kv`).
- `index.html`: shell + `<script type="text/x-server-plugin">` (relay autoritativo) + telas.
- `src/characters.js`: 28 personagens + skills + paletas + falas; PERSONA
  (cute/wild/cool/noble — expressão e trejeitos) + SUPER_FX (7 estilos de
  cinemática: rainbow/streak/dance/chaos/shadow/royal/bloom); 5 circuitos (4 liberados).
- `src/pixel.js`: sprites no modelo CHIBI da ref do usuário (~2.5 cabeças, cabeça
  REDONDA em bandas, olhões com 2 brilhos, orelhas grandes, vestidinho com
  babado, perninhas curtas); rosto sempre em 3/4 (os DOIS OLHOS até de lado),
  postura curvada de sprint, expressões por personalidade
  (fofa/selvagem/fria/elegante), 360° frente/costas/perfis, poses idle/run/dash/
  win/lose/super/present, orelhas/cauda/cabelo animados.
- `src/audio.js`: SFX + música procedurais (WebAudio — a musiquinha do jogo).
- `src/net.js`: salas por código, presença, relay 10Hz, bots como fallback.
- `src/game.js`: lobby, **corrida lateral 2D com câmera cinematográfica**, loja, missões,
  pódio, classificação, settings (qualidade/câmera/efeitos).

## Câmera (só visual — nunca toca física/resultados)
Follow suave com lookahead, zoom em ultrapassagem (mostra as 2 + banner ⇄),
zoom+shake no dash, vinheta na reta final, banner de chegada, cinemática de super
sincronizada por evento. Opções: Câmera Reduzida (sem zoom/shake) e Efeitos Baixo.

## Circuitos (4 de 5)
Hipódromo Tradicional, Academia Tracen, Pista Noturna Neon, Praia Starlight.
Floresta Sagrada: 🔒 "Em breve (v2.0)".

## Controles (sem joystick)
- Esquerda: botão CORRER (segurar = sprint, gasta fôlego). Direção automática
  (segue a raia, desvia de rivais; setas/WASD afinam no PC).
- Direita: DASH (cooldown) + SUPER (quando cheio, brilha/pulsa).
- HUD: posição, volta, tempo, velocidade, barras super/fôlego, buff ativo, progresso.
- Buffs arcade por skill (⚡🛡💚...): ativam sozinhos, com ícone sobre a corredora + HUD.

## Servidor
Relay por sala (`sv-room-<CÓDIGO>`), rate-limit 25 msg/s, validação, sem PII em `state`.
Layout `state` v1: bytes `S V 0 1` + contadores.

## Arquitetura
- `main.pjs`: $meta + imports (`createServerSocket`, `kv`). Listas pjs mínimas.
- `index.html`: shell + `<script type="text/x-server-plugin">` (servidor autoritativo/relay)
  + telas (lobby, personagens, loja, missões, eventos, amigos, config, corrida) + boot module.
- `src/characters.js`: catálogo 28 + raridades + skills + paletas + falas de super.
- `src/pixel.js`: renderer procedural HD pixel art (sem blur). Personagens altas,
  grade interna ~64x112, upscale com `image-rendering:pixelated`. Suporta ângulo 360°
  (drag) e poses: idle/run/dash/win/lose/present/super/emote.
- `src/audio.js`: SFX + música procedurais via WebAudio (sem assets).
- `src/net.js`: multiplayer via server-plugin (room code, presence, relay 10Hz,
  sequência de inputs, bots como fallback). Funciona offline com bots.
- `src/game.js`: estado, lobby, corrida (física oval, dash, super, minimapa, 8 runners),
  loja, missões, eventos, amigos, settings, customização de controles.

## Controles
- Esquerda: joystick (lateral + ritmo) + botão CORRER (sprint, gasta estamina).
- Direita: DASH (cooldown) + SUPER (quando cheio, brilha/pulsa).
- HUD: barra super, estamina, velocidade, posição, volta, tempo, minimapa.

## Servidor (resumo)
- Topics `sv-room-<CODE>`: relay de presença + inputs com índice sequencial.
- Rate-limit por conexão (~20 msg/s), validação de tipos/tamanhos, sem dados duráveis
  sensíveis em `state` (salas são efêmeras; progressão fica no kv local).
- `state` layout v1: bytes 0..3 = magic `SV01`, resto reservado para contadores AB.
  Sem migração destrutiva.

## Progressão local (kv `sv-save`)
- moedas, premium, rank, nível, chars desbloqueadas, skin/cenário/moldura ativos,
  missões, vitórias/corridas, settings, controles.

## Lobby V1.1 (refinamento visual)
- Personagem 360° com inércia (arrastar gira, soltar mantém giro que desacelera),
  giro automático lento após 5s parada, transição deslizante ao trocar de personagem.
- Cenário vivo por bioma: nuvens puff em 2 camadas, pássaros, arquibancada com telhado
  listrado + mastros com bandeiras + público que pula (1/6 agita bandeirinha), varal de
  bandeirinhas em catenária, cerca, speckles na terra, tufos de grama, pétalas/poeira.
- Interface: JOGAR com glow + brilho varrendo, placa da personagem sobre o palco,
  galeria rápida (28 miniaturas, rola até a selecionada), cartão da corredora no painel
  (barras de atributos, skill/super, slots de roupa/acessório "em breve"), telas com
  animação de entrada, modal pop, toast deslizante.
- Galeria de personagens: 28 cards com estrelas de raridade, barras, Nv, skill;
  toque seleciona com transição no lobby (cadeado + preço se bloqueada).
- Dica: captura de tela cheia trava o preview (muitos canvases) — verificar por partes.

## Sprites CHIBI (estilo refs do usuário)
- V1.6 (atual — refs @npc.ffbeta do usuário): chibi ~2.5 cabeças, OLHÕES altos com
  delineado grosso + wing, íris em degradê (topo escuro → brilho inferior) + BRILHO
  GRANDE + pupila larga, blush em mancha oval, sorrisão com língua (happy),
  queixo fino, juba volumosa ARREDONDADA com 2 mechas de brilho, franja 5 bicos
  cheios, costeletas compridas, madeixas frontais p/ long, orelhas GRANDES com ponta
  + inclinação p/ fora, roupa idol (vivos/gola dourados, joia no peito, cinto c/ fivela,
  saia 6 painéis + barra dourada + babado, manga bufante + punho dourado),
  PERNAS GROSSAS (coxa à mostra + meia alta c/ listra + botona c/ laço — nada de
  perna fina), rabo grosso, costas só cabelo c/ risco sutil.
- V1.7: acessórios fiéis p/ os 28 ids (coroas c/ gema, tiara, laço c/ caudas, faixa,
  viseira, aviador, ear-cuff, pulseiras, pérolas, pins estrela/nuvem/diamante,
  flores, barbatana turbo, charms âncora/sol/máscara/chuva/seringa/olho, presinha,
  gargantilha, ombreiras, capa do imperador, corrente de ouro); meia com listra
  dupla; corrida com poeira nos pés + 💧 de fôlego baixo; lobby com reflexo no
  chão + balão de emoji nos emotes (6: 🙌💪✨🌟😢💤); pódio ANIMADO (1º pulando
  + 🎉, 2º ✨, 3º 💧) + confete na vitória + botões 🎉 Comemorar / 😭 Poxa.
- V1.7b (fix pódio): delineado proporcional ao olho (12% da altura — antes engolia
  a íris no pequeno), topo escuro 35%→28% + brilho inferior maior, olho feliz/
  piscadinha/blink com traço grosso (lê em 90×200), franja um pouco mais curta.
- V1.7c (fofura final): cabeção 0.455h, bochecha redonda, olhões 0.32, BRILHÃO 34%,
  blush maior + gloss branco na bochecha.
- V1.8 (contas online): usuário (3-14 letras/números) + senha (4-72), hash SHA-256
  com salt no servidor, SEM e-mail/recuperação (aviso no modal). RPC
  register/login/save; state "SVA2" + slots 96B cap 20000; rate-limit 6/hora por
  rede e 15/min por conexão. Perfil: moedas/premium/xp/level/rank/wins/races +
  mask opaca (desbloqueados) + sel opaco (ativa). Modal 👤 na topbar, auto-login,
  push a cada save (5s), nome da conta no multiplayer. Convidado funciona sem conta.
  ⚠️ vale em PRODUÇÃO só após SALVAR o generator.
- Consistência 360°: frente/perfil (rosto sempre 3/4 — 2 olhos) / costas (cabelo).
- Poses: idle (squash+ginga), run (waddle + tesoura), dash, win/super (braços p/ cima +
  olho feliz ^ ^ + sorrisão), lose (orelhas caídas), present (braços abertos).
- Mesma assinatura — lobby, galeria, loja, corrida, pódio e cinemática herdaram o estilo.
- V1.5: estilo SIMPLES da ref Opera O: chibi ~2.5 cabeças, formas limpas, olhinho escuro
  em pílula com brilho, bochecha rosa, boquinha + dentinho, MÃOS NA CINTURA no idle,
  touca de cabelo curta com 3 bicos, franja simples, sapatos redondos. Costas: só cabelo.
- V1.4: padrão das refs (Facebook/Threads, substituído): chibi alta ~3 cabeças, franja em zigue-zague
  profundo, MECHA BRANCA central (assinatura SW/Opera O), olhos maiores com brilho
  rosado inferior, dentinho no sorriso, costeletas em zigue-zague, manguinhas bufantes.
- V1.3: estilo ANIME ESGUIO (substituído) (ref Gold Ship do usuário, ~6 cabeças): pernas longas com
  coxa/meia alta/faixa/sapato, uniforme com vivos dourados + botões + gola + laço +
  cinto com fivela + saia pregueada + emblema, braços com cotovelo + braçadeira Tracen +
  luvas brancas nas poses de festa, punho erguido no idle, cabelo longo afunilado com
  volume, costeletas até o peito, ahoge por personagem, olhos anime altos com gradiente.
- V1.2 (chibi, substituído): (pernas +30%, tronco maior), pixel mais fino (grade h/150,
  P mín 1) e beleza: laço no peito, canelado nas meias, cadarço, gradiente na íris,
  delineado inferior, sombra da franja, braços levemente mais longos.

## Como testar
1. Abrir preview (horizontal, ideal 1280x720).
2. Lobby: arrastar na personagem = 360°. Testar emotes.
3. Personagens: trocar, ver skills. Loja: comprar com moedas. Missões: progresso.
4. Jogar: Rápida (bots) ou Criar sala / Entrar (multiplayer). Correr 2 voltas.
5. Super: encher barra (correr + ultrapassar), apertar SUPER, ver cinemática.
6. Amigos: copiar código da sala, abrir 2ª aba e entrar com mesmo código.

## Notas de performance
- Canvas low-res com `imageSmoothingEnabled=false`, partículas limitadas por qualidade
  (config: Alto/Médio/Baixo). Alvo: 60fps em intermediários.
- Sem assets externos: tudo procedural (sprites + áudio). Boot < 1s.
