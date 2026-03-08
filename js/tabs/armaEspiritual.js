import { db, doc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML, getRankWeight } from '../core/utils.js';

// Estado Local Temporário da Aba
let spiritState = {
    selectedSoulStone: null,
    selectedWeapon: null,
    selectedTemplate: null,
    skillIndex: 0
};

export function renderArmaEspiritualTab() {
    const container = document.getElementById('arma-espiritual-content'); 
    if(!container) return;

    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }

    const ficha = charData.ficha;
    const temArmaEspiritual = ficha.armaEspiritual && ficha.armaEspiritual.ativo;

    if (temArmaEspiritual) {
        renderSpiritManagement(container, ficha);
    } else {
        renderSpiritCreation(container, ficha);
    }
}

window.changeEgoSkillPage = function(direction) {
    const ficha = globalState.selectedCharacterData?.ficha;
    if (!ficha || !ficha.armaEspiritual) return;

    const ego = ficha.armaEspiritual;
    const template = globalState.cache.armasEspirituais.get(ego.templateId) || {};
    
    const rawList = template.habilidadesConhecidas || ego.habilidadesConhecidas || [];
    const unlockedSkills = rawList.filter(id => {
        const skill = globalState.cache.habilidadesEspirito.get(id);
        if (!skill) return false;
        return ego.level >= (skill.levelRequerido || 1);
    });

    if (unlockedSkills.length === 0) return;

    let newIndex = spiritState.skillIndex + direction;
    
    // Loop infinito
    if (newIndex < 0) newIndex = unlockedSkills.length - 1;
    if (newIndex >= unlockedSkills.length) newIndex = 0;

    spiritState.skillIndex = newIndex;
    renderArmaEspiritualTab();
};

function renderSpiritCreation(container, ficha) {
    const soulStoneIds = [
        "GvAFzVmUKwDJJtHPPRrS", "CPRvLmt2OgHOLWegHiEW", "aAwdrhG1N7ZMT6gDkINZ", 
        "WE7SAZEV018Y4Hx0N9kN", "67eToKtLrnMfnqsjpGUX", "s60XyUNdxrkyzg1zCCkH"
    ];

    const isTransfer = ficha.armaEspiritual && !ficha.armaEspiritual.ativo && ficha.armaEspiritual.level > 1;
    const titleText = isTransfer ? "RITUAL DE TRANSFERÊNCIA DE ESPÍRITO" : "RITUAL DE FUSÃO ESPIRITUAL";

    container.innerHTML = `
        <div class="max-w-5xl mx-auto text-center">
            <h2 class="text-3xl font-cinzel text-amber-400 mb-2">${titleText}</h2>
            <p class="text-slate-400 text-sm mb-8">Selecione uma Pedra da Alma e uma Arma para hospedar o espírito.</p>

            <div class="flex justify-center gap-10 mb-8">
                <div class="flex flex-col items-center gap-2">
                    <span class="text-pink-400 font-bold text-sm">PEDRA DA ALMA</span>
                    <div id="slot-soul" class="w-24 h-24 bg-slate-800 border-2 border-dashed border-pink-500/50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700 transition relative overflow-hidden">
                        <span class="text-pink-500/30 text-4xl">+</span>
                    </div>
                    <span id="label-soul" class="text-xs text-slate-500">Nenhuma</span>
                </div>
                <div class="text-4xl text-slate-600 flex items-center">➔</div>
                <div class="flex flex-col items-center gap-2">
                    <span class="text-amber-400 font-bold text-sm">EQUIPAMENTO</span>
                    <div id="slot-weapon" class="w-24 h-24 bg-slate-800 border-2 border-dashed border-amber-500/50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700 transition relative overflow-hidden">
                        <span class="text-amber-500/30 text-4xl">+</span>
                    </div>
                    <span id="label-weapon" class="text-xs text-slate-500">Nenhum</span>
                </div>
            </div>

            <div class="bg-slate-800/50 p-6 rounded-lg border border-slate-700 mb-8 text-left">
                <div class="form-field mb-6">
                    <label>Nome do Espírito</label>
                    <input type="text" id="spirit-name-input" placeholder="Ex: Ignis, a Chama Eterna" class="text-center font-cinzel text-xl text-amber-400 bg-slate-900 border-slate-600 w-full py-2 px-4 rounded outline-none focus:border-amber-500">
                </div>
                <label class="mb-2 block text-slate-400 text-sm font-bold uppercase">Selecione o Modelo do Espírito</label>
                <div class="spirit-template-scroll custom-scroll flex gap-4 overflow-x-auto pb-4" id="template-list"></div>
            </div>

            <button id="btn-fuse-spirit" class="btn btn-primary px-10 py-4 text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto" disabled>
                <i class="fas fa-link mr-2"></i> ${isTransfer ? 'TRANSFERIR ESPÍRITO' : 'REALIZAR FUSÃO'}
            </button>
            <p class="text-xs text-red-400 mt-2 opacity-70">* Esta ação consumirá a Pedra da Alma.</p>

            <div id="selection-area" class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 hidden text-left">
                <div class="bg-slate-900 p-4 rounded border border-pink-900/30">
                    <h4 class="text-pink-400 font-bold mb-2 uppercase text-xs">Mochila: Pedras da Alma</h4>
                    <div id="grid-souls" class="grid-container" style="min-height:100px;"></div>
                </div>
                <div class="bg-slate-900 p-4 rounded border border-amber-900/30">
                    <h4 class="text-amber-400 font-bold mb-2 uppercase text-xs">Mochila: Equipamentos</h4>
                    <div id="grid-weapons" class="grid-container" style="min-height:100px;"></div>
                </div>
            </div>
        </div>
    `;

    const gridSouls = document.getElementById('grid-souls');
    const gridWeapons = document.getElementById('grid-weapons');
    const selectionArea = document.getElementById('selection-area');
    const mochila = ficha.mochila || {};
    let hasSoul = false; 
    let hasWeapon = false;

    Object.keys(mochila).forEach(itemId => {
        const itemInfo = globalState.cache.itens.get(itemId);
        if(!itemInfo) return;

        if (soulStoneIds.includes(itemId)) {
            hasSoul = true;
            createSelectableSlot(gridSouls, itemInfo, itemId, 'soul');
        }
        
        if (itemInfo.slot_equipavel_id || itemInfo.tipo === 'Equipamento') {
            if (isTransfer && ficha.armaEspiritual.itemBaseId === itemId) return;
            hasWeapon = true;
            createSelectableSlot(gridWeapons, itemInfo, itemId, 'weapon');
        }
    });

    if(hasSoul || hasWeapon) selectionArea.classList.remove('hidden');

    const templateList = document.getElementById('template-list');
    globalState.cache.armasEspirituais.forEach(tpl => {
        const card = document.createElement('div');
        card.className = 'spirit-template-card';
        card.innerHTML = `
            <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-16 h-16 mx-auto mb-2 rounded bg-black object-cover border border-slate-600">
            <div class="font-bold text-sm text-amber-500">${tpl.nome}</div>
            <div class="text-[10px] text-slate-400 uppercase">${tpl.classe}</div>
        `;
        card.onclick = () => {
            document.querySelectorAll('.spirit-template-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            spiritState.selectedTemplate = tpl;
            checkFusionReady();
        };
        templateList.appendChild(card);
    });

    document.getElementById('btn-fuse-spirit').onclick = () => performFusion(ficha, isTransfer);
}

function createSelectableSlot(container, item, id, type) {
    const div = document.createElement('div');
    div.className = 'grid-slot inventory-slot';
    div.style.backgroundImage = `url('${item.imagemUrl}')`;
    div.title = item.nome;
    div.onclick = () => {
        const colorClass = type === 'soul' ? 'outline-pink' : 'outline-gold';
        container.querySelectorAll('.grid-slot').forEach(e => e.classList.remove(colorClass));
        div.classList.add(colorClass);

        if(type === 'soul') {
            spiritState.selectedSoulStone = id;
            document.getElementById('slot-soul').innerHTML = `<img src="${item.imagemUrl}" class="w-full h-full object-cover">`;
            document.getElementById('label-soul').textContent = item.nome;
        } else {
            spiritState.selectedWeapon = id;
            document.getElementById('slot-weapon').innerHTML = `<img src="${item.imagemUrl}" class="w-full h-full object-cover">`;
            document.getElementById('label-weapon').textContent = item.nome;
        }
        checkFusionReady();
    };
    container.appendChild(div);
}

function checkFusionReady() {
    const btn = document.getElementById('btn-fuse-spirit');
    if(spiritState.selectedSoulStone && spiritState.selectedWeapon && spiritState.selectedTemplate) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

async function performFusion(ficha, isTransfer) {
    const name = document.getElementById('spirit-name-input').value.trim();
    if(!name) return alert("Dê um nome ao seu Espírito.");
    if(!confirm("Continuar com a fusão?")) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", ficha.id);
            const sf = await t.get(ref);
            if (!sf.exists()) throw "Ficha não existe";
            const d = sf.data();
            const mochila = d.mochila || {};
            
            // Consome Pedra da Alma
            const soulId = spiritState.selectedSoulStone;
            if(!mochila[soulId] || mochila[soulId] < 1) throw "Pedra da Alma sumiu.";
            if (mochila[soulId] === 1) delete mochila[soulId]; else mochila[soulId]--;

            // Consome Catalisador se for transferência
            if (isTransfer) {
                const catId = 'eaiiaHGkTJRSYsF9N37F';
                if(!mochila[catId] || mochila[catId] < 1) throw "Falta o Catalisador.";
                if (mochila[catId] === 1) delete mochila[catId]; else mochila[catId]--;
            }

            const template = spiritState.selectedTemplate;
            const baseStats = isTransfer ? (d.armaEspiritual || {}) : { level: 1, experienciaAtual: 0, dataCriacao: Date.now() };

            const novaArma = {
                ativo: true,
                nome: name,
                templateId: template.id,
                itemBaseId: spiritState.selectedWeapon,
                danoBase: template.danoBase, 
                danoEspecial: template.danoEspecial,
                taxaXpJogador: template.taxaXpJogador,
                level: baseStats.level || 1,
                experienciaAtual: baseStats.experienciaAtual || 0,
                imagemUrl: template.imagemUrl
            };

            t.update(ref, { mochila: mochila, armaEspiritual: novaArma });
        });
        alert("Fusão realizada!");
        spiritState = { selectedSoulStone: null, selectedWeapon: null, selectedTemplate: null };
    } catch (e) { console.error(e); alert("Erro: " + e); }
}

function renderSpiritManagement(container, ficha) {
    const ego = ficha.armaEspiritual;
    const template = globalState.cache.armasEspirituais.get(ego.templateId) || {};
    
    // Cálculos de XP
    const xpTable = globalState.cache.tabelaXpEspirito?.niveis || {};
    const xpNext = xpTable[ego.level + 1] || (ego.level * 100 * 1.5);
    const xpPrev = xpTable[ego.level] || 0;
    const xpRelative = ego.experienciaAtual - xpPrev;
    const xpNeeded = xpNext - xpPrev;
    const xpPercent = Math.min(100, Math.max(0, (xpRelative / xpNeeded) * 100));

    const CATALISADOR_ID = 'eaiiaHGkTJRSYsF9N37F';
    const temCatalisador = (ficha.mochila?.[CATALISADOR_ID] || 0) > 0;

    const hostItem = globalState.cache.itens.get(ego.itemBaseId);
    const hostHtml = hostItem ? `
        <div class="flex items-center gap-3 bg-slate-950/60 p-2 rounded border border-slate-700 mb-4">
            <img src="${hostItem.imagemUrl}" class="w-10 h-10 rounded bg-black border border-slate-600 object-cover">
            <div class="flex-grow overflow-hidden">
                <p class="text-[10px] text-slate-500 uppercase font-bold">Hospedeiro Atual</p>
                <p class="text-xs text-slate-300 truncate">${escapeHTML(hostItem.nome)}</p>
            </div>
        </div>
    ` : '';

    const rawSkillIds = template.habilidadesConhecidas || ego.habilidadesConhecidas || [];
    const unlockedSkills = rawSkillIds.filter(id => {
        const skill = globalState.cache.habilidadesEspirito.get(id);
        if (!skill) return false;
        return ego.level >= (skill.levelRequerido || 1);
    });

    let skillHtml = '';

    if (unlockedSkills.length === 0) {
        skillHtml = `<div class="text-center text-slate-500 text-xs py-4 italic border border-dashed border-slate-700 rounded bg-slate-900/30">Nenhuma habilidade despertada neste nível.</div>`;
    } else {
        if (spiritState.skillIndex >= unlockedSkills.length) spiritState.skillIndex = 0;
        
        const skillId = unlockedSkills[spiritState.skillIndex];
        const skillData = globalState.cache.habilidadesEspirito.get(skillId);
        
        skillHtml = `
            <div class="relative bg-slate-800 border border-slate-600 rounded-lg p-3 min-h-[140px] flex flex-col justify-between group shadow-lg transition-all duration-300">
                ${unlockedSkills.length > 1 ? `
                <div class="absolute top-1/2 -left-3 -translate-y-1/2 z-10">
                    <button onclick="window.changeEgoSkillPage(-1)" class="w-6 h-6 rounded-full bg-slate-700 border border-slate-500 text-slate-300 hover:bg-slate-600 hover:text-white flex items-center justify-center shadow-lg transition"><i class="fas fa-chevron-left text-[10px]"></i></button>
                </div>
                <div class="absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                    <button onclick="window.changeEgoSkillPage(1)" class="w-6 h-6 rounded-full bg-slate-700 border border-slate-500 text-slate-300 hover:bg-slate-600 hover:text-white flex items-center justify-center shadow-lg transition"><i class="fas fa-chevron-right text-[10px]"></i></button>
                </div>
                ` : ''}

                <div>
                    <div class="flex justify-between items-start mb-2 border-b border-slate-700 pb-2">
                        <div class="flex flex-col">
                            <h4 class="text-amber-400 font-bold text-sm leading-tight">${escapeHTML(skillData.nome)}</h4>
                            <span class="text-[9px] text-slate-500">Nível Req: ${skillData.levelRequerido}</span>
                        </div>
                        <span class="text-[9px] bg-slate-950 px-2 py-0.5 rounded text-sky-400 border border-slate-700 font-mono">Cost: ${skillData.custoEgo || 0}</span>
                    </div>
                    
                    <div class="relative">
                        <p id="ego-skill-desc-text" class="text-xs text-slate-300 leading-relaxed mb-1 line-clamp-3 transition-all duration-300">
                            ${escapeHTML(skillData.descricao)}
                        </p>
                        <button onclick="window.toggleEgoDesc(this)" class="text-[10px] text-amber-500 hover:text-amber-300 font-bold cursor-pointer focus:outline-none flex items-center mt-1">
                            <i class="fas fa-chevron-down mr-1"></i> Ler mais
                        </button>
                    </div>
                </div>
                
                ${skillData.efeito ? `<div class="mt-3 text-[10px] text-emerald-400 font-mono bg-black/30 p-2 rounded border border-emerald-900/30"><i class="fas fa-code mr-1"></i>${escapeHTML(skillData.efeito)}</div>` : ''}
                
                <div class="flex justify-center items-center gap-1.5 mt-3">
                    ${unlockedSkills.map((_, i) => `
                        <div class="w-1.5 h-1.5 rounded-full transition-colors ${i === spiritState.skillIndex ? 'bg-amber-500 shadow-[0_0_5px_orange]' : 'bg-slate-700'}"></div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div class="lg:col-span-5 bg-slate-900/80 p-6 rounded-xl border border-amber-500/30 relative overflow-hidden flex flex-col">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-purple-500 to-blue-500"></div>
                
                <div class="flex flex-col items-center mb-4 mt-2">
                    <div class="w-32 h-32 rounded-full border-4 border-amber-500/30 overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-2 bg-black">
                         <img src="${ego.imagemUrl || template.imagemUrl}" class="w-full h-full object-cover">
                    </div>
                    <h2 class="text-2xl font-cinzel text-amber-400 text-center leading-none">${escapeHTML(ego.nome)}</h2>
                    <span class="text-slate-400 text-[10px] uppercase tracking-widest mt-1">${escapeHTML(template.classe || 'Arma Espiritual')} • Nível <span class="text-white font-bold text-sm">${ego.level}</span></span>
                </div>

                <div class="mb-4 group relative">
                    <div class="flex justify-between text-[10px] text-slate-400 mb-1 uppercase font-bold">
                        <span>Experiência</span>
                        <span>${Math.floor(xpRelative)} / ${Math.floor(xpNeeded)}</span>
                    </div>
                    <div class="w-full h-2 bg-slate-950 rounded-full border border-slate-700 overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-700" style="width: ${xpPercent}%"></div>
                    </div>
                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">Total: ${ego.experienciaAtual}</div>
                </div>

                <div class="grid grid-cols-2 gap-2 mb-4">
                    <div class="bg-slate-800 p-2 rounded border border-slate-700 text-center">
                        <div class="text-[9px] text-slate-500 uppercase font-bold">Dano Base</div>
                        <div class="text-lg font-bold text-white">+${ego.danoBase}</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded border border-slate-700 text-center">
                        <div class="text-[9px] text-slate-500 uppercase font-bold">Dano Skill</div>
                        <div class="text-lg font-bold text-amber-400">+${ego.danoEspecial}</div>
                    </div>
                </div>

                <div class="mb-4">
                    ${hostHtml}
                    <div class="mt-2">
                        <p class="text-[10px] text-slate-500 uppercase font-bold mb-1 ml-1">Habilidades Despertadas</p>
                        ${skillHtml}
                    </div>
                </div>

                <div class="border-t border-slate-700 pt-3 mt-auto">
                    ${temCatalisador ? 
                        `<button onclick="window.breakSpiritBond('${ficha.id}', true)" class="btn w-full bg-amber-900/20 border border-amber-800 text-amber-500 hover:bg-amber-900/40 py-2 text-[10px] mb-2 transition">
                            <i class="fas fa-exchange-alt mr-2"></i> Transferir (Usa Catalisador)
                        </button>` : ''
                    }
                    <button onclick="window.breakSpiritBond('${ficha.id}', false)" class="btn w-full bg-red-900/10 border border-red-900 text-red-600 hover:bg-red-900/30 py-2 text-[10px] transition">
                        <i class="fas fa-skull mr-2"></i> Destruir Vínculo (Perde Tudo)
                    </button>
                </div>
            </div>

            <div class="lg:col-span-7 bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col h-full max-h-[700px]">
                <h3 class="text-xl font-cinzel text-slate-200 mb-4 border-b border-slate-700 pb-2 shrink-0">Alimentar Espírito</h3>
                
                <div class="flex-1 min-h-0 overflow-y-auto pr-2 custom-scroll mb-4">
                    <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 content-start" id="feeding-bag"></div>
                </div>

                <div id="feeding-zone" class="border-2 border-dashed border-slate-700 rounded-lg h-32 shrink-0 flex items-center justify-center text-slate-600 relative transition-all">
                    <span class="pointer-events-none uppercase text-xs font-bold tracking-wider">Selecione um item acima</span>
                </div>
            </div>
        </div>
    `;

    window.renderFeedingBag(ficha, template, ego);
}

window.toggleEgoDesc = function(btn) {
    const desc = document.getElementById('ego-skill-desc-text');
    if (!desc) return;
    
    const isCollapsed = desc.classList.contains('line-clamp-3');
    
    if (isCollapsed) {
        desc.classList.remove('line-clamp-3'); 
        btn.innerHTML = '<i class="fas fa-chevron-up mr-1"></i> Ler menos';
    } else {
        desc.classList.add('line-clamp-3'); 
        btn.innerHTML = '<i class="fas fa-chevron-down mr-1"></i> Ler mais';
    }
};

window.renderFeedingBag = function(ficha, template, ego) {
    const container = document.getElementById('feeding-bag');
    const feedZone = document.getElementById('feeding-zone');
    if(!container || !feedZone) return;
    
    container.innerHTML = '';
    const mochila = ficha.mochila || {};
    const diet = template.itensConsumiveis || [];

    const rankXpMap = { 'SS': 0.50, 'S': 0.20, 'A': 0.10, 'B': 0.05, 'C': 0.04, 'D': 0.03, 'E': 0.02, 'F': 0.01 };

    Object.keys(mochila).forEach(itemId => {
        if(itemId === ego.itemBaseId) return;

        let itemInfo = globalState.cache.allItems.get(itemId) || globalState.cache.itens.get(itemId);
        if(!itemInfo) return;

        let xpValue = 0;
        const dietEntry = diet.find(d => d.itemId === itemId);
        
        if (dietEntry && dietEntry.xp > 0) {
            xpValue = dietEntry.xp; 
        } else {
            let configInfo = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(itemId) : null;
            let rankReal = (itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfo ? configInfo.tierId : null) || "F").toUpperCase();
            xpValue = rankXpMap[rankReal] || 1; 
        }

        if (xpValue <= 0) return;

        let configInfoVis = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(itemId) : null;
        let displayRank = (itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfoVis ? configInfoVis.tierId : null) || "F").toUpperCase();

        let c = { 'SS': 'text-amber-400 border-amber-400 bg-black', 'S': 'text-rose-400 border-rose-500 bg-rose-900/30', 'A': 'text-amber-400 border-amber-500 bg-amber-900/30', 'B': 'text-purple-400 border-purple-500 bg-purple-900/30', 'C': 'text-blue-400 border-blue-500 bg-blue-900/30', 'D': 'text-emerald-400 border-emerald-500 bg-emerald-900/30', 'E': 'text-slate-400 border-slate-500 bg-slate-800' };
        let rankStyle = c[displayRank] || 'text-slate-500 border-slate-700 bg-slate-800';
        const maxQty = mochila[itemId];

        const slot = document.createElement('div');
        slot.className = 'grid-slot inventory-slot relative group cursor-pointer hover:-translate-y-1 transition-transform border border-slate-600 hover:border-amber-400';
        slot.style.backgroundImage = `url('${itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}')`;
        slot.title = `${itemInfo.nome} (+${xpValue} XP cada)`;
        
        slot.innerHTML = `
            <div class="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border ${rankStyle} z-10 shadow-sm backdrop-blur-sm">
                ${displayRank}
            </div>
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-green-400 transition-opacity rounded-lg pointer-events-none">
                +${xpValue} XP
            </div>
            <span class="grid-slot-quantity">${maxQty}</span>
        `;
        
        slot.onclick = () => {
            let currentQty = 1;
            
            feedZone.innerHTML = `
                <div class="flex flex-col items-center gap-2 animate-fade-in w-full">
                    <div class="flex items-center gap-3 justify-center w-full">
                        
                        <img src="${itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-14 h-14 rounded border border-slate-500 object-cover shadow-lg shrink-0">
                        
                        <div class="flex flex-col gap-1 text-left">
                            <div class="overflow-hidden">
                                <p class="text-white font-bold text-sm truncate w-48" title="${itemInfo.nome}">${itemInfo.nome}</p>
                                <p class="text-green-400 font-bold text-xs" id="feed-xp-display">+${xpValue} XP <span class="text-slate-500 font-normal text-[10px]">(Rank ${displayRank})</span></p>
                            </div>
                            
                            <div class="qty-control w-48 bg-slate-900 border-slate-600">
                                <div class="qty-btn hover:bg-slate-700" id="feed-qty-minus">-</div>
                                <input type="number" class="qty-input focus:text-amber-400" id="feed-qty-input" value="1" min="1" max="${maxQty}">
                                <div class="qty-btn hover:bg-slate-700" id="feed-qty-plus">+</div>
                                <button id="feed-qty-max" class="text-[10px] text-amber-500 hover:text-amber-400 font-bold ml-1 mr-2 uppercase transition shrink-0">Max</button>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2 mt-1 w-full max-w-[200px]">
                        <button id="btn-cancel-feed" class="btn btn-secondary px-2 py-1 text-[10px] uppercase font-bold flex-1">Cancelar</button>
                        <button id="btn-confirm-feed" class="btn btn-green px-2 py-1 text-[10px] shadow-lg uppercase tracking-wider font-bold flex-1">Alimentar</button>
                    </div>
                </div>
            `;

            const xpDisplay = document.getElementById('feed-xp-display');
            const inputEl = document.getElementById('feed-qty-input');
            const btnConfirm = document.getElementById('btn-confirm-feed');

            const updateUI = () => {
                xpDisplay.innerHTML = `+${xpValue * currentQty} XP <span class="text-slate-500 font-normal text-[10px]">(Rank ${displayRank})</span>`;
                inputEl.value = currentQty;
            };

            const setQty = (val) => {
                let num = parseInt(val);
                if(isNaN(num)) num = 1;
                currentQty = Math.max(1, Math.min(maxQty, num));
                updateUI();
            };

            document.getElementById('feed-qty-minus').onclick = () => setQty(currentQty - 1);
            document.getElementById('feed-qty-plus').onclick = () => setQty(currentQty + 1);
            document.getElementById('feed-qty-max').onclick = () => setQty(maxQty);
            inputEl.onchange = (e) => setQty(e.target.value);
            
            document.getElementById('btn-cancel-feed').onclick = () => {
                window.renderFeedingBag(ficha, template, ego);
            };

            btnConfirm.onclick = () => {
                const img = feedZone.querySelector('img');
                img.classList.add('feeding-anim');
                setTimeout(() => window.processFeedingEgo(ficha.id, itemId, xpValue, currentQty), 600);
            };
        };
        container.appendChild(slot);
    });

    if (container.innerHTML === '') {
        container.innerHTML = '<div class="col-span-full h-full flex flex-col items-center justify-center text-slate-500 py-10 opacity-50"><i class="fas fa-box-open text-4xl mb-3"></i><p>Sua mochila está vazia.</p></div>';
    }
};

window.processFeedingEgo = async function(charId, itemId, xpAmountPerItem, quantity = 1) {
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const mochila = d.mochila || {};
            
            if(!mochila[itemId] || mochila[itemId] < quantity) throw "Itens insuficientes na mochila.";
            
            mochila[itemId] -= quantity;
            if(mochila[itemId] <= 0) delete mochila[itemId];

            const ego = d.armaEspiritual;
            let totalXpGained = xpAmountPerItem * quantity; 
            let currentXp = (ego.experienciaAtual || 0) + totalXpGained;
            let currentLevel = ego.level;
            
            const xpTable = globalState.cache.tabelaXpEspirito?.niveis || {};
            let loops = 0;
            while (loops < 100) {
                const reqNext = xpTable[currentLevel + 1];
                if (reqNext && currentXp >= reqNext) {
                    currentLevel++;
                } else {
                    break;
                }
                loops++;
            }

            if (currentLevel > ego.level) {
                 const levelsGained = currentLevel - ego.level;
                 ego.danoBase += levelsGained; 
                 ego.danoEspecial += Math.floor(levelsGained / 2); 
            }
            ego.level = currentLevel;
            ego.experienciaAtual = currentXp;

            t.update(ref, { mochila: mochila, armaEspiritual: ego });
        });
    } catch(e) { 
        console.error(e);
        alert("Erro ao alimentar: " + e);
    }
};

window.breakSpiritBond = async function(charId, isTransfer) {
    if (!isTransfer && !confirm("ATENÇÃO: DESTRUIR O VÍNCULO REMOVERÁ A ARMA ESPIRITUAL PARA SEMPRE. Confirmar?")) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const mochila = d.mochila || {};

            if (isTransfer) {
                const CATALISADOR_ID = 'eaiiaHGkTJRSYsF9N37F';
                if(!mochila[CATALISADOR_ID]) throw "Falta Catalisador.";
                if(mochila[CATALISADOR_ID] === 1) delete mochila[CATALISADOR_ID]; else mochila[CATALISADOR_ID]--;

                d.armaEspiritual.ativo = false;
                d.armaEspiritual.itemBaseId = null;
                t.update(ref, { mochila: mochila, armaEspiritual: d.armaEspiritual });
            } else {
                t.update(ref, { armaEspiritual: deleteField() });
            }
        });
        alert(isTransfer ? "Espírito transferido para o limbo." : "Vínculo destruído.");
    } catch(e) { alert("Erro: " + e); }
};