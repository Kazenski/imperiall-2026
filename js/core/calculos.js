// ARQUIVO: js/core/calculos.js
import { globalState, COINS } from './state.js';

export function createBonusObject() { 
    return { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 }; 
}

export function calculateLevelFromXP(xp = 0) {
    const t = globalState.cache.tabela_xp;
    if(!t?.niveis) return 1;
    return Object.keys(t.niveis).map(Number).sort((a,b)=>b-a).find(l => xp >= (t.niveis[l]?.experienciaParaProximoNivel||0)) || 1;
}

export function sumXpTableBonuses(lvl) {
    const t = globalState.cache.tabela_xp?.niveis[lvl] || {};
    return { hp: t.bonusHpLevelBase||0, mp: t.bonusMpLevelBase||0, iniciativa: t.bonusIniciativaLevelBase||0, ap: t.bonusApLevelBase||0 };
}

export function getFomeDebuffMultiplier(ficha) {
    if (!ficha) return 1;
    const atributos = ficha.atributosBasePersonagem || {};
    const fomeExtra = Number(atributos.pontosFomeExtraTotal) || 0;
    const fomeMax = Math.floor(100 + fomeExtra);
    const fomeAtual = ficha.fomeAtual !== undefined ? Number(ficha.fomeAtual) : fomeMax;
    
    if (fomeAtual >= 50) return 1; 
    return Math.max(0, fomeAtual) / 100; 
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

    let maxBase = Number(ficha[maxBaseKey]) || 1;
    let maxShield = Number(atributos[shieldKeyMax]) || 0;
    let maxExtra = Number(atributos[extraKeyMax]) || 0;

    let atualBase = Number(ficha[baseKey]) || 0;
    let atualShield = ficha[shieldKeyAtual] !== undefined ? Number(ficha[shieldKeyAtual]) : maxShield;
    let atualExtra = ficha[extraKeyAtual] !== undefined ? Number(ficha[extraKeyAtual]) : maxExtra;

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
        if (damage > 0) atualBase -= damage;
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

export function getWallet(ficha) {
    if(!ficha || !ficha.mochila) return { gold:0, silver:0, bronze:0, total:0 };
    const g = Number(ficha.mochila[COINS.GOLD.id] || 0);
    const s = Number(ficha.mochila[COINS.SILVER.id] || 0);
    const b = Number(ficha.mochila[COINS.BRONZE.id] || 0);
    return { gold: g, silver: s, bronze: b, total: (g * 100) + (s * 10) + (b * 1) };
}