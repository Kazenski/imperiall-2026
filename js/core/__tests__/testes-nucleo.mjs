// Testes unitarios do nucleo de matematica (sem DOM, sem Firebase).
// Rode com:  node js/core/__tests__/testes-nucleo.mjs

import assert from 'node:assert/strict';
import { globalState, COINS } from '../state.js';
import {
    getXpBracket, calculateLevelFromXP, getFomeDebuffMultiplier,
    calculateStatCascade, resolvePool, getWallet, optimizeCoinsGuard
} from '../calculos.js';
import {
    hexDistance, hexToPixel, pixelToHex, hexRound, hexesInRadius, hexRing,
    hexLine, gridToAxial, isInsideGrid, getReachableHexes, getHexPoints
} from '../hex.js';
import { COMBAT_RULES, rollAttack, getStat, resolveSkillBaseDamage, getEffectiveMovement } from '../combate.js';

let pass = 0, fail = 0;
const results = [];

function test(name, fn) {
    try { fn(); pass++; results.push(`  PASS  ${name}`); }
    catch (e) { fail++; results.push(`  FAIL  ${name}\n        ${e.message}`); }
}
function section(name) { results.push(`\n== ${name} ==`); }

// ---------------------------------------------------------------- XP / NIVEL
section('XP e nivel (bug de off-by-one)');

globalState.cache.tabela_xp = { niveis: {
    1: { experienciaParaProximoNivel: 0 },
    2: { experienciaParaProximoNivel: 100 },
    3: { experienciaParaProximoNivel: 300 },
    4: { experienciaParaProximoNivel: 600 }
} };

test('xp=0 => nivel 1', () => assert.equal(calculateLevelFromXP(0), 1));
test('xp=99 => nivel 1', () => assert.equal(calculateLevelFromXP(99), 1));
test('xp=100 => nivel 2', () => assert.equal(calculateLevelFromXP(100), 2));
test('xp=299 => nivel 2', () => assert.equal(calculateLevelFromXP(299), 2));
test('xp=300 => nivel 3', () => assert.equal(calculateLevelFromXP(300), 3));
test('xp=150 => nivel 2 (a barra antiga dizia 3)', () => assert.equal(calculateLevelFromXP(150), 2));
test('xp=10000 => nivel maximo', () => assert.equal(calculateLevelFromXP(10000), 4));

test('bracket de 150xp: floor=100 ceiling=300 pct=25', () => {
    const b = getXpBracket(150);
    assert.equal(b.level, 2);
    assert.equal(b.floor, 100);
    assert.equal(b.ceiling, 300);
    assert.equal(Math.round(b.pct), 25);
});

test('xp nao-numerico nao quebra', () => {
    assert.equal(calculateLevelFromXP('abc'), 1);
    assert.equal(calculateLevelFromXP(undefined), 1);
    assert.equal(calculateLevelFromXP(-50), 1);
});

test('tabela degenerada (incremento 0) nao gera Infinity/NaN', () => {
    globalState.cache.tabela_xp = { niveis: {
        1: { experienciaParaProximoNivel: 0 },
        2: { experienciaParaProximoNivel: 0 },
        3: { experienciaParaProximoNivel: 0 }
    } };
    const b = getXpBracket(10);
    assert.ok(Number.isFinite(b.pct), 'pct deve ser finito');
    assert.equal(b.pct, 100);
    globalState.cache.tabela_xp = { niveis: {
        1: { experienciaParaProximoNivel: 0 }, 2: { experienciaParaProximoNivel: 100 },
        3: { experienciaParaProximoNivel: 300 }, 4: { experienciaParaProximoNivel: 600 } } };
});

// ------------------------------------------------------------------- FOME
section('Debuff de fome');

test('fome >= 50 => sem debuff', () => assert.equal(getFomeDebuffMultiplier({ fomeAtual: 50 }), 1));
test('fome 100 => sem debuff', () => assert.equal(getFomeDebuffMultiplier({ fomeAtual: 100 }), 1));
test('fome 25 => 0.25', () => assert.equal(getFomeDebuffMultiplier({ fomeAtual: 25 }), 0.25));
test('fome 0 => 0', () => assert.equal(getFomeDebuffMultiplier({ fomeAtual: 0 }), 0));

test('fome "abc" nao produz NaN (bug do "HIT! NaN")', () => {
    const m = getFomeDebuffMultiplier({ fomeAtual: 'abc' });
    assert.ok(Number.isFinite(m), `multiplicador deve ser finito, veio ${m}`);
});

test('fome negativa nao produz multiplicador negativo', () => {
    const m = getFomeDebuffMultiplier({ fomeAtual: -50 });
    assert.ok(m >= 0, 'multiplicador nao pode ser negativo');
});

test('ficha sem fomeAtual usa o maximo', () => {
    assert.equal(getFomeDebuffMultiplier({ atributosBasePersonagem: {} }), 1);
});

test('fome NaN nao contamina o dano final', () => {
    const r = rollAttack({
        masterSkill: { efeitoDanoBaseUsoHabilidade: 5 },
        attacker: { atkPersonagemBase: 20, fomeAtual: 'invalido' },
        defender: { defPersonagemBase: 5, evaPersonagemBase: 0 },
        fomeMult: getFomeDebuffMultiplier
    });
    assert.ok(Number.isFinite(r.damage), `dano deve ser finito, veio ${r.damage}`);
});

// ------------------------------------------------------------- CASCATA HP/MP
section('Cascata de HP/MP');

const fichaCheia = {
    hpMaxPersonagemBase: 100,
    hpPersonagemBase: 100,
    atributosBasePersonagem: { defesaCorporalNativaTotal: 20, pontosHPExtraTotal: 10 }
};

test('dano Consome escudo antes do base', () => {
    const r = calculateStatCascade(fichaCheia, 'hp', -5);
    assert.equal(r.updates.hpShieldAtual, 15);
    assert.equal(r.updates.hpPersonagemBase, 100);
    assert.equal(r.total, 125);
});

test('dano maior que escudo passa para o extra e para o base', () => {
    const r = calculateStatCascade(fichaCheia, 'hp', -35);
    assert.equal(r.updates.hpShieldAtual, 0);
    assert.equal(r.updates.hpExtraAtual, 0);
    assert.equal(r.updates.hpPersonagemBase, 95);
});

test('BUG: HP nunca fica negativo', () => {
    const r = calculateStatCascade(fichaCheia, 'hp', -9999);
    assert.ok(r.updates.hpPersonagemBase >= 0, `base negativa: ${r.updates.hpPersonagemBase}`);
    assert.ok(r.total >= 0, `total negativo: ${r.total}`);
});

test('cura preenche base, depois extra, depois escudo', () => {
    // base=10 (max 100), extra=0, escudo=10. Ordem da cura:
    // base -> extra -> escudo.
    // Com +25 o base tem folga (90), entao absorve TUDO de uma vez:
    // base 10 -> 35, e nao sobra nada para extra nem escudo.
    const ficha = { hpMaxPersonagemBase: 100, hpPersonagemBase: 10,
    hpExtraAtual: 0, hpShieldAtual: 10,
        atributosBasePersonagem: { defesaCorporalNativaTotal: 10, pontosHPExtraTotal: 10 } };
    const r = calculateStatCascade(ficha, 'hp', 25);
    assert.equal(r.updates.hpPersonagemBase, 35);
    assert.equal(r.updates.hpExtraAtual, 0);
    assert.equal(r.updates.hpShieldAtual, 10);
    assert.equal(r.total, 45);
});

test('cura estoura o base e passa para o extra e para o escudo', () => {
    // base=90 (max 100), extra=0, escudo=10, cura de +40.
    //   base recebe +10 (90 -> 100), extra recebe +10 (0 -> 10),
    //   escudo recebe +20 mas seu max e 10, entao fica em 10. Sobra 0? ->veja total.
    const ficha = { hpMaxPersonagemBase: 100, hpPersonagemBase: 90,
        hpExtraAtual: 0, hpShieldAtual: 0,
        atributosBasePersonagem: { defesaCorporalNativaTotal: 10, pontosHPExtraTotal: 10 } };
    const r = calculateStatCascade(ficha, 'hp', 40);
    assert.equal(r.updates.hpPersonagemBase, 100);
    assert.equal(r.updates.hpExtraAtual, 10);
    assert.equal(r.updates.hpShieldAtual, 10);
    assert.equal(r.total, 120);
    assert.ok(r.updates.hpShieldAtual <= 10, 'escudo nunca passa do max');
});

test('campos ausentes/NaN nao quebram a cascata', () => {
    const r = calculateStatCascade({}, 'hp', -10);
    assert.ok(Number.isFinite(r.total));
    assert.ok(r.total >= 0);
});

test('resolvePool soma base+extra+escudo igual em toda aba', () => {
    const p = resolvePool(fichaCheia, 'hp');
    assert.equal(p.base, 100);
    assert.equal(p.shield, 20);
    assert.equal(p.extra, 10);
    assert.equal(p.current, 130);
    assert.equal(p.max, 130);
});

// ------------------------------------------------------------------ MOEDAS
section('Carteira e moedas');

test('getWallet usa COINS.val (nao numeros magicos)', () => {
    const w = getWallet({ mochila: {
        [COINS.GOLD.id]: 1, [COINS.SILVER.id]: 1, [COINS.BRONZE.id]: 1 } });
    assert.equal(w.total, COINS.GOLD.val + COINS.SILVER.val + COINS.BRONZE.val);
    assert.equal(w.total, 111);
});

test('getWallet com mochila suja nao produz NaN', () => {
    const w = getWallet({ mochila: { [COINS.GOLD.id]: 'abc' } });
    assert.ok(Number.isFinite(w.total));
    assert.equal(w.total, 0);
});

test('otimizar moedas e lossless', () => {
    const o = optimizeCoinsGuard(1234);
    assert.deepEqual(o, { gold: 12, silver: 3, bronze: 4 });
    assert.equal(o.gold * 100 + o.silver * 10 + o.bronze, 1234);
});

// -------------------------------------------------------------------- HEX
section('Matematica hexagonal');

test('hexDistance de uma celula a si mesma = 0', () => assert.equal(hexDistance(3, 4, 3, 4), 0));
test('hexDistance vizinhos adjacentes = 1', () => {
    const dirs = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    for (const [dq, dr] of dirs) assert.equal(hexDistance(5, 5, 5 + dq, 5 + dr), 1);
});
test('hexDistance e simetrica', () => {
    assert.equal(hexDistance(2, 3, 9, 7), hexDistance(9, 7, 2, 3));
});
test('hexDistance sempre inteiro', () => {
    for (let q1 = -8; q1 <= 8; q1 += 3)
        for (let r1 = -8; r1 <= 8; r1 += 3)
            for (let q2 = -8; q2 <= 8; q2 += 3)
                for (let r2 = -8; r2 <= 8; r2 += 3) {
                    const d = hexDistance(q1, r1, q2, r2);
                    assert.ok(Number.isInteger(d), `nao inteiro: ${q1},${r1} -> ${q2},${r2} = ${d}`);
                }
});

test('hexToPixel/pixelToHex faz round-trip', () => {
    for (let q = -6; q <= 6; q += 4)
        for (let r = -6; r <= 6; r += 4) {
      const p = hexToPixel(q, r);
            const back = pixelToHex(p.x, p.y);
            assert.equal(back.q, q, `q round-trip ${q},${r}`);
            assert.equal(back.r, r, `r round-trip ${q},${r}`);
        }
});

test('hexRound e estavel', () => {
    const a = hexRound(1.4, 2.6), b = hexRound(1.4, 2.6);
    assert.deepEqual(a, b);
});

test('hexesInRadius(0) devolve so o centro', () => {
    const c = hexesInRadius(4, 4, 0);
    assert.equal(c.length, 1);
    assert.deepEqual(c[0], { q: 4, r: 4 });
});

test('hexesInRadius(r=2) devolve 19 celulas (1+3r(r+1))', () => {
    assert.equal(hexesInRadius(0, 0, 2).length, 1 + 3 * 2 * 3);
});

test('hexesInRadius(r=5) devolve 91 (e nao 1600)', () => {
    assert.equal(hexesInRadius(0, 0, 5).length, 91);
});

test('toda celula de hexesInRadius respeita a distancia', () => {
    const cells = hexesInRadius(3, -2, 4);
    for (const c of cells) {
        assert.ok(hexDistance(3, -2, c.q, c.r) <= 4,
            `celula ${c.q},${c.r} fora do raio 4`);
    }
});

test('hexesInRadius nao devolve duplicatas', () => {
    const keys = new Set(hexesInRadius(2, 2, 4).map(c => `${c.q},${c.r}`));
    assert.equal(keys.size, hexesInRadius(2, 2, 4).length);
});

test('hexRing exclui o centro e tem 6*r celulas', () => {
    const ring = hexRing(0, 0, 3);
    assert.equal(ring.length, 18);
    assert.ok(!ring.some(c => c.q === 0 && c.r === 0), 'anel nao deve conter o centro');
});

test('hexLine conecta origem e destino', () => {
    const line = hexLine(0, 0, 4, 2);
    assert.deepEqual(line[0], { q: 0, r: 0 });
    assert.deepEqual(line[line.length - 1], { q: 4, r: 2 });
    assert.equal(line.length, hexDistance(0, 0, 4, 2) + 1);
});

test('gridToAxial implementa a convencao usada pelo renderGrid', () => {
    // O codigo original da arena era `qAxial = q - Math.floor(r / 2)`.
    // Portanto a linha 0 e a linha 1 nao sao deslocadas (floor(1/2) === 0),
    // e a partir da linha 2 cada linha par avanca um axial.
    assert.equal(gridToAxial(0, 0), 0);
    assert.equal(gridToAxial(0, 1), 0);    // floor(1/2) = 0 -> sem deslocamento
    assert.equal(gridToAxial(0, 2), -1);   // floor(2/2) = 1
    assert.equal(gridToAxial(0, 3), -1);
    assert.equal(gridToAxial(0, 4), -2);
    assert.equal(gridToAxial(5, 3), 4);
    assert.equal(gridToAxial(39, 0), 39);
    assert.equal(gridToAxial(0, 39), -19); // floor(39/2) = 19
});

test('getHexPoints devolve 6 vertices', () => {
    assert.equal(getHexPoints(0, 0, 17).trim().split(/\s+/).length, 6);
});

test('isInsideGrid rejeita fora dos limites', () => {
    assert.equal(isInsideGrid(0, 0), true);
    assert.equal(isInsideGrid(-1, 0), false);
    assert.equal(isInsideGrid(0, -1), false);
    assert.equal(isInsideGrid(0, 40), false);
    assert.equal(isInsideGrid(NaN, 3), false);
});

test('getReachableHexes respeita a faixa e a grade', () => {
    const set = getReachableHexes(20, 20, 2);
    const dists = [...set].map(k => {
        const [q, r] = k.split(',').map(Number);
      return hexDistance(20, 20, q, r);
    });
    assert.ok(Math.max(...dists) <= 2, 'nao pode passar do raio 2');
    for (const k of set) {
        const [q, r] = k.split(',').map(Number);
        assert.ok(isInsideGrid(q, r), `celula ${k} fora da grade`);
    }
});

test('getReachableHexes respeita bloqueios', () => {
    const blocked = new Set(['21,20']);
    const set = getReachableHexes(20, 20, 3, blocked);
    assert.ok(!set.has('21,20'), 'celula bloqueada nao deve ser alcancavel');
});

test('getReachableHexes com range 0 devolve so a origem', () => {
    assert.equal(getReachableHexes(5, 5, 0).size, 1);
});

test('getReachableHexes com range NaN nao trava nem explode', () => {
    const set = getReachableHexes(5, 5, NaN);
    assert.ok(set.size >= 1);
});

// ---------------------------------------------------------------- COMBATE
section('Combate');

test('getStat le o esquema de jogador e o de monstro', () => {
    assert.equal(getStat({ atkPersonagemBase: 12 }, 'atk'), 12);
    assert.equal(getStat({ atk_base: 7 }, 'atk'), 7);
    assert.equal(getStat({ def_base: 3 }, 'def'), 3);
    assert.equal(getStat({ eva_base: 4 }, 'eva'), 4);
});

test('getStat nunca devolve NaN', () => {
    assert.equal(getStat({ atkPersonagemBase: 'abc' }, 'atk'), 0);
    assert.equal(getStat(null, 'atk'), 0);
    assert.equal(getStat({}, 'atk'), 0);
});

test('getStat prioriza o campo do jogador', () => {
    assert.equal(getStat({ atkPersonagemBase: 10, atk_base: 99 }, 'atk'), 10);
});

test('dano base: nivel sem registro cai no valor raiz', () => {
    assert.equal(resolveSkillBaseDamage({ efeitoDanoBaseUsoHabilidade: 8 }, 1), 8);
});

test('dano base: nivel registrado SUBSTITUI o valor raiz', () => {
    const m = { efeitoDanoBaseUsoHabilidade: 8, niveis: { 3: { danoBaseHabilidade: 20 } } };
    assert.equal(resolveSkillBaseDamage(m, 3), 20);
});

test('dano base com habilidade ausente = 0', () => {
    assert.equal(resolveSkillBaseDamage(null, 1), 0);
});

test('DEF mitiga o dano', () => {
    // d20 travado + esquiva desligada: isola a mitigação.
    const r = rollAttack({
        masterSkill: { efeitoDanoBaseUsoHabilidade: 0 },
        baseDamage: 20,
        attacker: { atkPersonagemBase: 0 },
        defender: { defPersonagemBase: 10, evaPersonagemBase: 0 },
        forcedD20: 10,
        skipHitRoll: true
    });
    assert.ok(r.mitigation > 0, `deveria mitigar, veio ${r.mitigation}`);
    assert.ok(r.damage < r.rawPower, `dano ${r.damage} deveria ser < bruto ${r.rawPower}`);
});

test('DEF respeita o teto de mitigacao', () => {
    const r = rollAttack({
        masterSkill: null,
        baseDamage: 20,
        attacker: { atkPersonagemBase: 0 },
        defender: { defPersonagemBase: 100000, evaPersonagemBase: 0 },
        forcedD20: 10,
        skipHitRoll: true
    });
    assert.ok(r.damage >= COMBAT_RULES.MIN_DAMAGE, `sempre aplica dano minimo, veio ${r.damage}`);
    // O piso do dano e o valor do teto arredondado PARA BAIXO (o dano final
    // tambem e Math.floor), entao 7.5 vira 7, nao 8.
    const piso = Math.floor(r.rawPower * (1 - COMBAT_RULES.MAX_MITIGATION_PCT));
    assert.ok(
        r.damage >= piso,
        `teto violado: dano ${r.damage} < piso ${piso} (bruto ${r.rawPower})`
    );
});

test('DEF 0 deixa o dano bruto intacto', () => {
    const r = rollAttack({
        masterSkill: null, baseDamage: 25,
        attacker: { atkPersonagemBase: 0 },
        defender: { defPersonagemBase: 0, evaPersonagemBase: 0 },
        forcedD20: 10, skipHitRoll: true
    });
    assert.equal(r.mitigation, 0);
    assert.equal(r.damage, r.rawPower);
});

test('EVA alta faz o ataque errar sempre', () => {
    for (let i = 0; i < 100; i++) {
        const r = rollAttack({
            masterSkill: null, baseDamage: 50,
            attacker: { atkPersonagemBase: 10 },
            defender: { defPersonagemBase: 0, evaPersonagemBase: 100 },
            fomeMult: () => 1
        });
        assert.equal(r.missed, true, 'EVA 100 deveria errar sempre');
        assert.equal(r.damage, 0);
    }
});

test('EVA 0 erra apenas quando d20 < HIT_THRESHOLD', () => {
    for (let i = 0; i < 300; i++) {
        const r = rollAttack({
            masterSkill: null, baseDamage: 5,
            attacker: { atkPersonagemBase: 5 },
            defender: { defPersonagemBase: 0, evaPersonagemBase: 0 }
        });
        assert.equal(r.missed, r.d20 < COMBAT_RULES.HIT_THRESHOLD, `d20=${r.d20} inconsistente`);
    }
});

test('EVA reduz monotonicamente a chance de acerto', () => {
    const taxaDeAcerto = eva => {
        let acertos = 0;
        for (let i = 0; i < 4000; i++) {
            const r = rollAttack({
                masterSkill: null, baseDamage: 5,
                attacker: { atkPersonagemBase: 5 },
                defender: { defPersonagemBase: 0, evaPersonagemBase: eva },
                fomeMult: () => 1
            });
            if (!r.missed) acertos++;
        }
        return acertos / 4000;
    };

    const t0 = taxaDeAcerto(0);
    const t5 = taxaDeAcerto(5);
    const t15 = taxaDeAcerto(15);

    assert.ok(t0 > t5, `EVA 0 (${t0}) deve acertar mais que EVA 5 (${t5})`);
    assert.ok(t5 > t15, `EVA 5 (${t5}) deve acertar mais que EVA 15 (${t15})`);
    // EVA 0 => erra em 1..4 = 20% => ~80% de acerto
    assert.ok(Math.abs(t0 - 0.80) < 0.05, `EVA 0 deveria acertar ~80%, veio ${t0}`);
    // EVA 15 => erra em 1..19 (d20-15 < 5 => d20 < 20) => ~5% de acerto
    assert.ok(t15 < 0.15, `EVA 15 deveria acertar pouco, veio ${t15}`);
});

test('dano nunca e negativo nem NaN', () => {
    for (let i = 0; i < 300; i++) {
        const r = rollAttack({
            masterSkill: { efeitoDanoBaseUsoHabilidade: -50 },
            baseDamage: -50,
            attacker: { atkPersonagemBase: -10 },
            defender: { defPersonagemBase: 0, evaPersonagemBase: 0 }
        });
        assert.ok(Number.isFinite(r.damage), `dano NaN: ${r.damage}`);
    assert.ok(r.damage >= 0, `dano negativo: ${r.damage}`);
    }
});

test('sem alvo nao ha mitigacao nem erro de acerto', () => {
    const r = rollAttack({ masterSkill: null, baseDamage: 12, attacker: { atkPersonagemBase: 3 }, defender: null });
    assert.equal(r.missed, false);
    assert.equal(r.mitigation, 0);
});

test('fome reduz o dano de forma coerente', () => {
    const base = { masterSkill: null, baseDamage: 10, defender: { defPersonagemBase: 0, evaPersonagemBase: 0 } };
    const full = rollAttack({ ...base, attacker: { atkPersonagemBase: 100 }, fomeMult: () => 1 });
    const hungry = rollAttack({ ...base, attacker: { atkPersonagemBase: 100 }, fomeMult: () => 0.5 });
    assert.ok(hungry.rawPower < full.rawPower, 'fome deve reduzir a potencia');
});

test('movimento efetivo desconta a penalidade de peso', () => {
    globalState.cache.itens = new Map([['i1', { peso: 100 }]]);
    const ficha = { movimentoPersonagemBase: 10, mochila: { i1: 3 } };
    const w = globalState.cache;
    const mov = getEffectiveMovement(ficha, 1);
    assert.ok(mov <= 10, 'nunca pode aumentar o movimento');
    assert.ok(mov >= 0, 'nunca pode ser negativo');
});

test('movimento sem peso = movimento base', () => {
    assert.equal(getEffectiveMovement({ movimentoPersonagemBase: 8, mochila: {} }, 1), 8);
});

test('movimento com valor invalido nao quebra', () => {
    assert.equal(getEffectiveMovement({ movimentoPersonagemBase: 'abc' }, 1), 0);
    assert.equal(getEffectiveMovement(null), 0);
});

// ------------------------------------------------------------------ RESULTADO
console.log(results.join('\n'));
console.log(`\n${'-'.repeat(50)}`);
console.log(`${pass} passaram, ${fail} falharam (total ${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);