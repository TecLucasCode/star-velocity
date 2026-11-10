# UMA MUSUME: STAR VELOCITY — corrida multiplayer pixel art (PT-BR)

Jogo de corrida 2D lateral em pixel art HD inspirado em Uma Musume, com identidade própria:
lobby social 360°, 28 corredoras, dash + super cinematográfico, loja, missões, pódio,
ranks e corridas com bots.

## Jogar local / publicar no GitHub Pages

Só abrir `index.html` **via servidor local** (módulos ES exigem http):

```bash
npx serve .
# ou: python3 -m http.server 8000
```

Para publicar: suba este repo no GitHub e ative **Settings → Pages → Deploy from branch**
(branch `main`, pasta `/`). O jogo abre no link do Pages.

## Notas

- Fora do Perchance, o multiplayer online (salas) fica indisponível: o jogo roda
  completo em modo offline com bots + save em `localStorage`.
- Vozes das corredoras usam a fala nativa do aparelho (Web Speech API, PT-BR).
- Original criado no Perchance (lógica 100% em `src/*.js`, sem dependências do motor).
