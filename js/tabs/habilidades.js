import { db, doc, updateDoc, runTransaction, writeBatch, getDoc } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { getFomeDebuffMultiplier, calculateStatCascade } from '../core/calculos.js';

let skillTabState = 'learned'; // 'learned' ou 'possible'

export function renderMinhasHabilidades() {
    const container = document.getElementById('minhas-habilidades-content');
    if (!container) return;

    let charData = globalState.selectedCharacterData;
    if (!charData || !charData.ficha) {
        container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
        return;
    }

    const ap = charData.ficha.apPersonagemBase || 0;

    // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
    if (!document.getElementById('skill-layout-wrapper')) {
        container.innerHTML = `
            <div id="skill-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                
                <div class="flex-1 flex flex-col min-w-0 h-full">
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-fire mr-3 text-slate-600"></i> Habilidades</h2>
                        <div class="flex items-center px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-inner">
                            <i class="fas fa-star text-rose-500 mr-2"></i>
                            <span class="text-sm font-bold font-mono tracking-widest text-slate-300">
                                AP: <span id="skill-ap-display" class="text-rose-400">${ap}</span>
                            </span>
                        </div>
                    </div>

                    <div class="flex flex-col xl:flex-row gap-4 items-center bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm shrink-0 mb-4">
                        <div class="flex gap-2 w-full xl:w-auto shrink-0">
                            <button id="btn-tab-learned" onclick="window.switchSkillTab('learned')" class="flex-1 xl:flex-none px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap bg-rose-600 text-white font-bold border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"><i class="fas fa-book mr-1"></i> Aprendidas</button>
                            <button id="btn-tab-possible" onclick="window.switchSkillTab('possible')" class="flex-1 xl:flex-none px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"><i class="fas fa-unlock-alt mr-1"></i> Disponíveis</button>
                        </div>
                        <div class="relative flex-grow w-full">
                            <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                            <input type="text" placeholder="Buscar habilidade..." class="w-full bg-slate-900 border border-slate-600 rounded py-1.5 pl-9 pr-4 text-sm text-white focus:border-rose-500 outline-none" onkeyup="window.filterSkills(this.value)">
                        </div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                        <div id="grid-learned" class="grid grid-cols-4 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-15 gap-3 content-start"></div>
                        <div id="grid-possible" class="grid grid-cols-4 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-15 gap-3 content-start hidden"></div>
                    </div>
                </div>

                <div class="w-80 shrink-0 flex flex-col h-full pt-12 gap-4">
                    
                    <div id="right-skill-panel" class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex flex-col relative overflow-hidden min-h-[320px] shrink-0 transition-all">
                        
                        <div id="skill-empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                            <i class="fas fa-magic text-5xl mb-4"></i>
                            <p class="text-sm text-center px-6">Selecione uma habilidade para inspecionar e rolar dados.</p>
                        </div>

                        <div id="skill-details-panel" class="flex-1 flex flex-col min-h-0 hidden z-20 overflow-y-auto custom-scroll pr-1"></div>
                    </div>

                    <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex flex-col flex-1 min-h-0">
                        <div class="flex justify-between items-center mb-2 border-b border-slate-700 pb-2 shrink-0">
                            <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold"><i class="fas fa-history mr-1 text-rose-500"></i> Histórico de Ações</h4>
                            <button id="admin-skill-log-actions" onclick="window.clearSkillLogs()" class="text-red-500 hover:text-red-400 text-[10px] uppercase font-bold transition-colors hidden"><i class="fas fa-trash"></i> Limpar</button>
                        </div>
                        <div id="skill-log-list" class="flex-1 overflow-y-auto custom-scroll pr-1 space-y-1 content-start"></div>
                    </div>

                </div>

            </div>
        `;
    } else {
        // Atualiza AP
        const apDisplay = document.getElementById('skill-ap-display');
        if (apDisplay) apDisplay.textContent = ap;
    }

    // Carrega o conteúdo
    window.switchSkillTab(skillTabState);
    window.renderSkillUsageLogs(); 
}

window.switchSkillTab = function(tab) {
    skillTabState = tab;
    const learnedGrid = document.getElementById('grid-learned');
    const possibleGrid = document.getElementById('grid-possible');
    const btnLearned = document.getElementById('btn-tab-learned');
    const btnPossible = document.getElementById('btn-tab-possible');

    if(!btnLearned || !learnedGrid) return;

    const activeClass = ['bg-rose-600', 'text-white', 'font-bold', 'border-rose-500', 'shadow-[0_0_10px_rgba(244,63,94,0.4)]'];
    const inactiveClass = ['bg-slate-900', 'text-slate-400', 'border-slate-700', 'hover:bg-slate-700', 'hover:text-slate-200'];

    if (tab === 'learned') {
        btnLearned.classList.remove(...inactiveClass); btnLearned.classList.add(...activeClass);
        btnPossible.classList.remove(...activeClass); btnPossible.classList.add(...inactiveClass);
        learnedGrid.classList.remove('hidden');
        possibleGrid.classList.add('hidden');
        renderLearnedList();
    } else {
        btnPossible.classList.remove(...inactiveClass); btnPossible.classList.add(...activeClass);
        btnLearned.classList.remove(...activeClass); btnLearned.classList.add(...inactiveClass);
        possibleGrid.classList.remove('hidden');
        learnedGrid.classList.add('hidden');
        renderPossibleList();
    }
};

function renderLearnedList() {
    const grid = document.getElementById('grid-learned');
    const charData = globalState.selectedCharacterData;
    if (!charData) return;

    const mySkills = charData.ficha.habilidades || {};
    const ids = Object.keys(mySkills);
    
    grid.innerHTML = '';
    if (ids.length === 0) {
        grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-16"><i class="fas fa-book-dead text-4xl mb-3 opacity-30"></i><p class="text-sm">Nenhuma habilidade aprendida.</p></div>';
        return;
    }

    ids.sort((a,b) => {
        const nA = globalState.cache.habilidades.get(a)?.nome || '';
        const nB = globalState.cache.habilidades.get(b)?.nome || '';
        return nA.localeCompare(nB);
    });

    ids.forEach(id => {
        const master = globalState.cache.habilidades.get(id);
        if (!master) return;
        const userSkill = mySkills[id];
        const isFav = userSkill.isFavorite === true;
        grid.appendChild(createSkillSlotHTML(id, master, userSkill.nivel, true, isFav));
    });
}

function renderPossibleList() {
    const grid = document.getElementById('grid-possible');
    const charData = globalState.selectedCharacterData;
    if (!charData) return;

    const mySkills = charData.ficha.habilidades || {};
    const myClass = charData.ficha.classeId;
    const mySubclass = charData.ficha.subclasseId;

    grid.innerHTML = '';
    const possible = [];

    globalState.cache.habilidades.forEach((skill, id) => {
        if (mySkills[id]) return;
        let allowed = true;
        
        if (skill.restricaoClasses && Array.isArray(skill.restricaoClasses) && skill.restricaoClasses.length > 0) {
            if (!skill.restricaoClasses.includes(myClass)) allowed = false;
        }
        
        if (skill.restricaoSubclasses && Array.isArray(skill.restricaoSubclasses) && skill.restricaoSubclasses.length > 0) {
            if (skill.restricaoSubclasses.includes(mySubclass)) allowed = true;
            else if (!allowed) allowed = false;
        }

        if (allowed) possible.push({ id, ...skill });
    });

    if (possible.length === 0) {
        grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-16"><i class="fas fa-lock text-4xl mb-3 opacity-30"></i><p class="text-sm">Nenhuma habilidade disponível.</p></div>';
        return;
    }

    possible.sort((a,b) => a.nome.localeCompare(b.nome));

    possible.forEach(skill => {
        grid.appendChild(createSkillSlotHTML(skill.id, skill, 0, false));
    });
}

function createSkillSlotHTML(id, master, level, isLearned, isFavorite = false) {
    const div = document.createElement('div');
    const imgUrl = master.imagemUrl || PLACEHOLDER_IMAGE_URL;
    const favIcon = isFavorite ? 'fas fa-star text-amber-400' : 'far fa-star text-slate-400';
    const borderClass = isLearned ? 'border-slate-600' : 'border-slate-800 opacity-60 grayscale';

    // Adicionado flex-col e items-center para alinhar a imagem e o texto embaixo perfeitamente
    div.className = `relative group cursor-pointer hover:-translate-y-1 transition-transform skill-slot select-none flex flex-col items-center`;
    div.dataset.name = (master.nome || '').toLowerCase();
    div.title = master.nome;
    
    div.onclick = (e) => {
        if(e.target.closest('.skill-fav-btn')) return;
        window.openSkillDetails(id, isLearned);
    };

    div.innerHTML = `
        <div class="w-full aspect-square bg-slate-950 rounded-full border-2 ${borderClass} overflow-hidden relative shadow-md group-hover:border-rose-400 pointer-events-none transition-all">
            <img src="${imgUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
        </div>
        
        <div class="mt-2 text-center w-full">
            <div class="text-[9px] font-bold text-white uppercase tracking-wider truncate px-1">${master.nome}</div>
            ${isLearned ? `<div class="text-[9px] text-rose-400 font-mono font-bold">Nvl ${level}</div>` : `<div class="text-[8px] text-slate-500 font-mono uppercase">Bloqueada</div>`}
        </div>
        
        ${isLearned ? `
            <button class="skill-fav-btn absolute top-0 right-0 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center z-10 hover:scale-110 transition-transform shadow" onclick="window.toggleSkillFavorite(event, '${id}')">
                <i class="${favIcon} text-[10px]"></i>
            </button>
        ` : ''}
    `;
    return div;
}

window.toggleSkillFavorite = async function(e, skillId) {
    e.stopPropagation(); 
    const charId = globalState.selectedCharacterId;
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    
    const isFav = icon.classList.contains('fas');
    const newState = !isFav; 

    if (newState) {
        icon.className = 'fas fa-star text-amber-400 text-[10px]';
    } else {
        icon.className = 'far fa-star text-slate-400 text-[10px]';
    }

    if (globalState.selectedCharacterData && globalState.selectedCharacterData.ficha.habilidades[skillId]) {
        globalState.selectedCharacterData.ficha.habilidades[skillId].isFavorite = newState;
    }

    try {
        await updateDoc(doc(db, "rpg_fichas", charId), {
            [`habilidades.${skillId}.isFavorite`]: newState
        });
    } catch(err) {
        console.error("Erro ao favoritar habilidade:", err);
    }
};

window.filterSkills = function(term) {
    term = term.toLowerCase();
    const activeGrid = skillTabState === 'learned' ? document.getElementById('grid-learned') : document.getElementById('grid-possible');
    const slots = activeGrid.querySelectorAll('.skill-slot');
    slots.forEach(s => {
        s.style.display = s.dataset.name.includes(term) ? '' : 'none';
    });
};

window.openSkillDetails = function(skillId, isLearned) {
    const panel = document.getElementById('skill-details-panel');
    const emptyState = document.getElementById('skill-empty-state');
    const master = globalState.cache.habilidades.get(skillId);
    
    const charData = globalState.selectedCharacterData.ficha;
    const ap = charData.apPersonagemBase || 0;
    const mpAtual = charData.mpPersonagemBase !== undefined ? charData.mpPersonagemBase : (charData.mpMaxPersonagemBase || 0);
    const mpMax = charData.mpMaxPersonagemBase || 0;

    if(!master || !panel) return;

    // Efeito de seleção no Grid
    document.querySelectorAll('.skill-slot > div').forEach(s => s.classList.remove('ring-2', 'ring-rose-500', 'shadow-[0_0_15px_rgba(244,63,94,0.4)]'));
    const clickedSlot = document.querySelector(`.skill-slot[onclick*="${skillId}"] > div`);
    if(clickedSlot) clickedSlot.classList.add('ring-2', 'ring-rose-500', 'shadow-[0_0_15px_rgba(244,63,94,0.4)]');

    emptyState.classList.add('hidden');

    let displayLevel = 1;
    let damageVal = master.efeitoDanoBaseUsoHabilidade || 0;
    let mpCost = master.gastoMpUso || 0; 
    let nextLevelHtml = '';
    let actionHtml = '';

    if (isLearned) {
        displayLevel = charData.habilidades[skillId].nivel;
        if (master.niveis && master.niveis[displayLevel]?.danoBaseHabilidade !== undefined) {
            damageVal = master.niveis[displayLevel].danoBaseHabilidade;
        }

        const nextLevel = displayLevel + 1;
        const nextLevelData = master.niveis ? master.niveis[nextLevel] : null;
        if (nextLevelData) {
            const nextDamage = nextLevelData.danoBaseHabilidade || 0;
            nextLevelHtml = `
                <div class="mt-3 p-2 bg-amber-900/10 border border-amber-500/20 rounded-lg">
                    <div class="text-[9px] text-amber-500 uppercase font-bold mb-1">Preview Próximo Nível (Nvl ${nextLevel})</div>
                    <div class="grid grid-cols-2 gap-2 text-[10px]">
                        <div><strong class="text-slate-500">Dano/Efeito:</strong> <span class="text-emerald-400 font-bold">${nextDamage}</span></div>
                        <div><strong class="text-slate-500">Custo MP:</strong> <span class="text-blue-400 font-bold">${mpCost}</span></div>
                    </div>
                </div>`;
        }

        const costAP = (displayLevel + 1) + 5;
        const canUpgrade = ap >= costAP;

        actionHtml = `
            <div class="mt-4 space-y-2">
                <button onclick="window.executeSkillUsage('${skillId}', ${damageVal}, ${mpCost})" class="w-full btn bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-3 shadow-lg flex justify-between items-center transition-transform active:scale-95 rounded-lg border border-rose-400/50">
                    <span class="text-xs uppercase tracking-widest"><i class="fas fa-dice-d20 mr-2"></i> Usar Magia</span>
                    <span class="text-[10px] bg-black/40 px-2 py-1 rounded border border-rose-900">MP: ${Math.floor(mpAtual)} / ${mpMax}</span>
                </button>
                
                <button onclick="window.processSkillAction('upgrade', '${skillId}', ${costAP})" class="w-full btn ${canUpgrade ? 'bg-slate-700 hover:bg-slate-600 text-amber-400' : 'bg-slate-800 text-slate-600 cursor-not-allowed'} py-2 px-4 shadow text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-600 transition-colors">
                    <i class="fas fa-arrow-up mr-1"></i> Evoluir para Nvl ${displayLevel+1} (${costAP} AP)
                </button>
            </div>
            <div id="skill-roll-result" class="hidden mt-3 p-3 bg-slate-900 border border-sky-500/30 rounded-lg text-center shadow-inner"></div>`;
    } else {
        const costToLearn = master.custoAprendizado || 10; 
        const canLearn = ap >= costToLearn;

        actionHtml = `
            <div class="mt-4 p-4 bg-slate-900 rounded-lg border border-emerald-500/30 flex flex-col items-center animate-fade-in text-center shadow-inner">
                <div class="text-[10px] text-emerald-500 uppercase font-bold tracking-widest mb-1">Custo de Aprendizado</div>
                <div class="text-white font-bold text-xl mb-3">${costToLearn} AP</div>
                
                <button onclick="window.processSkillAction('buy', '${skillId}', ${costToLearn})" class="w-full btn ${canLearn ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} px-4 py-3 shadow-lg font-bold uppercase tracking-wider transition-transform active:scale-95 rounded-lg">
                    <i class="fas fa-book-open mr-2"></i> Aprender Magia
                </button>
            </div>`;
    }

    const influencia = Array.isArray(master.atributoInfluenciaHabilidade) ? master.atributoInfluenciaHabilidade.join(', ') : (master.atributoInfluenciaHabilidade || '-');

    panel.innerHTML = `
        <div class="animate-fade-in flex flex-col h-full">
            
            <div class="flex gap-4 items-start mb-3 shrink-0 border-b border-slate-700 pb-3">
                <img src="${master.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-16 h-16 rounded-full border-2 border-slate-600 bg-black object-cover shrink-0 shadow-md">
                <div class="flex-grow min-w-0">
                    <h3 class="font-cinzel text-lg text-amber-400 m-0 leading-tight truncate">${master.nome}</h3>
                    <span class="inline-block mt-1 text-[9px] bg-slate-900 text-rose-400 px-2 py-0.5 rounded border border-rose-900/50 font-bold uppercase tracking-widest">
                        ${isLearned ? 'NÍVEL ' + displayLevel : 'DISPONÍVEL'}
                    </span>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto custom-scroll pr-2 text-xs text-slate-300 leading-relaxed">
                <p class="mb-4 italic opacity-90 border-l-2 border-slate-600 pl-3">${master.descricaoEfeito || 'Nenhuma descrição fornecida.'}</p>
                
                <div class="grid grid-cols-2 gap-y-2 gap-x-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700 font-mono text-[10px]">
                    <div><strong class="text-slate-500 block mb-0.5">Influência</strong> <span class="text-amber-400">${influencia}</span></div>
                    <div><strong class="text-slate-500 block mb-0.5">Ação</strong> <span class="text-slate-300">${master.tipoAcaoHabildiade || '-'}</span></div>
                    <div><strong class="text-slate-500 block mb-0.5">Custo MP</strong> <span class="text-blue-400 font-bold">${mpCost}</span></div>
                    <div><strong class="text-slate-500 block mb-0.5">Dano Base</strong> <span class="text-red-400 font-bold">${damageVal}</span></div>
                </div>
                
                ${nextLevelHtml}
            </div>

            <div class="shrink-0 pt-2">
                ${actionHtml}
            </div>
        </div>`;
        
    panel.classList.remove('hidden');
};

window.renderSkillUsageLogs = function() {
    const container = document.getElementById('skill-log-list');
    const adminArea = document.getElementById('admin-skill-log-actions');
    if (!container) return;

    if (adminArea) {
        if (globalState.isAdmin) adminArea.classList.remove('hidden');
        else adminArea.classList.add('hidden');
    }

    const logs = globalState.selectedCharacterData?.ficha?.log_habilidades || [];
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="flex flex-col items-center justify-center text-slate-600 h-full"><i class="fas fa-wind text-2xl mb-2 opacity-50"></i><p class="text-[10px] italic">Sem rolagens.</p></div>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const statIcon = log.statName === 'DEF' ? '🛡️' : (log.statName === 'EVA' ? '🏃' : '⚔️');
        const hungerWarn = log.isDebuffed ? `<span class="text-red-500 ml-1" title="Debuff de Fome Ativo!"><i class="fas fa-drumstick-bite"></i></span>` : '';
        
        return `
        <div class="bg-slate-900 border-l-2 border-rose-500 p-2 rounded flex justify-between items-center animate-fade-in shadow-sm">
            <div class="overflow-hidden min-w-0 pr-2">
                <div class="text-[10px] font-bold text-slate-200 uppercase truncate">${log.skillNome}</div>
                <div class="text-[8px] text-slate-500 font-mono mt-0.5">${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</div>
            </div>
            <div class="text-right shrink-0">
                <div class="text-[8px] text-slate-400 font-mono tracking-tighter">🎲${log.d20} + 💥${log.damageBase} + ${statIcon}${log.atkTotal}${hungerWarn}</div>
                <div class="text-xs font-cinzel font-bold text-amber-500 leading-none mt-1">Total: ${log.total}</div>
            </div>
        </div>
        `;
    }).join('');
};

window.clearSkillLogs = async function() {
    if(!confirm("Deseja limpar o histórico de uso?")) return;
    const charId = globalState.selectedCharacterId;
    try {
        await updateDoc(doc(db, "rpg_fichas", charId), { log_habilidades: [] });
    } catch(e) { console.error(e); }
};

window.executeSkillUsage = async function(skillId, damageBase, mpCost) {
    const resultArea = document.getElementById('skill-roll-result');
    const charId = globalState.selectedCharacterId;
    
    const charFullData = globalState.cache.all_personagens.get(charId); 
    if (!charId || !charFullData) return;
    const charData = charFullData.ficha || charFullData;

    const attrs = charData.atributosBasePersonagem || {};
    const mpShieldMax = Number(attrs.defesaMagicaNativaTotal) || 0;
    const mpExtraMax = Number(attrs.pontosMPExtraTotal) || 0;
    const mpBaseMax = Number(charData.mpMaxPersonagemBase) || 1;

    const mpShield = charData.mpShieldAtual !== undefined ? Number(charData.mpShieldAtual) : mpShieldMax;
    const mpExtra = charData.mpExtraAtual !== undefined ? Number(charData.mpExtraAtual) : mpExtraMax;
    const mpBase = charData.mpPersonagemBase !== undefined ? Number(charData.mpPersonagemBase) : mpBaseMax;
    
    const totalMP = Math.max(0, mpBase + mpExtra + mpShield);
    const safeCost = Number(mpCost) || 0;

    if (totalMP < safeCost) {
        if(resultArea) {
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = `<div class="text-red-500 font-bold uppercase text-xs"><i class="fas fa-times-circle mr-1"></i> MP Insuficiente! (${totalMP})</div>`;
        } else {
            alert(`MP Insuficiente!\nVocê tem: ${totalMP}\nCusto: ${safeCost}`);
        }
        return;
    }

    try {
        const cascade = calculateStatCascade(charData, 'mp', -Math.abs(safeCost));
        let newMpValue = cascade.total;
        Object.assign(charData, cascade.updates);

        const masterSkill = globalState.cache.habilidades.get(skillId);
        const skillName = masterSkill ? masterSkill.nome : "Habilidade";
        
        let statName = "ATK";
        let rawStatVal = charData.atkPersonagemBase || 0;

        if (masterSkill && masterSkill.atributoInfluenciaHabilidade) {
            const inf = Array.isArray(masterSkill.atributoInfluenciaHabilidade) ? masterSkill.atributoInfluenciaHabilidade[0] : masterSkill.atributoInfluenciaHabilidade;
            if (inf && inf.includes('Defesa')) { statName = "DEF"; rawStatVal = charData.defPersonagemBase || 0; } 
            else if (inf && inf.includes('Evasao')) { statName = "EVA"; rawStatVal = charData.evaPersonagemBase || 0; }
        }

        let debuffFome = 1;
        if (charData) debuffFome = getFomeDebuffMultiplier(charData);
        
        const statTotal = Math.floor(rawStatVal * debuffFome);
        const isDebuffed = debuffFome < 1;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const finalPower = d20 + damageBase + statTotal;

        const novoLog = { skillNome: skillName, d20: d20, damageBase: damageBase, atkTotal: statTotal, statName: statName, isDebuffed: isDebuffed, total: finalPower, timestamp: Date.now() };

        const logsAntigos = charData.log_habilidades || [];
        const novosLogs = [novoLog, ...logsAntigos].slice(0, 50);

        await runTransaction(db, async (transaction) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await transaction.get(charRef);
            if (!sf.exists()) throw "Ficha não encontrada.";
            transaction.update(charRef, { ...cascade.updates, log_habilidades: novosLogs });
        });

        // Arena Token sync
        const sessionId = globalState.activeSessionId;
        if (sessionId && sessionId !== 'world') {
            const sessionRef = doc(db, "rpg_sessions", sessionId);
            const sessionSnap = await getDoc(sessionRef); 
            if (sessionSnap.exists()) {
                const sData = sessionSnap.data();
                const tokens = sData.arena_state?.tokens || {};
                const batch = writeBatch(db);
                let tokenFound = false;

                Object.entries(tokens).forEach(([tid, token]) => {
                    if (token.originId === charId && token.originCollection === 'rpg_fichas') {
                        batch.update(sessionRef, { [`arena_state.tokens.${tid}.mp`]: newMpValue });
                        tokenFound = true;
                    }
                });
                if (tokenFound) await batch.commit();
            }
        }

        if(resultArea) {
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-pulse text-sky-400 font-bold text-[10px] uppercase tracking-widest"><i class="fas fa-check-circle mr-1"></i> Habilidade Lançada!</div>
                </div>`;
        }

        // Atualiza a interface
        renderMinhasHabilidades();

    } catch (e) {
        console.error(e);
        alert(typeof e === 'string' ? e : "Erro desconhecido");
    }
};

window.processSkillAction = async function(action, skillId, cost) {
    const charId = globalState.selectedCharacterId;
    const verb = action === 'upgrade' ? 'evoluir' : 'aprender';
    
    if(!confirm(`Deseja gastar ${cost} AP para ${verb} esta habilidade?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            if (!sf.exists()) throw "Ficha não encontrada.";
            
            const data = sf.data();
            const ap = data.apPersonagemBase || 0;
            const skills = data.habilidades || {};

            if (ap < cost) throw "AP insuficiente no servidor.";

            const newAP = ap - cost;
            
            if (action === 'upgrade') {
                if (!skills[skillId]) throw "Você não tem esta habilidade.";
                skills[skillId].nivel = (skills[skillId].nivel || 1) + 1;
            } else if (action === 'buy') {
                if (skills[skillId]) throw "Você já tem esta habilidade.";
                skills[skillId] = { nivel: 1, status: "Ativo", dataAquisicao: Date.now() };
            }

            t.update(ref, { apPersonagemBase: newAP, habilidades: skills });
        });

        alert("Sucesso!");
        if (action === 'buy') skillTabState = 'learned';
        renderMinhasHabilidades();
        
    } catch (e) {
        console.error(e);
        alert("Erro: " + e);
    }
};