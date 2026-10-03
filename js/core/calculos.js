// ARQUIVO: js/core/calculos.js
import { globalState, COINS } from './state.js';

export function createBonusObject() { 
    return { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 }; 
}

export function calculateLevelFromXP(xp = 0) {
    return getXpBracket(xp).level;
}

/**
 * Fonte ÚNICA da verdade sobre nível + barra de XP.
 *
 * BUG CORRIGIDO (off-by-one): a barra de XP da ficha usava uma busca ASCENDENTE
 * ("se xp < requisito do nível N, então sou o nível N") e sobrava sempre um nível
 * a mais. Ex.: tabela 1→0 XP, 2→100 XP, 3→300 XP; com 150 XP a barra dizia
 * "Nvl 3" enquanto TODOS os cálculos de status usavam nível 2.
 *
 * Semântica de `experienciaParaProximoNivel`: XP acumulado necessário para
 * atingir aquele nível (1→0, 2→100, 3→300...). Logo o nível atual é o MAIOR
 * nível cujo requisito já foi alcançado.
 */
export function getXpBracket(xp = 0) {
    const t = globalState.cache.tabela_xp;
    const safeXp = Number.isFinite(Number(xp)) ? Number(xp) : 0;

    if (!t?.niveis) return { level: 1, floor: 0, ceiling: 1000, pct: 0, isMaxLevel: false };

    const levels = Object.keys(t.niveis).map(Number).sort((a, b) => a - b);
    if (levels.length === 0) return { level: 1, floor: 0, ceiling: 1000, pct: 0, isMaxLevel: false };

    let currentLevel = levels[0];
    for (const lvl of levels) {
        const req = Number(t.niveis[lvl]?.experienciaParaProximoNivel) || 0;
        if (safeXp >= req) currentLevel = lvl;
        else break;
    }

    const idx = levels.indexOf(currentLevel);
    const isMaxLevel = idx === levels.length - 1;

    const floor = Number(t.niveis[currentLevel]?.experienciaParaProximoNivel) || 0;
    const ceiling = isMaxLevel
        ? floor
        : (Number(t.niveis[levels[idx + 1]]?.experienciaParaProximoNivel) || floor + 1000);

    // Guarda contra divisão por zero em tabelas malformadas (incremento 0).
    const span = ceiling - floor;
    const pct = (isMaxLevel || span <= 0)
        ? 100
        : Math.min(100, Math.max(0, ((safeXp - floor) / span) * 100));

    return { level: currentLevel, floor, ceiling, pct, isMaxLevel };
}

export function sumXpTableBonuses(lvl) {
    const t = globalState.cache.tabela_xp?.niveis[lvl] || {};
    return { hp: t.bonusHpLevelBase||0, mp: t.bonusMpLevelBase||0, iniciativa: t.bonusIniciativaLevelBase||0, ap: t.bonusApLevelBase||0 };
}

export function getFomeDebuffMultiplier(ficha) {
    if (!ficha) return 1;
    const atributos = ficha.atributosBasePersonagem || {};

    // pontosFomeExtraTotal é um MODIFICADOR (ratio), não um valor absoluto.
    const rawFomeExtra = Number(atributos.pontosFomeExtraTotal);
    const fomeExtra = Number.isFinite(rawFomeExtra) ? rawFomeExtra : 0;

    const fomeMax = Math.max(1, Math.floor(100 + fomeExtra));

    const rawAtual = ficha.fomeAtual !== undefined ? Number(ficha.fomeAtual) : fomeMax;
    // BUG CORRIGIDO: fomeAtual = "abc" produzia NaN, que atravessava a
    // multiplicação e imprimia literalmente "HIT! NaN" no log de combate.
    const fomeAtual = Number.isFinite(rawAtual) ? rawAtual : fomeMax;

    if (fomeAtual >= 50) return 1;
    return Math.max(0, Math.min(1, fomeAtual / 100));
}

export function calculateWeightStats(ficha, level) {
    if (!ficha) return { current: 0, max: 50, penalty: 0 };
    
    let totalWeight = 0;
    const mochila = ficha.mochila || {};
    const equip = ficha.equipamentos || ficha.equipamento || {};

    Object.entries(mochila).forEach(([id, qty]) => {
        let itemInfo = globalState.cache.itens.get(id) || globalState.cache.allItems?.get(id);
        let itemWeight = itemInfo && itemInfo.peso !== undefined ? Number(itemInfo.peso) : 0.1;
        totalWeight += itemWeight * qty;
    });

    Object.values(equip).forEach(id => {
        if (!id) return;
        let itemInfo = globalState.cache.itens.get(id) || globalState.cache.allItems?.get(id);
        let itemWeight = itemInfo && itemInfo.peso !== undefined ? Number(itemInfo.peso) : 0.1;
        totalWeight += itemWeight;
    });

    totalWeight = Number(totalWeight.toFixed(1));

    const actualLevel = level || ficha.levelPersonagemBase || 1;
    const extraCapacity = Number(ficha.bonusPesoMochilas || 0); 
    let maxWeight = 50 + (actualLevel * 2) + extraCapacity;

    let multiplicadorMercador = 1;
    if (ficha.habilidades) {
        for (const [skillId, skillData] of Object.entries(ficha.habilidades)) {
            const masterSkill = globalState.cache.habilidades.get(skillId);
            if (masterSkill && masterSkill.nome && masterSkill.nome.includes("Mercador - Festival Itinerante")) {
                const nivelHab = skillData.nivel || 1;
                multiplicadorMercador = nivelHab + 1;
                break; 
            }
        }
    }

    maxWeight = maxWeight * multiplicadorMercador;

    let penalty = 0;
    if (totalWeight > maxWeight) {
        const excess = totalWeight - maxWeight;
        penalty = Math.floor(excess / 5);
    }

    return { current: totalWeight, max: maxWeight, penalty: penalty };
}

export function calculateMainStats(allData, pts) {
    const { raca, classe, subclasse, bonusItens, ficha, constellationTemplate } = allData;
    const lvl = calculateLevelFromXP(ficha.experienciapersonagemBase);
    const xpB = sumXpTableBonuses(lvl);
    
    const constB = { hp:0, mp:0, atk:0, def:0, eva:0, iniciativa:0, ap:0, movimento:0 };
    if(constellationTemplate && ficha.constelacao_unlocked) {
        const un = new Set(ficha.constelacao_unlocked);
        constellationTemplate.nodes.forEach(n => {
            if(un.has(n.id) && n.data.bonuses) {
                for(const [k,v] of Object.entries(n.data.bonuses)) {
                     const mapK = k === 'hp' ? 'hp' : (k==='mp'?'mp':(k==='ap'?'ap':(k==='iniciativa'?'iniciativa':(k==='movimento'?'movimento': k))));
                    if(constB[mapK] !== undefined) constB[mapK] += v;
                }
            }
        });
    }

    const ego = ficha.armaEspiritual;
    const egoBonusAtk = (ego && ego.ativo) ? (ego.danoBase || 0) : 0;

    const baseRaw = {
        hp: (raca.hpRacialBase||0) + (classe.bonusHpClasseBase||0) + (subclasse.bonusHpSubclasseBase||0) + xpB.hp,
        mp: (raca.mpRacialBase||0) + (classe.bonusMpClasseBase||0) + (subclasse.bonusMpSubclasseBase||0) + xpB.mp,
        iniciativa: xpB.iniciativa,
        movimento: (raca.movimentacao||0),
        ap: xpB.ap,
        atk: (raca.bonusAtkRacaBase||0) + (classe.bonusAtaqueClasseBase||0) + (subclasse.bonusAtaqueSubclasseBase||0),
        def: (raca.bonusDefRacaBase||0) + (classe.bonusDefesaClasseBase||0) + (subclasse.bonusDefesaSubclasseBase||0),
        eva: (raca.bonusEvaRacaBase||0) + (classe.bonusEvasaoClasseBase||0) + (subclasse.bonusEvasaoSubclasseBase||0)
    };

    const weightStats = calculateWeightStats(ficha, lvl);
    const movPenalty = weightStats.penalty;

    const final = {
        hpMax: baseRaw.hp + bonusItens.hpMax + constB.hp,
        mpMax: baseRaw.mp + bonusItens.mpMax + constB.mp,
        iniciativa: baseRaw.iniciativa + bonusItens.iniciativa + constB.iniciativa,
        movimento: baseRaw.movimento + bonusItens.movimento + constB.movimento, 
        ap: baseRaw.ap + bonusItens.apMax + constB.ap + (ficha.apBonusColecao || 0)
    };
    
    return {
        level: lvl, 
        ...final,
        weightPenalty: movPenalty, 
        breakdowns: {
            atk: { base: baseRaw.atk, equip: bonusItens.atk, const: constB.atk, dist: (pts?.atk||0), ego: egoBonusAtk },
            def: { base: baseRaw.def, equip: bonusItens.def, const: constB.def, dist: (pts?.def||0) },
            eva: { base: baseRaw.eva, equip: bonusItens.eva, const: constB.eva, dist: (pts?.eva||0) }
        },
        atk: baseRaw.atk + bonusItens.atk + constB.atk + (pts?.atk||0) + egoBonusAtk,
        def: baseRaw.def + bonusItens.def + constB.def + (pts?.def||0),
        eva: baseRaw.eva + bonusItens.eva + constB.eva + (pts?.eva||0)
    };
}

export function calculateDetailedStats(allData) {
    const { ficha, raca, classe, subclasse, itensEquipados, constellationTemplate } = allData;
    const lvl = calculateLevelFromXP(ficha.experienciapersonagemBase);
    const res = { Ataque:{}, Defesa:{}, Evasao:{} };
    const tipos = { 
        Ataque: ["Fisico", "Magico", "Elemental", "Espiritual", "Divino", "Imunidade", "Hibrido", "Definitivo"], 
        Defesa: ["Fisica", "Magica", "Elemental", "Espiritual", "Divina", "Imunidade", "Hibrida", "Definitiva"], 
        Evasao: ["Fisica", "Magica", "Elemental", "Espiritual", "Divina", "Imunidade", "Hibrida", "Definitiva"] 
    };
    
    const pts = {
        Ataque: ficha.pontosDistribuidosAtk || 0,
        Defesa: ficha.pontosDistribuidosDef || 0,
        Evasao: ficha.pontosDistribuidosEva || 0
    };

    const constB = { Ataque: 0, Defesa: 0, Evasao: 0 };
    if(constellationTemplate && ficha.constelacao_unlocked) {
        const un = new Set(ficha.constelacao_unlocked);
        constellationTemplate.nodes.forEach(n => {
            if(un.has(n.id) && n.data.bonuses) {
                if(n.data.bonuses.atk) constB.Ataque += n.data.bonuses.atk;
                if(n.data.bonuses.def) constB.Defesa += n.data.bonuses.def;
                if(n.data.bonuses.eva) constB.Evasao += n.data.bonuses.eva;
            }
        });
    }

    const ego = ficha.armaEspiritual;
    const egoBonus = (ego && ego.ativo) ? (ego.danoBase || 0) : 0;
    
    const progNorm = {};
    Object.keys(classe.progressaoPorLevel||{}).forEach(k => progNorm[k.toLowerCase()] = classe.progressaoPorLevel[k]);

    for(const cat in tipos) {
        tipos[cat].forEach(t => {
            const short = cat==='Ataque'?'Atk':cat.slice(0,3); 
            
            const base = (raca[`bonus${short}RacaBase`]||0) + (classe[`bonus${cat}ClasseBase`]||0) + (subclasse[`bonus${cat}SubclasseBase`]||0);
            const equip = itensEquipados.reduce((acc, i) => acc + (i[`bonus${cat}${t}ItemBase`]||0), 0);
            const prog = lvl * (progNorm[`progressao${short}${t}porlevel`.toLowerCase()]||0);
            const dist = pts[cat] || 0;
            const constelacao = constB[cat] || 0;
            const egoVal = (cat === 'Ataque') ? egoBonus : 0;

            let total = base + prog + equip + dist + constelacao + egoVal;
            const fomeMultiplier = getFomeDebuffMultiplier(ficha);
            total = Math.floor(total * fomeMultiplier);

            res[cat][t] = { base, progressao: prog, equipamentos: equip, distribuidos: dist, constelacao: constelacao, ego: egoVal, total };
        });
    }
    return res;
}

export function calculateDynamicAttributes(fichaOriginal, raca, classe, subclasse) {
    const totais = { ...(fichaOriginal.atributosBasePersonagem || {}) };
    for(let key in totais) totais[key] = 0;

    const sources = [raca, classe, subclasse];
    
    if (fichaOriginal.profissoes) {
        Object.keys(fichaOriginal.profissoes).forEach(profId => {
            sources.push(globalState.cache.profissoes.get(profId));
        });
    }
    
    if (fichaOriginal.habilidades) {
        Object.keys(fichaOriginal.habilidades).forEach(skillId => {
            const skillInfo = globalState.cache.habilidades.get(skillId);
            if (skillInfo && skillInfo.modificadoresAtributos) sources.push(skillInfo);
        });
    }

    sources.forEach(source => {
        if (source && source.modificadoresAtributos) {
            for (const [key, value] of Object.entries(source.modificadoresAtributos)) {
                let numValue = 0;
                if (value !== undefined && value !== null && value !== '') {
                    numValue = parseFloat(String(value).replace(',', '.'));
                }
                if (isNaN(numValue)) numValue = 0;
                totais[key] = (totais[key] || 0) + numValue;
            }
        }
    });

    for(let key in totais) totais[key] = Number(totais[key].toFixed(2));
    return totais;
}

export function calculateStatCascade(ficha, field, change) {
    const atributos = ficha.atributosBasePersonagem || {};
    const isHP = field === 'hp';
    const shieldKeyMax = isHP ? 'defesaCorporalNativaTotal' : 'defesaMagicaNativaTotal';
    const extraKeyMax = isHP ? 'pontosHPExtraTotal' : 'pontosMPExtraTotal';
    
    const baseKey = isHP ? 'hpPersonagemBase' : 'mpPersonagemBase';
    const shieldKeyAtual = isHP ? 'hpShieldAtual' : 'mpShieldAtual';
    const extraKeyAtual = isHP ? 'hpExtraAtual' : 'mpExtraAtual';
    const maxBaseKey = isHP ? 'hpMaxPersonagemBase' : 'mpMaxPersonagemBase';

    let maxBase = Number(ficha[maxBaseKey]);
    if (!Number.isFinite(maxBase)) maxBase = 0;
    let maxShield = Number(atributos[shieldKeyMax]);
    if (!Number.isFinite(maxShield)) maxShield = 0;
    let maxExtra = Number(atributos[extraKeyMax]);
    if (!Number.isFinite(maxExtra)) maxExtra = 0;

    const safe = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

    let atualBase = safe(ficha[baseKey], 0);
    let atualShield = ficha[shieldKeyAtual] !== undefined ? safe(ficha[shieldKeyAtual], maxShield) : maxShield;
    let atualExtra = ficha[extraKeyAtual] !== undefined ? safe(ficha[extraKeyAtual], maxExtra) : maxExtra;

    if (change < 0) {
        let damage = Math.abs(change);
        if (damage > 0 && atualShield > 0) {
            if (atualShield >= damage) { atualShield -= damage; damage = 0; }
            else { damage -= atualShield; atualShield = 0; }
        }
        if (damage > 0 && atualExtra > 0) {
            if (atualExtra >= damage) { atualExtra -= damage; damage = 0; }
            else { damage -= atualExtra; atualExtra = 0; }
        }
        // BUG CORRIGIDO: faltava o clamp. O HP podia ficar NEGATIVO e esse
        // total era gravado no token da arena (a barra % ficava 0, mas o
        // número exibido era "-37"). Agora o pool base nunca fica abaixo de 0.
        if (damage > 0) atualBase = Math.max(0, atualBase - damage);
    } 
    else if (change > 0) {
        let heal = change;
        if (heal > 0 && atualBase < maxBase) {
            const space = maxBase - atualBase;
            if (heal <= space) { atualBase += heal; heal = 0; } else { atualBase = maxBase; heal -= space; }
        }
        if (heal > 0 && atualExtra < maxExtra) {
            const space = maxExtra - atualExtra;
            if (heal <= space) { atualExtra += heal; heal = 0; } else { atualExtra = maxExtra; heal -= space; }
        }
        if (heal > 0 && atualShield < maxShield) {
            const space = maxShield - atualShield;
            if (heal <= space) { atualShield += heal; heal = 0; } else { atualShield = maxShield; heal -= space; }
        }
    }

    return {
        updates: {
            [baseKey]: atualBase,
            [shieldKeyAtual]: atualShield,
            [extraKeyAtual]: atualExtra
        },
        total: atualBase + atualShield + atualExtra
    };
}

export function calculateReputationDetails(ficha) {
    let breakdown = {
        level: ficha.levelPersonagemBase || 1,
        profissoes: 0,
        buildings: 0,
        gmBonus: Number(ficha.recursos?.reputacaoBonusGM || 0),
        total: 0
    };

    if (ficha.profissoes) {
        Object.values(ficha.profissoes).forEach(p => {
            breakdown.profissoes += (p.nivel || 0);
        });
    }

    const buildings = ficha.recursos?.estabelecimentos || [];
    buildings.forEach(b => {
        const tpl = globalState.cache.buildings.get(b.templateId);
        if (tpl) breakdown.buildings += (tpl.reputacaoGerada || 0);
    });

    breakdown.total = breakdown.level + breakdown.profissoes + breakdown.buildings + breakdown.gmBonus;
    return breakdown;
}

export function calculateReputationUsage(ficha) {
    let totalCap = (ficha.levelPersonagemBase || 1); 
    if (ficha.profissoes) Object.values(ficha.profissoes).forEach(p => totalCap += (p.nivel || 0));
    totalCap += Number(ficha.recursos?.reputacaoBonusGM || 0);
    totalCap += Number(ficha.recursos?.reputacaoObjetivos || 0);

    let repColecao = 0;
    if (ficha.colecao_jogadores) Object.values(ficha.colecao_jogadores).forEach(v => { if (typeof v === 'object' && v.resgatado) repColecao += 2; });
    if (ficha.colecao_npcs) Object.values(ficha.colecao_npcs).forEach(v => { if (typeof v === 'object' && v.resgatado) repColecao += 5; });
    if (ficha.colecao_cidades) Object.values(ficha.colecao_cidades).forEach(v => { if (typeof v === 'object' && v.resgatado) repColecao += 10; });
    totalCap += repColecao;

    const buildings = ficha.recursos?.estabelecimentos || [];
    buildings.forEach(b => {
        const tpl = globalState.cache.buildings.get(b.templateId);
        if (tpl && tpl.reputacaoGerada > 0) totalCap += tpl.reputacaoGerada;
    });

    let used = 0;
    const allies = ficha.recursos?.aliados || [];
    allies.forEach(a => {
        const tpl = globalState.cache.allies.get(a.templateId);
        if (tpl) used += (tpl.reputacaoCustoBase || 0);
    });

    buildings.forEach(b => {
        const tpl = globalState.cache.buildings.get(b.templateId);
        if (tpl && tpl.reputacaoCusto > 0) used += tpl.reputacaoCusto;
    });

    return { total: totalCap, used: used, available: totalCap - used, colecao: repColecao };
}

/**
 * Resolve o "pool" de HP ou MP de uma ficha, normalizando base / extra / escudo.
 *
 * ANTES essa soma "base + extra + shield" estava duplicada em 6 lugares
 * (arena.js ×4, habilidades.js, main.js) com fallbacks diferentes — logo,
 * o mesmo personagem tinha valores diferentes dependendo da aba aberta.
 *
 * @param {object} ficha
 * @param {'hp'|'mp'} pool
 */
export function resolvePool(ficha, pool = 'hp') {
    const isHP = pool === 'hp';
    const attrs = ficha?.atributosBasePersonagem || {};

    const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

    const maxBase = num(ficha?.[isHP ? 'hpMaxPersonagemBase' : 'mpMaxPersonagemBase'], 0);
    const maxShield = num(attrs[isHP ? 'defesaCorporalNativaTotal' : 'defesaMagicaNativaTotal'], 0);
    const maxExtra = num(attrs[isHP ? 'pontosHPExtraTotal' : 'pontosMPExtraTotal'], 0);

    const base = num(ficha?.[isHP ? 'hpPersonagemBase' : 'mpPersonagemBase'], maxBase);
    const shield = ficha?.[isHP ? 'hpShieldAtual' : 'mpShieldAtual'] !== undefined
        ? num(ficha[isHP ? 'hpShieldAtual' : 'mpShieldAtual'], maxShield)
        : maxShield;
    const extra = ficha?.[isHP ? 'hpExtraAtual' : 'mpExtraAtual'] !== undefined
        ? num(ficha[isHP ? 'hpExtraAtual' : 'mpExtraAtual'], maxExtra)
        : maxExtra;

    const current = Math.max(0, base + shield + extra);
    const max = Math.max(0, maxBase + maxShield + maxExtra);

    return { base, shield, extra, current, max, maxBase, maxShield, maxExtra };
}

/**
 * Converte um total em cobre para a tripla de moedas, sem perder resto.
 * A taxa e 1 ouro = 10 prata = 100 cobre (COINS.val), sem hardcode.
 *
 * Substitui as DUAS copias que existiam (utils.js e reputacao.js).
 */
export function optimizeCoinsGuard(totalCobre) {
    let remaining = Number(totalCobre);
    if (!Number.isFinite(remaining) || remaining <= 0) return { gold: 0, silver: 0, bronze: 0 };

    remaining = Math.floor(remaining);

    const nGold = Math.floor(remaining / COINS.GOLD.val);
    remaining %= COINS.GOLD.val;

    const nSilver = Math.floor(remaining / COINS.SILVER.val);
    remaining %= COINS.SILVER.val;

    return { gold: nGold, silver: nSilver, bronze: remaining };
}

/** Atalho: HP atual e máximo. */
export function getHpPool(ficha) { return resolvePool(ficha, 'hp'); }

/** Atalho: MP atual e máximo. */
export function getMpPool(ficha) { return resolvePool(ficha, 'mp'); }

export function getWallet(ficha) {
    if(!ficha || !ficha.mochila) return { gold:0, silver:0, bronze:0, total:0 };
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const g = num(ficha.mochila[COINS.GOLD.id]);
    const s = num(ficha.mochila[COINS.SILVER.id]);
    const b = num(ficha.mochila[COINS.BRONZE.id]);
    return {
        gold: g, silver: s, bronze: b,
        total: (g * COINS.GOLD.val) + (s * COINS.SILVER.val) + (b * COINS.BRONZE.val)
    };
}