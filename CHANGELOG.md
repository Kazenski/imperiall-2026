# CHANGELOG

Todas as mudanças relevantes deste projeto ficam registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

---

## [Não publicado]

### Adicionado
- Módulos de núcleo testáveis: `js/core/combate.js`, `js/core/hex.js`, `js/core/auth.js`
- Suíte de testes unitários do núcleo matemático (`js/core/__tests__/testes-nucleo.mjs`, 66 casos)
- Security Rules versionadas: `firestore.rules`, `storage.rules`, `database.rules.json`
- Build do Tailwind (`package.json`, `tailwind.config.js`, `src/tailwind.css`, `tailwind.css`)
- `CHANGELOG.md` e `README.md`

---

## [2.0.0] — 2026-10-03

Reestruturação do combate, correção de bugs de matemática, fechamento de
falhas de segurança e otimizações de performance. **Mudanças com impacto de
balanceamento — exige revisão antes de jogar.**

### Adicionado
- **Mitigação por DEF.** Agora a defesa do alvo realmente reduz o dano:
  cada ponto absorve 0,5 de dano, limitado a 75% do dano bruto e com piso de
  1 ponto. Antes, DEF era apenas exibido e nunca entrava no cálculo.
- **Teste de esquiva por EVA.** O EVA do alvo passou a ser penalidade no
  teste de acerto (`d20 − EVA ≥ 5`). Curvas resultantes: EVA 0 acerta ~80%
  das vezes, EVA 5 ~55%, EVA 15 ~5%, EVA 20+ nunca.
- **Alcance de habilidade** (`alcanceHabilidade`) finalmente verificado, tanto
  para alvo único quanto para área. Antes não havia verificação nenhuma e dava
  para atacar corpo a corpo do outro lado do mapa.
- **Dano agora é aplicado ao alvo dentro de transação atômica.** Este era o
  bug mais grave do projeto (ver "Corrigido").
- `js/core/hex.js` com a matemática hexagonal completa: distância, conversão
  pixel↔hex, anel, linha, cone, alcance por BFS e linha de visão.
- `getXpBracket()` como fonte única de verdade para nível e barra de XP.

### Corrigido
- **A arena calculava dano mas nunca o aplicava.** `totalDano` ia apenas para
  o log de combate e para o texto flutuante. O HP do alvo nunca era alterado —
  o Mestre precisava aplicar o dano manualmente após cada ataque. Tanto o
  ataque de alvo único quanto a magia em área foram corrigidos.
- **Nível com off-by-one.** A barra de XP da ficha usava busca ascendente e
  exibia sempre um nível a mais do que todos os outros cálculos usavam.
  Ex.: com 150 XP e tabela `1→0, 2→100, 3→300`, a barra dizia "Nvl 3" enquanto
  HP/MP/ATK/DEF/EVA eram calculados no nível 2.
- **`modStat` zerava o HP** quando a ficha do alvo não estava no cache local
  (`newTotal` permanecia `0` e o `updateDoc` gravava `hp = 0`). Bastava o cache
  não estar hidratado para matar o personagem. Agora a operação é cancelada.
- **HP podia ficar negativo.** `calculateStatCascade` não tinha clamp; a barra
  exibia 0% mas o número mostrava valores como `-37`.
- **A Calculadora de Combate mentia.** O dano base da habilidade era resolvido de
  4 maneiras incompatíveis: `calcCombate.js` **somava** o valor de nível ao valor
  raiz, enquanto `arena.js`, `habilidades.js` e `crafting.js` **substituíam**.
  O número previsto nunca era o número rolado. Agora todos usam
  `resolveSkillBaseDamage()`.
- **DEF e EVA eram somados ao dano.** Habilidades de influência "Defesa" ou
  "Evasao" substituíam o ATK e produziam `dano = DEF`. Eram somados ao dano.
- **Penalidade de encumbrance era código morto na arena.** O código usava
  `window.calculateWeightStats`, que nunca existiu (é export de módulo ES, e
  módulos não vazam para `window`). A ficha exibia movimento penalizado e a
  arena usava o valor sem penalidade.
- **O Mestre controlava monstros com o ATK e o MP dele mesmo.** O ATK vinha
  de `selectedCharacterId` (a ficha do Mestre) em vez do token selecionado.
- **Iniciativa era peso morto.** Calculada, salva na ficha, exibida — e nunca
  lida pela arena. A ordem de turno era a ordem de spawn.
- **Ações infinitas por turno.** `turnActions` não era verificado antes de agir
  (só era marcado depois) e não persistia; recarregar a página devolvia o turno.
- **Alvos fora da grade.** O Mestre podia escrever coordenadas `q`/`r`
  arbitrárias, tirando o token do canvas ou gerando `NaN` nos atributos SVG.
- Muros "soft" (transparentes) bloqueavam movimento igual aos sólidos.
- Tokens podiam ocupar a mesma casa.
- `getFomeDebuffMultiplier` produzia `NaN` com `fomeAtual` não numérico, e o
  `NaN` chegava ao log como literalmente `"HIT! NaN"`.
- **Chat da sessão vulnerável a XSS.** A mensagem ia crua para `innerHTML`;
  `<img src=x onerror=...>` executava no navegador de todos da mesa,
  inclusive do Mestre (mesma origem do Firebase).
- **Nome do personagem vulnerável a XSS** no seletor de fichas e no histórico
  de objetivos.
- `escapeHTML()` dentro de `onclick="..."` não protegia nada: o parser HTML
  decodifica o atributo antes de o JS ser avaliado, devolvendo a aspa e
  reabrindo o breakout. Substituído por `data-*` + listener delegated.
- **Aba do Admin acessível a qualquer usuário logado.** `showTab()` não tinha
  verificação nenhuma; o único portão era esconder o botão da barra lateral.
  Bastava digitar `showTab('backoffice-content')` no console.
- **Escalada de privilégio.** `updateDoc(rpg_users/{uid}, {role:'admin'})`
  desbloqueava todos os painéis administrativos.
- **Preço de compra controlado pelo cliente.** `executeBuy(itemId, preco, nome)`
  recebia o preço como argumento — `window.executeBuy('id', 0, 'x')` dava item
  grátis. Sem argumento o preço virava `NaN` e, como `NaN > 0` é falso, as três
  chaves de moeda eram apagadas: a carteira era zerada e o item entregue.
- **Preço de venda lido do cache do cliente**, um objeto JS mutável pelo
  usuário. O único limite era o caixa da loja — dinheiro infinito.
- **Duplicatas de `id` no HTML:** `drops-monstros-content`,
  `cadastro-sets-especiais-content` e `mapa-mundial-content` (comentado).
  `getElementById` e o mapa `dom` de `main.js` retornavam elementos diferentes.
- **`setInterval` morto de 1 Hz** em `index.html` (55 linhas). Não fazia nada:
  `globalState` nunca é atribuído a `window` (0 ocorrências no projeto), e o
  código escrevia em 4 IDs inexistentes no HTML.
- `renderArenaSkills` escrevia `isFavorite: true` direto no cache compartilhado,
  que outros módulos gravam no banco com `updateDoc`.

### Segurança
- `firestore.rules`, `storage.rules` e `database.rules.json` criados e
  versionados. Anteriormente **não havia regras no repositório** — as regras
  em uso eram desconhecidas e não versionáveis.
- Trava contra auto-promoção: o usuário pode escrever no próprio documento de
  `rpg_users`, mas **não** no campo `role`.
- Regra de catch-all: qualquer coleção não listada explicitamente fica
  somente-leitura para autenticados e fechada para escrita.
- `js/core/auth.js` com portão de autorização para abas, ranking de papéis e
  `guardAdminTools()`, que envolve `window.boTools`, `window.buTools`,
  `window.shopTools`, `window.firebaseTools` e `window.userAdminTools` —
  antes chamáveis direto do console por qualquer pessoa logada.
- Log de auditoria das tentativas de acesso e operação.

### Performance
- **Preview de área de efeito:** de 1600 iterações + até 1600 `<polygon>`
  por evento `mousemove` (≈96 mil/s) para a caminhada em espiral de
  `hexesInRadius()` — raio 5 passa de 1600 para 91 células. Também passou a
  usar `requestAnimationFrame` e evita redesenhar quando o cursor não mudou de
  casa.
- **Auras:** mesma otimização, aplicada a cada `onSnapshot`.
- **Tailwind via CDN removido.** O Play CDN baixava o compilador JIT (~380 KB
  de JS) e gerava o CSS no navegador, com `MutationObserver` reagindo a cada
  troca de aba — ou seja, trabalho no main thread proporcional ao tamanho da
  subárvore inserida, mais FOUC. Agora é um CSS estático de 106 KB,
  minificado, cacheável e versionado.
- **Grid da arena:** 3200 closures (`onclick` + `onmouseenter` por célula)
  substituídas por 2 listeners delegated.
- **`updateObstacles`** parou de reescrever a classe de 1600 hexágonos a cada
  snapshot; agora só toca no que mudou, com cache incremental.
- **Vazamento de listeners corrigido na Teia de Conexões:** 2 novos
  `onSnapshot` a cada visita à aba, sem unsubscribe. 10 visitas = 20 escutas
  ativas, e cada edição de NPC destruía e recriava 10 vezes o `vis.Network`.
- **Vazamento de listeners corrigido no cabeçalho de mundo:** 4 `onSnapshot`
  por login, nunca cancelados no logout.
- **Vazamento de listeners corrigido na mochila:** handlers delegated em
  `#mochila-content` (elemento permanente) religados a cada mudança de sessão.
- **`renderHubMessages`** passou a montar `DocumentFragment` com `textContent`
  em vez de concatenar string e reatribuir `innerHTML`, e só rola até o fim
  se o usuário já estava perto do fim.
- `renderCombatLog` e a barra lateral de HP/MP passaram a usar `textContent`.
- **Arraste do mapa da arena não morria mais ao trocar de sessão.**
  `renderLayout()` recria o `<svg>` a cada `init()`, mas o flag
  `eventsAttached` nunca era resetado — a partir da segunda sessão o canvas
  ficava sem handler nenhum.
- Removida a biblioteca `lucide`: não havia um único uso no projeto (~50 KB).

### Layout e CSS
- **A barra de sub-abas não rolava.** `#sub-menu-bar` usava
  `overflow: hidden` (regra de ID, especificidade 1,0,0, que vencia o
  `overflow-y-auto` do Tailwind). O menu do Painel Admin tem 17 itens
  (≈840 px) numa caixa com a altura da viewport: os últimos ficavam
  **inalcançáveis**, e como o rótulo só aparecia no `:hover`, em toque não
  havia como saber o que existia ali. Agora rola na vertical e os rótulos
  aparecem sempre.
- **`#content-container` anulava o layout.** O `padding: 1.5rem` da regra de ID
  vencia o `p-0` que `showTab()` aplica nas telas de mapa e início — a troca
  de classes não tinha efeito. Padding agora é só por classe utilitária.
- **`.tab-content.active` matava o flex.** Com `display: block` (0,2,0) acima
  de `flex` (0,1,0), as ~25 abas marcadas `flex flex-col` renderizavam como
  block e o layout interno quebrava em Início, Arena, Comércio e Mapa.
- `animate-fade-in` foi implemented — a animação existia só como `.fade-in`,
  então as ~45 chamadas nos módulos JS nunca animavam.
- `--dourado-imperiall` não existia: a barra de rolagem customizada caía para
  a cor padrão do navegador.
- Regras duplicadas e conflitantes removidas (dois `::-webkit-scrollbar`
  globais com valores diferentes; `h1..h6` declarado duas vezes).

### Ferramentas
- `npm run build:css` — compila o Tailwind
- `npm run watch:css` — recompila em modo watch
- `npm test` — roda os 66 testes do núcleo
- `npm run build` — CSS + testes

---

## [1.x] — antes desta reorganização

O projeto navegava a partir de `js/main.js` e funcionava, mas com o histórico
acumulado de bugs listados acima. Sem `firestore.rules`, sem testes, sem
documentação de regras de combate e com o Tailwind compilado no navegador.