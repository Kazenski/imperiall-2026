// ARQUIVO: js/core/combate.js
// Motor de resolução de combate — fonte ÚNICA da verdade.
//
// Antes desta refatoração a mesma fórmula estava duplicada byte-a-byte em
// arena.js (ataque), arena.js (área) e habilidades.js, e o resultado era
// SEMPRE apenas registrado no log — nunca aplicado no HP do alvo.
//
// Modelo de dano:
//   1. Teste de ACERTO ....... d20 + EVA do alvo  >=  HIT_THRESHOLD ?
//   2. Potência bruta ........ d20 + danoBase da habilidade + ATK (com fome)
//   3. Mitigação por DEF ..... DEF * DEF_ABSORB, limitada a MAX_MITIGATION_PCT
//   4. Dano final ............ clamp em MIN_DAMAGE
//
// Este módulo é puro (sem DOM, sem Firestore). A aplicação do dano no token
// acontece em arena.js, dentro de uma transação.

import { globalState } from './state.js';
import { calculateWeightStats } from './calculos.js';
import { hexDistance } from './hex.js';

// ============================================================================
// REGRAS DE COMBATE — ajuste aqui, não em vários lugares
// ============================================================================
export const COMBAT_RULES = Object.freeze({
    // Mínimo no teste de acerto para o golpe conectar. Com EVA 0 => erra 1..(THRESHOLD-1)
    HIT_THRESHOLD: 5,

    // Quanto de dano cada ponto de DEF absorve (ratio)
    DEF_ABSORB: 0.5,

    // Teto de mitigação: DEF nunca absorve mais que esta fração do dano bruto.
    // Garante que um DEF gigante vira "muito dano", nunca "0 dano eterno".
    MAX_MITIGATION_PCT: 0.75,

    // Dano mínimo garantido após mitigação
    MIN_DAMAGE: 1,

    // Multiplicador de ação livre não dá escudo: apenas ignora a trava de turno
    ENABLE_HIT_ROLL: true
});

// ============================================================================
// HELPERS
// ============================================================================

/** Converte para número finito, com fallback. Mata os bugs de NaN do sistema. */
function safeNum(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Lê um atributo com fallback entre os dois esquemas de nomes que existem no banco.
 *
 * Jogadores  → atkPersonagemBase / defPersonagemBase / evaPersonagemBase
 * Monstros   → atk_base / def_base / eva_base
 *
 * (São dois históricos de modelagem diferentes convivendo. Isto normaliza.)
 */
export function getStat(source, kind) {
    if (!source) return 0;
    const suffix = kind === 'atk' ? 'atk' : kind === 'def' ? 'def' : 'eva';
    return safeNum(
        source[`${suffix}PersonagemBase`] ??
        source[`${suffix}_base`] ??
        source[`bonus${kind === 'atk' ? 'Ataque' : kind === 'def' ? 'Defesa' : 'Evasao'}Total`] ??
        0
    );
}

/**
 * Dano base de uma habilidade no nível informado.
 *
 * ANTES havia 4 implementações incompatíveis:
 *   calcCombate.js  → SOMAva  nivelBase + efeitoDanoBaseUsoHabilidade
 *   arena.js        → SUBSTITUIA pelo nivelBase
 *   habilidades.js  → SUBSTITUIA
 *   crafting.js     → SUBSTITUIA
 * A Calculadora de Combate previa um número, a arena rolava outro.
 *
 * REGRA ÚNICA agora: o nível SUBSTITUI o valor base quando existe,
 * caso contrário usa o valor raiz da habilidade.
 */
export function resolveSkillBaseDamage(masterSkill, level = 1) {
    if (!masterSkill) return 0;
    const root = safeNum(masterSkill.efeitoDanoBaseUsoHabilidade);
    const lv = Math.max(1, Math.floor(safeNum(level, 1)));

    const perLevel = masterSkill.niveis && masterSkill.niveis[lv]
        ? masterNum(masterSkill.niveis[lv], 'danoBaseHabilidade')
        : null;

    return perLevel !== null ? perLevel : root;
}

// pequeno alias interno para manter a linha acima legível
function masterNum(obj, key) {
    const v = Number(obj[key]);
    return Number.isFinite(v) ? v : null;
}

/**
 * Interpreta `atributoInfluenciaHabilidade` e devolve a categoria correspondente.
 * Suporta string ou array; devolve todos os atributos se houver mais de um.
 *
 * NOTA: antes, habilidades de Defesa/Evasao SUBSTITUÍAM o ATK e o somavam ao dano,
 * produzindo "dano = DEF". Agora elas retornam a categoria, e o chamador decide.
 */
export function getInfluenceCategories(masterSkill) {
    const raw = masterSkill?.atributoInfluenciaHabilidade;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];

    const out = [];
    for (const name of list) {
        if (typeof name !== 'string') continue;
        if (name.includes('Ataque'))   out.push({ category: 'atk', label: 'ATK', icon: '⚔️' });
        else if (name.includes('Defesa')) out.push({ category: 'def', label: 'DEF', icon: '🛡️' });
        else if (name.includes('Evasao')) out.push({ category: 'eva', label: 'EVA', icon: '🏃' });
    }
    return out;
}

// ============================================================================
// ROLAGEM DE DANO
// ============================================================================

/**
 * Rola um ataque completo e devolve o resultado já aplicado.
 *
 * @param {object}   opts
 * @param {object}   opts.masterSkill   habilidade mestre (do cache)
 * @param {number}   opts.skillLevel    nível da habilidade na ficha
 * @param {number}   opts.baseDamage    valor fixo já resolvido (vence masterSkill)
 * @param {object}   opts.attacker      ficha/ator
 * @param {object}   opts.defender      ficha/alvo (opcional: sem alvo = sem mitigação)
 * @param {Function} opts.fomeMult      (ficha) => multiplicador de fome
 * @returns {{missed:boolean, d20:number, hitRoll:number, statLabel:string,
 *            statValue:number, fomeMultiplier:number, baseDamage:number,
 *            rawPower:number, mitigation:number, damage:number}}
 */
export function rollAttack({
    masterSkill,
    skillLevel = 1,
    baseDamage = null,
    attacker = {},
    defender = null,
    fomeMult = null,
    skipHitRoll = false,
    forcedD20 = null
}) {
    // ---- 1. Qual atributo do atacante alimenta a potência? ----
    const influences = getInfluenceCategories(masterSkill);
    const primary = influences[0] || { category: 'atk', label: 'ATK', icon: '⚔️' };

    // Só ATAQUE vira dano bruto. Defesa/Evasao não aumentam dano
    // (antes elas substituíam o ATK e eram somadas — bug conceitual).
    const statCategory = primary.category === 'atk' ? 'atk' : 'atk';
    const statLabel = primary.category === 'atk' ? 'ATK' : `${primary.label}→ATK`;
    const statValue = getStat(attacker, statCategory);

    // ---- 2. Multiplicador de fome ----
    let fomeMultiplier = 1;
    if (typeof fomeMult === 'function') {
        const m = Number(fomeMult(attacker));
        if (Number.isFinite(m) && m >= 0) fomeMultiplier = m;
    }
    const isDebuffed = fomeMultiplier < 1;
    const effectiveStat = Math.floor(statValue * fomeMultiplier);

    // ---- 3. Teste de esquiva (EVA do alvo REDUZ a chance de acerto) ----
    // EVASÃO é penalidade, não bônus: um EVA alto deve tornar o golpe mais
    // difícil de conectar.
    //   EVA 0  -> erra em d20 < 5      (20% de falha)
    //   EVA 5  -> erra em d20 < 10     (45%)
    //   EVA 20 -> erra sempre
    // `forcedD20` e `skipHitRoll` existem para os testes poderem verificar a
    // mitigacao isoladamente, sem interferencia da rolagem de esquiva.
    const d20 = Number.isFinite(forcedD20)
        ? Math.max(1, Math.min(20, Math.floor(forcedD20)))
        : Math.floor(Math.random() * 20) + 1;

    const targetEva = defender ? getStat(defender, 'eva') : 0;
    const hitRoll = d20 - targetEva;

    const missed = !skipHitRoll &&
        COMBAT_RULES.ENABLE_HIT_ROLL &&
        defender !== null &&
        hitRoll < COMBAT_RULES.HIT_THRESHOLD;

    // ---- 4. Dano bruto ----
    const skillBase = baseDamage !== null
        ? safeNum(baseDamage)
        : resolveSkillBaseDamage(masterSkill, skillLevel);

    const rawPower = Math.max(0, d20 + skillBase + effectiveStat);

    // ---- 5. Resultado ----
    // Se o golpe errou, não entra mitigação e não há dano nenhum.
    let mitigation = 0;
    let damage = 0;

    if (!missed) {
        damage = rawPower;

        if (defender) {
            const targetDef = getStat(defender, 'def');
            const cap = rawPower * COMBAT_RULES.MAX_MITIGATION_PCT;
            mitigation = Math.min(targetDef * COMBAT_RULES.DEF_ABSORB, cap);
            damage = Math.max(COMBAT_RULES.MIN_DAMAGE, rawPower - mitigation);
        }
    }

    return {
        missed,
        d20,
        hitRoll,
        statLabel,
        statIcon: primary.icon,
        statValue,
        effectiveStat,
        fomeMultiplier,
        isDebuffed,
        baseDamage: skillBase,
        rawPower,
        mitigation: Math.floor(mitigation),
        damage: Math.floor(damage),
        targetEva
    };
}

/**
 * Aplica o resultado a um token da arena, devendo ser chamado DENTRO da
 * transação — devolve os campos a gravar em vez de gravar diretamente.
 *
 * Retorna null se nada precisa mudar (acerto errado no alvo, ou alvo já no 0).
 */
export function buildDamageUpdate(token, result, sessionTokenPrefix = 'arena_state.tokens') {
    if (!token || !result || result.missed) return null;

    const current = safeNum(token.hp, 0);
    const maxHp = safeNum(token.hpMax, Math.max(current, 1));
    const remaining = Math.max(0, current - result.damage);
    const applied = current - remaining;

    if (applied <= 0) return null;
    if (remaining === current) return null;

    return {
        [`${sessionTokenPrefix}.${token.__arenaId}.hp`]: remaining,
        _applied: applied,
        _remaining: remaining,
        _maxHp: maxHp
    };
}

// ============================================================================
// MOVIMENTO EFETIVO (com penalidade de encumbrance)
// ============================================================================

/**
 * Movemento real de um token, já com a penalidade de peso.
 *
 * BUG CORRIGIDO: arena.js usava `window.calculateWeightStats`, que NUNCA EXISTIU
 * (é um export de módulo ES, não vai para window). A penalidade era código morto
 * e a ficha e a arena discordavam sobre o movimento do personagem.
 */
export function getEffectiveMovement(ficha, level = null) {
    if (!ficha) return 0;

    const base = safeNum(
        ficha.movimentoPersonagemBase ?? ficha.explorixMovimento,
        0
    );

    let penalty = 0;
    if (typeof ficha.mochila === 'object' && ficha.mochila !== null) {
        const weight = calculateWeightStats(ficha, level);
        penalty = safeNum(weight?.penalty, 0);
    }

    return Math.max(0, Math.floor(base - penalty));
}

// ============================================================================
// DISTÂNCIA
// ============================================================================

/**
 * Distância em hexágonos entre dois tokens. Retorna Infinity se algum
 * tokenizer estiver sem coordenada válida (antes gerava NaN silencioso).
 */
export function tokenDistance(tokenA, tokenB) {
    if (!tokenA || !tokenB) return Infinity;
    const { q: q1, r: r1 } = tokenA;
    const { q: q2, r: r2 } = tokenB;
    if (![q1, r1, q2, r2].every(Number.isFinite)) return Infinity;
    return hexDistance(q1, r1, q2, r2);
}

/**
 * Verifica se o alcance da habilidade permite atingir o alvo.
 * Sem `alcanceHabilidade` definido, assume alcance ilimitado
 * (mantém o comportamento antigo — mas agora é explícito e fácil de fechar).
 */
export function isWithinSkillRange(masterSkill, fromToken, toToken) {
    const max = Number(masterSkill?.alcanceHabilidade);
    if (!Number.isFinite(max) || max <= 0) return true;
    return tokenDistance(fromToken, toToken) <= max;
}

// ============================================================================
// RESOLUÇÃO DO ATOR (quem está agindo)
// ============================================================================

/**
 * Descobre de qual ficha o dano deve sair.
 *
 * BUG CORRIGIDO: quando o Mestre controlava um monstro, o código usava
 * `globalState.selectedCharacterId` (a ficha do PRÓPRIO Mestre) tanto para o
 * ATK quanto para o custo de MP. O monstro atacava com o ATK do Mestre.
 *
 * @returns {{ficha:object, tokenId:string|null, token:object|null,
 *            fichaId:string|null, isPlayer:boolean}}
 */
export function resolveActor(selectedTokenId, data) {
    const tokens = data?.tokens || {};

    // 1) Mestre controlando um token específico
    if (selectedTokenId && tokens[selectedTokenId]) {
        const token = tokens[selectedTokenId];
        const cached = lookupCachedEntity(token.originId, token.originCollection);
        if (cached) {
            return {
                ficha: cached.ficha || cached,
                tokenId: selectedTokenId,
                token,
                fichaId: token.originId,
                isPlayer: token.type === 'player'
            };
        }
        // token sem ficha no cache: usa o próprio token como fonte de stats
        return {
            ficha: token,
            tokenId: selectedTokenId,
            token,
            fichaId: null,
            isPlayer: token.type === 'player'
        };
    }

    // 2) Jogador comum: procura o token do seu personagem
    const myCharId = globalState.selectedCharacterId;
    const entry = Object.entries(tokens).find(([, t]) => t.originId === myCharId);
    const charData = globalState.cache.all_personagens.get(myCharId);

    return {
        ficha: charData ? (charData.ficha || charData) : {},
        tokenId: entry ? entry[0] : null,
        token: entry ? entry[1] : null,
        fichaId: myCharId,
        isPlayer: true
    };
}

function lookupCachedEntity(originId, originCollection) {
    if (!originId) return null;
    if (originCollection === 'rpg_fichasNPCMonstros') {
        return globalState.cache.mobs.get(originId) || null;
    }
    if (originCollection === 'rpg_Npcs') {
        return globalState.cache.npcs.get(originId) || null;
    }
    return globalState.cache.all_personagens.get(originId) ||
           globalState.cache.personagens.get(originId) || null;
}