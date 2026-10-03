# Imperiall 2026 — Painel VTT

Painel de mestre virtual (VTT) e gerenciador de mundo para o RPG **Imperiall**.
Site estático em JavaScript puro (ES Modules), sem framework, sem build
obrigatório, com Firebase (Firestore + Auth + Storage + Realtime Database).

---

## Índice

- [Início rápido](#início-rápido)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de combate](#modelo-de-combate)
- [Economia e moedas](#economia-e-moedas)
- [Segurança](#segurança) ← **leia antes de publicar**
- [Scripts de desenvolvimento](#scripts-de-desenvolvimento)
- [Convenções de código](#convenções-de-código)
- [Onde mexer](#onde-mexer)

---

## Início rápido

O site é estático: qualquer servidor HTTP serve. Para testar localmente:

```bash
# Python (já vem com o Windows)
python -m http.server 8080

# ou Node
npx serve .
```

Depois abra `http://localhost:8080`.

> **Importante:** abra por HTTP, não por `file://`. O projeto usa ES Modules,
> que o navegador bloqueia no protocolo `file://` por política de CORS.

### Primeiro setup do Tailwind

O CSS do Tailwind é **gerado no build** e versionado no repositório. Se você
mexer em classes do Tailwind, regenere:

```bash
npm install
npm run build:css
```

---

## Estrutura do projeto

```
imperiall-2026/
├── index.html              # Estrutura da aplicação (aba por aba)
├── style.css               # Estilos do projeto
├── tailwind.css            # CSS do Tailwind GERADO (não editar à mão)
├── tailwind.config.js      # Configuração do build do Tailwind
├── package.json            # Scripts e dependências de dev
│
├── firestore.rules         # 🔒 Segurança do Firestore
├── storage.rules           # 🔒 Segurança do Storage
├── database.rules.json     # 🔒 Segurança do Realtime Database
│
├── js/
│   ├── main.js             # Cérebro: login, cache, navegação entre abas
│   │
│   ├── core/               # ── NÚCLEO (sem DOM, testável) ──
│   │   ├── auth.js         #    Controle de acesso e auditoria
│   │   ├── calculos.js     #    Atributos, HP/MP, reputação, moedas
│   │   ├── combate.js      #    Resolução de dano (esquiva, mitigação)
│   │   ├── hex.js          #    Matemática hexagonal do grid
│   │   ├── firebase.js     #    Instâncias do Firebase
│   │   ├── state.js        #    Estado global e constantes
│   │   └── utils.js        #    escapeHTML, compressão de imagem
│   │
│   ├── tabs/               # Abas da ficha do personagem
│   │   ├── painelFichas.js #    Editor da ficha
│   │   ├── arena.js        #    Arena de combate hexagonal
│   │   ├── comercio.js     #    Compra, venda e câmbio
│   │   ├── mochila.js      #    Inventário
│   │   └── ...             #    (mais 12 abas)
│   │
│   ├── admin/              # Painéis administrativos
│   ├── aoMestre/           # Ferramentas do Mestre
│   ├── oMundo/             # Compendium público do mundo
│   ├── manualRegras/       # Raças, classes, habilidades, profissões
│   ├── aoJogador/          # Simulador de ficha
│   ├── inicio/             # Página de abertura
│   └── atualizacoes/       # Novidades
│
├── imagens/                # Mapas, favicon, background
├── audios/                 # Trilhas do mundo
└── CHANGELOG.md            # Histórico de mudanças
```

### O núcleo é separado de propósito

`js/core/` não toca no DOM nem no Firebase (com exceção de ler o cache em
`globalState`). Isso permite rodar a matemática de combate, os atributos e a
geometria hexagonal em Node, sem navegador — é o que os testes fazem.

Módulos de aba (`js/tabs/`) cuidam da apresentação e das chamadas de rede.

---

## Modelo de combate

Toda a resolução de combate está em **`js/core/combate.js`**. As regras ficam
num único objeto ajustável:

```js
export const COMBAT_RULES = {
    HIT_THRESHOLD: 5,        // mínimo no teste de acerto
    DEF_ABSORB: 0.5,         // dano absorvido por ponto de DEF
    MAX_MITIGATION_PCT: 0.75,// DEF nunca absorve mais que isso
    MIN_DAMAGE: 1,           // piso de dano após mitigação
    ENABLE_HIT_ROLL: true
};
```

### Fluxo de um ataque

```
1. Esquiva    hitRoll = d20 − EVA_do_alvo
              se hitRoll < HIT_THRESHOLD → ERROU (dano zero)

2. Potência   bruta = d20 + danoBase(habilidade, nível) + ATK × fomeMult

3. Mitigação  absorvido = min(DEF_do_alvo × DEF_ABSORB,
                              bruta × MAX_MITIGATION_PCT)
              dano = max(MIN_DAMAGE, bruta − absorvido)
```

### Consequências práticas

| EVA do alvo | Taxa de acerto |
|---|---|
| 0 | ~80% |
| 5 | ~55% |
| 15 | ~5% |
| 20+ | nunca |

| DEF do alvo | Redução |
|---|---|
| 10 | 5 de dano |
| 40 | 20 de dano (atinge o teto de 75% do bruto) |

O **teto de mitigação** existe para que um DEF muito alto produza "muito
dano", e nunca "zero dano eterno".

### O que ainda NÃO existe

- **Cooldown** — não há recarga de habilidade no combate.
- **Crítico** — não há multiplicador de crítico.
- **Ação de reação** — `tipoAcaoHabildiade` é exibido mas não tem efeito.
- **Pontos de ação (AP) em combate** — AP é usado só para aprender habilidades.
- **Iniciativa** — calculada e salva, mas a ordem de turno segue a ordem de
  spawn dos tokens.

Esses campos já existem nos documentos e são pontos de extensão naturais.

### Escala de posição

O grid usa coordenadas **axiais** (`q`, `r`) com layout *pointy-top*.
Distância usa a fórmula de cubo: `(|dq| + |dq+dr| + |dr|) / 2`.

Funções disponíveis em `js/core/hex.js`:

```js
hexDistance(q1, r1, q2, r2)          // distância entre células
hexToPixel(q, r) / pixelToHex(x, y)   // conversão
hexesInRadius(q, r, radius)           // espiral — use em vez de varrer o grid
hexRing(q, r, radius)                 // anel, sem o centro
hexLine(q1, r1, q2, r2)               // linha reta
hexCone(q, r, dirIndex, range)        // cone direcional
getReachableHexes(q, r, range, blocked) // BFS com bloqueios e limites
hasLineOfSight(q1, r1, q2, r2, blocked)
```

> **Desempenho:** sempre use `hexesInRadius()` para áreas e auras. O grid tem
> 1600 células; varrê-lo inteiro em um `mousemove` custava ~96 mil iterações
> por segundo.

---

## Economia e moedas

Cobre é a unidade canônica. As moedas vivem **dentro do inventário**
(`ficha.mochila[coinId]`), não em um campo separado.

| Moeda | Valor em cobre |
|---|---|
| Cobre | 1 |
| Prata | 10 |
| Ouro | 100 |

Ids e taxas ficam em `COINS`, no topo de `js/core/state.js`. **Nunca escreva
`100` ou `10` à mão** — use `COINS.GOLD.val`.

### Compra, venda e câmbio

- **Compra:** o preço é lido do documento da loja **dentro da transação**, não
  vem do cliente. O preço exibido na tela é informativo.
- **Venda:** o preço deriva do `precoCompra` que a loja tem gravado, com
  `SELL_RATE` (50%). Isso impede o ciclo lucrativo comprar → vender na mesma
  loja.
- **Câmbio:** 1 ouro → 10 prata → 10 cobre. Na direção "fundir", a entrada é
  arredondada para múltiplo da taxa, então não há perda nem arbitragem.

---

## Segurança

### O ponto principal

**Validação no navegador não é segurança.** Todo o código em `js/` roda na
máquina do usuário e pode ser lido e contornado pelo console. A autoridade
está nos arquivos de regras:

```
firestore.rules        ← segurança do Firestore
storage.rules          ← segurança do Storage
database.rules.json    ← segurança do Realtime Database
```

### Publicar as regras

```bash
npm install -g firebase-tools
firebase login
firebase use --add                 # selecione o projeto kazenski-a1bb2

# Teste primeiro no emulador
firebase emulators:start

# Depois aplique
firebase deploy --only firestore:rules,storage,database
```

### O que as regras protegem

| Cenário | Proteção |
|---|---|
| Usuário se promove a admin | `role` não está entre os campos graváveis pelo próprio usuário |
| Usuário edita a própria carteira | `mochila` exige privilégio de mestre |
| Usuário abre painel de admin | `showTab()` tem portão; `guarAdminTools()` bloqueia `window.boTools` e afins |
| Injeção em coleção nova | regra catch-all: escrita fechada até ser listada explicitamente |
| Upload de arquivo grande ou não-imagem | limite de tamanho e tipo no `storage.rules` |

### Ao criar uma coleção nova

Adicione um `match` explícito em `firestore.rules` **antes** de usar a
coleção. A regra catch-all final é propositalmente fechada para escrita —
é ela que impede que uma coleção esquecida fique aberta.

### Cache local (limitações conhecidas)

`js/main.js` ainda carrega documentos inteiros com `getDocs` sem filtro para
construir o cache do cliente, e filtra o resultado com `if` em JavaScript.
Isso é insuficiente como controle de privacidade: a leitura já aconteceu.

**Migração recomendada:** trocar por `where('jogadorUid', '==', uid)` para o
cache próprio, e um documento público enxuto para a lista de personagens
visível. O cache atual depende de ler tudo, então as regras não podem ser
apertadas sem antes reorganizar `loadCache()`.

### Painel administrativo

A camada de UI (`js/core/auth.js`) segue o mesmo princípio: é ergonomia, não
barreira. Ela existe para que o comportamento esperado apareça normalmente e
para que uma tentativa fora do fluxo normal deixe registro no log de
auditoria — não para impedir alguém com acesso ao console.

---

## Scripts de desenvolvimento

```bash
npm install            # instala o Tailwind

npm run build:css      # compila o Tailwind → tailwind.css
npm run watch:css      # recompila ao salvar (use durante o desenvolvimento)
npm test               # 66 testes do núcleo matemático
npm run build          # CSS + testes
```

### Cobertura dos testes

Os testes cobrem as partes onde um erro silencioso é caro:

- **XP e nível** — tabela de níveis, XP na borda, tabela degenerada
- **HP/MP** — ordem de consumo (escudo → extra → base), clamp de zero
- **Moedas** — conversão sem perda, entrada inválida
- **Hexagonal** — distância, round-trip pixel↔hex, invariantes de espiral
- **Combate** — mitigação, teto de DEF, monotonicidade da esquiva, fome

```bash
npm test
# 66 passaram, 0 falharam
```

Para adicionar um caso, edite `js/core/__tests__/testes-nucleo.mjs`.

---

## Convenções de código

### Imports

```js
import { globalState } from '../core/state.js';           // sem extensão .js
import { rollAttack } from '../core/combate.js';
```

### Nomenclatura

- `js/core/` — funções puras, sem DOM, sem rede
- `js/tabs/`, `js/admin/` etc. — apresentação e chamadas de rede
- Funções de janela: prefixe `window.` explicitamente (`window.showTab`)
- Helpers locais: abaixo do objeto principal, antes de `window.arena = {`

### Escapamento de texto

**Nunca** interpole dado de usuário direto em `innerHTML`:

```js
// ❌ Vulnerável
el.innerHTML = `<h1>${userInput}</h1>`;

// ✅ Use escapeHTML
el.innerHTML = `<h1>${escapeHTML(userInput)}</h1>`;

// ✅ Ou, melhor, use textContent (elimina a necessidade de pensar nisso)
el.querySelector('h1').textContent = userInput;
```

**Nunca** interpole dado dentro de `onclick="..."`:

```js
// ❌ Não protege, mesmo com escapeHTML: o parser HTML decodifica o
//    atributo antes de o JS ser avaliado e reabre o breakout.
<button onclick="edit('${escapeHTML(nome)}')">

// ✅ Delegue e passe o valor por data-*
<button data-edit-id="${id}">
// + listener delegated com e.target.closest('[data-edit-id]')
```

### Ao alterar o Tailwind

Classes novas em HTML ou em template strings do JS exigem regenerar o CSS:

```bash
npm run build:css
```

E **commit o `tailwind.css` junto** — o site não tem build no deploy.

### Escala de texto

O projeto usa `html { font-size: 12px }`, então **todas** as utilities de
escala do Tailwind em `rem` valem menos do que o normal (`text-base` = 12px,
não 16px). O código existente usa tamanhos explícitos (`text-[10px]`) por
isso. Continue o padrão.

---

## Onde mexer

| Quero mudar... | Vá para |
|---|---|
| Regras de combate, dano, esquiva | `js/core/combate.js` → `COMBAT_RULES` |
| Fórmulas de atributo, HP/MP, reputação | `js/core/calculos.js` |
| Grid hexagonal, área, alcance | `js/core/hex.js` |
| Quem pode ver/fazer o quê | `firestore.rules` |
| Navegação entre abas | `js/main.js` → `window.showTab` |
| Lista de abas do menu | `js/main.js` → `MASTER_ARCHITECTURE` e `FICHA_TABS` |
| Aparência | `style.css` (e regenere `tailwind.css`) |
| Estrutura de uma aba | o `div` correspondente em `index.html` |

---

## Registro de mudanças

Ver [CHANGELOG.md](CHANGELOG.md). Toda alteração relevante deve acrescentar uma
entrada.

---

## Licença

Projeto privado. Todos os direitos reservados.