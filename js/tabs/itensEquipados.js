import { db, doc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

const PAPER_DOLL_CONFIG = {
    left: [
        { id: 'cabeca', label: 'Cabeça', icon: 'fa-helmet-safety' },
        { id: 'ombros', label: 'Ombros', icon: 'fa-user-shield' },
        { id: 'peitoral', label: 'Peitoral', icon: 'fa-shirt' },
        { id: 'cinturao', label: 'Cinturão', icon: 'fa-grip-lines' },
        { id: 'pernas', label: 'Pernas', icon: 'fa-socks' },
        { id: 'botas', label: 'Botas', icon: 'fa-boot' },
        { id: 'colar', label: 'Colar', icon: 'fa-gem' },
        { id: 'brinco', label: 'Brinco', icon: 'fa-lightbulb' } 
    ],
    right: [
        { id: 'arma_primaria', label: 'Arma Prim.', icon: 'fa-gavel' },
        { id: 'arma_secundaria', label: 'Arma Sec.', icon: 'fa-shield-halved' },
        { id: 'arma_2_maos', label: 'Duas Mãos', icon: 'fa-hammer' },
        { id: 'bracadeiras', label: 'Braçadeiras', icon: 'fa-hands-bound' },
        { id: 'pulseira_1', label: 'Pulseira 1', icon: 'fa-ring' },
        { id: 'pulseira_2', label: 'Pulseira 2', icon: 'fa-ring' },
        { id: 'anel_1', label: 'Anel 1', icon: 'fa-circle-notch' },
        { id: 'anel_2', label: 'Anel 2', icon: 'fa-circle-notch' }
    ]
};

export async function renderItensEquipados() {
    try {
        const container = document.getElementById('itens-equipados-content');
        if (!container) return;

        const charId = globalState.selectedCharacterId;
        if (!charId || !globalState.selectedCharacterData || !globalState.selectedCharacterData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        const charData = globalState.selectedCharacterData;
        const ficha = charData.ficha;
        const equipados = ficha.equipamentos || ficha.equipamento || {}; 

        if (!document.getElementById('equip-layout-wrapper')) {
            container.innerHTML = `
                <div id="equip-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                    
                    <div class="flex-1 flex flex-col min-w-0 h-full">
                        <div class="flex justify-between items-center mb-4 shrink-0">
                            <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-tshirt mr-3 text-slate-600"></i> Itens Equipados</h2>
                        </div>
                        
                        <div class="flex-1 flex items-center justify-center bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative overflow-hidden">
                            
                            <div id="paper-doll-bg-layer" class="absolute inset-0 bg-no-repeat bg-contain bg-center opacity-30 z-0 scale-105 pointer-events-none transition-all duration-500" style="filter: blur(2px) grayscale(50%);"></div>
                            <div class="absolute inset-0 bg-slate-900/60 z-0 pointer-events-none"></div>

                            <div class="relative z-10 flex w-full max-w-4xl justify-between px-2 sm:px-8 xl:px-12 gap-8">
                                <div id="doll-grid-left" class="flex flex-col gap-3 shrink-0 items-start"></div>
                                <div class="flex-1"></div>
                                <div id="doll-grid-right" class="flex flex-col gap-3 shrink-0 items-start"></div>
                            </div>
                        </div>
                    </div>

                    <div class="w-80 shrink-0 flex flex-col h-full pt-12 gap-4">
                        
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex flex-col shrink-0">
                            <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3"><i class="fas fa-chart-pie mr-1 text-amber-500"></i> Bônus do Equipamento</h4>
                            <div class="grid grid-cols-3 gap-2 text-center font-mono">
                                <div class="bg-slate-950 border border-slate-700 p-2 rounded shadow-inner flex flex-col justify-center items-center">
                                    <div class="text-[8px] text-slate-500 uppercase mb-0.5">ATK</div>
                                    <div id="doll-total-atk" class="text-amber-400 font-bold text-sm">0</div>
                                </div>
                                <div class="bg-slate-950 border border-slate-700 p-2 rounded shadow-inner flex flex-col justify-center items-center">
                                    <div class="text-[8px] text-slate-500 uppercase mb-0.5">DEF</div>
                                    <div id="doll-total-def" class="text-blue-400 font-bold text-sm">0</div>
                                </div>
                                <div class="bg-slate-950 border border-slate-700 p-2 rounded shadow-inner flex flex-col justify-center items-center">
                                    <div class="text-[8px] text-slate-500 uppercase mb-0.5">EVA</div>
                                    <div id="doll-total-eva" class="text-emerald-400 font-bold text-sm">0</div>
                                </div>
                            </div>
                        </div>

                        <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col flex-1 min-h-0 relative overflow-hidden">
                            
                            <div id="equip-empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                                <i class="fas fa-hand-pointer text-5xl mb-4"></i>
                                <p class="text-sm text-center px-6">Clique em um slot do personagem ao lado para trocar de equipamento.</p>
                            </div>

                            <div id="equip-selector-panel" class="flex-col h-full hidden z-20">
                                <div class="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 shrink-0">
                                    <h4 id="panel-slot-name" class="font-cinzel text-amber-500 font-bold tracking-widest uppercase text-sm">Slot</h4>
                                    <button onclick="window.closeEquipPanel()" class="text-slate-400 hover:text-red-400 transition-colors"><i class="fas fa-times text-lg"></i></button>
                                </div>
                                
                                <div class="p-3 shrink-0 border-b border-slate-700 bg-slate-900/30">
                                    <button id="btn-unequip-current" class="w-full bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2.5 rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all hidden shadow-md">
                                        <i class="fas fa-ban mr-1"></i> Desequipar
                                    </button>
                                </div>

                                <div id="panel-item-list" class="flex-1 overflow-y-auto custom-scroll p-3 space-y-2"></div>
                            </div>

                        </div>
                    </div>

                </div>
            `;
        }

        const bgLayer = document.getElementById('paper-doll-bg-layer');
        if (bgLayer) {
            let bgUrl = "";
            const mainKey = ficha.imagemPrincipal;
            const urls = ficha.imageUrls || {};
            if (mainKey && urls[mainKey]) bgUrl = urls[mainKey];
            else if (ficha.imagemUrl) bgUrl = ficha.imagemUrl;

            if (bgUrl) bgLayer.style.backgroundImage = `url('${bgUrl}')`;
            else bgLayer.style.backgroundImage = "none";
        }

        _renderGrid('doll-grid-left', PAPER_DOLL_CONFIG.left, equipados);
        _renderGrid('doll-grid-right', PAPER_DOLL_CONFIG.right, equipados);
        _updateTotalStats(equipados);

        const activeSlotId = document.getElementById('equip-selector-panel')?.dataset.activeSlot;
        if (activeSlotId && !document.getElementById('equip-selector-panel').classList.contains('hidden')) {
            const slotLabel = document.getElementById('panel-slot-name').textContent.replace('🎯 ', '').trim();
            window.openEquipPanel(activeSlotId, slotLabel);
        }
    } catch (e) {
        console.error("Erro ao renderizar itens equipados:", e);
    }
}

function getRarityBorderClass(rarity) {
    const r = (rarity || '').toLowerCase();
    if (r === 'ss') return 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/50';
    if (r === 's') return 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50';
    if (r === 'a') return 'border-amber-500';
    if (r === 'b') return 'border-purple-500';
    if (r === 'c') return 'border-blue-500';
    if (r === 'd') return 'border-emerald-500';
    return 'border-slate-600';
}

function _renderGrid(containerId, slots, equipados) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    slots.forEach(slot => {
        const itemId = equipados[slot.id];
        let contentHtml = '';
        let borderClass = 'border-slate-700 bg-slate-900/80';
        let imgOpacity = 'opacity-50 grayscale';

        if (itemId) {
            const item = globalState.cache.itens.get(itemId);
            if (item) {
                borderClass = `bg-slate-950 ${getRarityBorderClass(item.raridade || item.tierId || 'E')}`; 
                imgOpacity = 'opacity-100 group-hover:scale-110';
                const itemImg = item.imagemUrl || item.imageUrl || "";

                if (itemImg) {
                    contentHtml = `<img src="${itemImg}" class="w-full h-full object-cover transition-transform duration-300 ${imgOpacity}" title="${item.nome}" onerror="this.style.display='none'">`;
                } else {
                    contentHtml = `<i class="fas fa-box text-slate-400 text-xl drop-shadow-md"></i>`;
                }
            } else {
                contentHtml = `<i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>`;
            }
        } else {
            contentHtml = `<i class="fas ${slot.icon} text-slate-600/50 text-2xl group-hover:text-amber-500/50 transition-colors"></i>`;
        }

        const div = document.createElement('div');
        // Define explicitamente justify-start para garantir que tudo fique alinhado à esquerda no [Caixa] -> [Texto]
        div.className = `flex items-center gap-3 equip-slot group cursor-pointer w-full justify-start`;
        div.dataset.slotId = slot.id;
        div.onclick = () => window.openEquipPanel(slot.id, slot.label);
        
        // Quadradinho com o item na Esquerda
        const boxHTML = `
            <div class="w-14 h-14 md:w-16 md:h-16 rounded-lg border-2 ${borderClass} relative flex items-center justify-center overflow-hidden shadow-md group-hover:border-amber-400 transition-all shrink-0 z-10">
                ${contentHtml}
            </div>
        `;
        
        // Texto na Direita (alinhado a esquerda dele mesmo)
        const textHTML = `
            <div class="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-amber-400 transition-colors hidden sm:block whitespace-nowrap text-left">
                ${slot.label}
            </div>
        `;

        // Agora a ordem é SEMPRE Caixa -> Texto, não importa se é a grade direita ou esquerda
        div.innerHTML = `${boxHTML}${textHTML}`;
        
        container.appendChild(div);
    });
}

function _updateTotalStats(equipados) {
    let atk = 0, def = 0, eva = 0;
    
    Object.values(equipados).forEach(itemId => {
        const item = globalState.cache.itens.get(itemId);
        if (item) {
            atk += Number(item.atk_base || 0);
            def += Number(item.def_base || 0);
            eva += Number(item.eva_base || 0);
        }
    });

    const set = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) {
            el.textContent = val > 0 ? `+${val}` : val; 
            if(val > 0) el.classList.replace('text-slate-500', id.includes('atk') ? 'text-amber-400' : id.includes('def') ? 'text-blue-400' : 'text-emerald-400');
            else el.classList.add('text-slate-500');
        }
    };
    
    set('doll-total-atk', atk); 
    set('doll-total-def', def); 
    set('doll-total-eva', eva);
}

window.closeEquipPanel = function() {
    const panel = document.getElementById('equip-selector-panel');
    const empty = document.getElementById('equip-empty-state');
    if(panel) panel.classList.add('hidden');
    if(empty) empty.classList.remove('hidden');
    
    document.querySelectorAll('.equip-slot > div.w-14, .equip-slot > div.w-16').forEach(el => {
        el.classList.remove('ring-4', 'ring-amber-500/50', 'border-amber-400');
    });
};

window.openEquipPanel = function(slotTargetId, slotLabel) {
    const emptyState = document.getElementById('equip-empty-state');
    const panel = document.getElementById('equip-selector-panel');
    const listContainer = document.getElementById('panel-item-list'); 
    const title = document.getElementById('panel-slot-name');
    const btnUnequip = document.getElementById('btn-unequip-current');

    if (!panel || !listContainer || !emptyState) return;

    document.querySelectorAll('.equip-slot > div.w-14, .equip-slot > div.w-16').forEach(el => el.classList.remove('ring-4', 'ring-amber-500/50', 'border-amber-400'));
    const clickedSlot = document.querySelector(`.equip-slot[data-slot-id="${slotTargetId}"] > div.rounded-lg`);
    if(clickedSlot) clickedSlot.classList.add('ring-4', 'ring-amber-500/50', 'border-amber-400');

    emptyState.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.classList.add('flex');
    panel.dataset.activeSlot = slotTargetId; 
    
    listContainer.innerHTML = ''; 
    title.innerHTML = `<i class="fas fa-crosshairs text-slate-500 mr-2"></i> ${slotLabel}`;

    const charData = globalState.selectedCharacterData;
    const ficha = charData.ficha;
    const mochila = ficha.mochila || {};
    const equipados = ficha.equipamentos || ficha.equipamento || {}; 
    
    const itemAtualId = equipados[slotTargetId];
    if (itemAtualId && btnUnequip) {
        btnUnequip.classList.remove('hidden');
        btnUnequip.onclick = () => window.handleUnequip(slotTargetId, itemAtualId);
    } else if (btnUnequip) {
        btnUnequip.classList.add('hidden');
    }

    let foundCount = 0;

    for (const [itemId, qtd] of Object.entries(mochila)) {
        if (qtd <= 0) continue;
        const item = globalState.cache.itens.get(itemId);
        if (!item) continue;

        const targetClass = item.slot_equipavel_id || item.tipoItem?.toLowerCase() || '';
        let isMatch = false;

        if (targetClass === slotTargetId) isMatch = true;
        else if (targetClass.includes('anel') && slotTargetId.includes('anel')) isMatch = true;
        else if (targetClass.includes('pulseira') && slotTargetId.includes('pulseira')) isMatch = true;
        else if (targetClass.includes('brinco') && slotTargetId.includes('brinco')) isMatch = true;
        else if ((targetClass.includes('arma') || targetClass.includes('espada') || targetClass.includes('machado')) && (slotTargetId === 'arma_primaria' || slotTargetId === 'arma_secundaria' || slotTargetId === 'arma_2_maos')) {
            isMatch = true; 
        }

        if (isMatch) {
            foundCount++;
            
            const itemImg = item.imagemUrl || item.imageUrl || "";
            const borderRarity = getRarityBorderClass(item.raridade || item.tierId || 'E');

            let statsHtml = [];
            if(item.atk_base) statsHtml.push(`<span class="text-amber-400">ATK +${item.atk_base}</span>`);
            if(item.def_base) statsHtml.push(`<span class="text-blue-400">DEF +${item.def_base}</span>`);
            if(item.eva_base) statsHtml.push(`<span class="text-emerald-400">EVA +${item.eva_base}</span>`);

            const card = document.createElement('div');
            card.className = "bg-slate-900 border border-slate-700 rounded-lg p-2 flex gap-3 cursor-pointer group hover:bg-slate-800 hover:border-amber-500 transition-all";
            card.onclick = () => window.handleEquip(slotTargetId, itemId);

            card.innerHTML = `
                <div class="w-12 h-12 bg-slate-950 rounded border ${borderRarity} flex items-center justify-center shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform">
                    ${itemImg ? `<img src="${itemImg}" class="w-full h-full object-cover">` : `<i class="fas fa-box text-slate-600"></i>`}
                    <div class="absolute bottom-0 right-0 bg-black/80 text-white text-[8px] px-1 rounded-tl font-mono">x${qtd}</div>
                </div>
                <div class="flex flex-col justify-center min-w-0 flex-1">
                    <div class="text-[10px] font-bold text-slate-300 truncate w-full uppercase group-hover:text-amber-400 transition-colors">${item.nome}</div>
                    <div class="text-[9px] font-mono font-bold mt-1 space-x-2">${statsHtml.join(' | ') || '<span class="text-slate-500 italic">Sem Status</span>'}</div>
                </div>
                <div class="flex items-center shrink-0 pr-1">
                    <i class="fas fa-arrow-right text-slate-600 group-hover:text-amber-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"></i>
                </div>
            `;
            listContainer.appendChild(card);
        }
    }

    if (foundCount === 0) {
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-slate-500 py-12">
                <i class="fas fa-box-open text-4xl mb-3 opacity-30"></i>
                <p class="text-[10px] uppercase font-bold tracking-widest text-slate-400">Mochila Vazia</p>
                <p class="text-[9px] mt-1 text-center italic max-w-[200px]">Nenhum item encontrado que encaixe neste slot.</p>
            </div>
        `;
    }
};

window.handleEquip = async function(slotId, itemId) {
    const charId = globalState.selectedCharacterId;
    window.closeEquipPanel();
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            
            const moch = d.mochila || {};
            const equip = d.equipamentos || d.equipamento || {}; 

            if (equip[slotId]) {
                const oldItem = equip[slotId];
                moch[oldItem] = (moch[oldItem] || 0) + 1;
            }

            if (slotId === 'arma_2_maos') {
                ['arma_primaria', 'arma_secundaria'].forEach(conflict => {
                    if (equip[conflict]) {
                        const itemRemovido = equip[conflict];
                        moch[itemRemovido] = (moch[itemRemovido] || 0) + 1;
                        delete equip[conflict];
                    }
                });
            }
            if (slotId === 'arma_primaria' || slotId === 'arma_secundaria') {
                if (equip['arma_2_maos']) {
                    const twoHandItem = equip['arma_2_maos'];
                    moch[twoHandItem] = (moch[twoHandItem] || 0) + 1;
                    delete equip['arma_2_maos'];
                }
            }

            if (moch[itemId] > 1) moch[itemId]--; else delete moch[itemId];
            equip[slotId] = itemId;

            t.update(ref, { "mochila": moch, "equipamentos": equip });
        });
        
        await renderItensEquipados();

    } catch (e) { alert("Erro ao equipar: " + e.message); }
};

window.handleUnequip = async function(slotId, itemId) {
    const charId = globalState.selectedCharacterId;
    window.closeEquipPanel();
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            
            const moch = d.mochila || {};
            const equip = d.equipamentos || d.equipamento || {}; 

            moch[itemId] = (moch[itemId] || 0) + 1;
            delete equip[slotId];

            t.update(ref, { "mochila": moch, "equipamentos": equip });
        });

        await renderItensEquipados();

    } catch (e) { alert("Erro ao desequipar: " + e.message); }
};

export function renderSlotsEquipamento() {
    const grid = document.querySelector('.equipamento-grid');
    if(!grid) return;
    grid.innerHTML = '';
}