import { db, doc, updateDoc, runTransaction, deleteField, getDoc, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML, getRankWeight } from '../core/utils.js';
import { calculateWeightStats } from '../core/calculos.js';

const IMG_FALLBACK = PLACEHOLDER_IMAGE_URL;

export function renderMochila(isJustFiltering = false) {
    const container = document.getElementById('mochila-content');
    if (!container) return;

    if (!globalState.mochilaUI) {
        globalState.mochilaUI = { abaAtiva: 'todos', ordenacao: 'rank_desc', busca: '' };
    }

    let charData = globalState.selectedCharacterData;
    if (!charData || !charData.ficha) {
        container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
        return;
    }

    // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
    if (!document.getElementById('mochila-layout-wrapper')) {
        container.innerHTML = `
            <div id="mochila-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                
                <div class="flex-1 flex flex-col min-w-0 h-full">
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-briefcase mr-3 text-slate-600"></i> Mochila</h2>
                        <div id="mochila-weight-tracker" class="flex items-center px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-inner transition-colors duration-300">
                            <i class="fas fa-weight-hanging text-slate-500 mr-2"></i>
                            <span class="text-sm font-bold font-mono tracking-widest text-slate-300">
                                <span id="weight-current">0.0</span> / <span id="weight-max">50.0</span> kg
                            </span>
                        </div>
                    </div>

                    <div id="mochila-advanced-controls" class="shrink-0 mb-4"></div>
                    
                    <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                        <div id="inventory-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 xl:grid-cols-15 gap-3 content-start"></div>
                    </div>
                </div>

                <div class="w-80 shrink-0 flex flex-col h-full pt-12">
                    <div id="right-panel-wrapper" class="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-2xl flex flex-col h-full relative overflow-hidden">
                        
                        <div id="mochila-empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                            <i class="fas fa-box-open text-6xl mb-4"></i>
                            <p class="text-sm text-center px-6">Selecione um item na lista ao lado para ver seus detalhes.<br><br>Para usar ou jogar fora, clique nos pequenos botões dentro da foto do item.</p>
                        </div>

                        <div id="item-details-panel" class="flex-1 flex flex-col min-h-0 hidden z-20"></div>
                        
                        <div id="action-panel-container" class="shrink-0 z-20 mt-4 border-t border-slate-700 pt-4 hidden"></div>
                    </div>
                </div>

            </div>
        `;
    }

    const grid = document.getElementById('inventory-grid');
    const controls = document.getElementById('mochila-advanced-controls');
    
    // 2. FILTRAGEM E PREPARAÇÃO DOS ITENS
    let mochilaRaw = charData.ficha.mochila || {};
    let materiaisSet = new Set();
    
    if (globalState.cache.receitas) {
        globalState.cache.receitas.forEach(receita => {
            if (receita.materiais && Array.isArray(receita.materiais)) {
                receita.materiais.forEach(mat => { if (mat.itemId) materiaisSet.add(mat.itemId); });
            }
        });
    }

    let itensArray = [];
    for (let [id, qtd] of Object.entries(mochilaRaw)) {
        if (qtd <= 0) continue;
        let itemInfo = globalState.cache.itens.get(id) || (globalState.cache.allItems ? globalState.cache.allItems.get(id) : null);
        if (!itemInfo) continue;

        let configInfo = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(id) : null;
        let rankReal = itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfo ? configInfo.tierId : null) || "F";
        let tipoStr = (itemInfo.tipoItem || itemInfo.categoria || "").toLowerCase();
        
        let isUsavel = itemInfo.itemUsavel === true;
        let isConsumivel = isUsavel || tipoStr.includes('consumível') || tipoStr.includes('consumivel') || tipoStr.includes('poção') || tipoStr.includes('pocao');
        let isEquip = tipoStr.includes('arma') || tipoStr.includes('armadura') || tipoStr.includes('equipamento') || tipoStr.includes('acessorio') || itemInfo.slot_equipavel_id != null;
        let isMaterial = materiaisSet.has(id) || tipoStr.includes('material') || tipoStr.includes('minério') || tipoStr.includes('ingrediente');
        let isDiversos = tipoStr.includes('diverso') || tipoStr.includes('quest') || tipoStr.includes('outro');

        itensArray.push({
            id, qtd, nome: itemInfo.nome || "Desconhecido", rank: rankReal, img: itemInfo.imagemUrl || IMG_FALLBACK, 
            isEquip, isConsumivel, isMaterial, isDiversos, isUsavel, rawInfo: itemInfo
        });
    }

    let ui = globalState.mochilaUI;
    let filtered = itensArray.filter(item => {
        if (ui.busca && !item.nome.toLowerCase().includes(ui.busca)) return false;
        if (ui.abaAtiva === 'equipamentos' && !item.isEquip) return false;
        if (ui.abaAtiva === 'consumiveis' && !item.isConsumivel) return false;
        if (ui.abaAtiva === 'materiais' && !item.isMaterial) return false;
        if (ui.abaAtiva === 'diversos' && !item.isDiversos) return false;
        return true;
    });

    filtered.sort((a, b) => {
        switch(ui.ordenacao) {
            case 'name_asc': return a.nome.localeCompare(b.nome);
            case 'name_desc': return b.nome.localeCompare(a.nome);
            case 'qtd_desc': return b.qtd - a.qtd;
            case 'qtd_asc': return a.qtd - b.qtd;
            case 'rank_asc': return getRankWeight(a.rank) - getRankWeight(b.rank);
            default: return getRankWeight(b.rank) - getRankWeight(a.rank);
        }
    });

    function getRankColor(r) {
        let c = { 'SS': 'text-amber-400 border-amber-400 bg-black', 'S': 'text-rose-400 border-rose-500 bg-rose-900/30', 'A': 'text-amber-400 border-amber-500 bg-amber-900/30', 'B': 'text-purple-400 border-purple-500 bg-purple-900/30', 'C': 'text-blue-400 border-blue-500 bg-blue-900/30', 'D': 'text-emerald-400 border-emerald-500 bg-emerald-900/30', 'E': 'text-slate-400 border-slate-500 bg-slate-800' };
        return c[r?.toUpperCase()] || 'text-slate-500 border-slate-700 bg-slate-800';
    }

    function getBtnClass(abaName) {
        return ui.abaAtiva === abaName 
            ? 'bg-sky-600 text-white font-bold border-sky-500 shadow-[0_0_10px_rgba(2,132,199,0.5)]' 
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200';
    }

    // 3. RENDERIZAÇÃO DOS CONTROLES
    if (!isJustFiltering || controls.innerHTML === '') {
        controls.innerHTML = `
            <div class="flex flex-col gap-3">
                <div class="flex flex-col xl:flex-row gap-4 items-center bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm">
                    <div class="relative flex-grow w-full">
                        <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                        <input type="text" placeholder="Buscar pelo nome..." class="w-full bg-slate-900 border border-slate-600 rounded py-1.5 pl-9 pr-4 text-sm text-white focus:border-amber-500 outline-none" value="${ui.busca}" onkeyup="window.filtrarBuscaMochila(this.value)">
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest"><i class="fas fa-sort-amount-down"></i> Ordem:</span>
                        <select class="bg-slate-900 border border-slate-600 rounded py-1.5 px-3 text-xs text-slate-200 outline-none focus:border-amber-500" onchange="window.mudarOrdemMochila(this.value)">
                            <option value="rank_desc" ${ui.ordenacao === 'rank_desc' ? 'selected' : ''}>Rank (Maior > Menor)</option>
                            <option value="rank_asc" ${ui.ordenacao === 'rank_asc' ? 'selected' : ''}>Rank (Menor > Maior)</option>
                            <option value="qtd_desc" ${ui.ordenacao === 'qtd_desc' ? 'selected' : ''}>Qtd (Mais > Menos)</option>
                            <option value="qtd_asc" ${ui.ordenacao === 'qtd_asc' ? 'selected' : ''}>Qtd (Menos > Mais)</option>
                            <option value="name_asc" ${ui.ordenacao === 'name_asc' ? 'selected' : ''}>Nome (A-Z)</option>
                            <option value="name_desc" ${ui.ordenacao === 'name_desc' ? 'selected' : ''}>Nome (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div class="flex gap-2 overflow-x-auto hide-scroll pb-1">
                    <button onclick="window.mudarAbaMochila('todos')" class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('todos')}"><i class="fas fa-th-large mr-1"></i> Todos</button>
                    <button onclick="window.mudarAbaMochila('equipamentos')" class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('equipamentos')}"><i class="fas fa-shield-alt mr-1"></i> Equipamentos</button>
                    <button onclick="window.mudarAbaMochila('consumiveis')" class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('consumiveis')}"><i class="fas fa-flask mr-1"></i> Consumíveis</button>
                    <button onclick="window.mudarAbaMochila('materiais')" class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('materiais')}"><i class="fas fa-box-open mr-1"></i> Materiais Base</button>
                    <button onclick="window.mudarAbaMochila('diversos')" class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('diversos')}"><i class="fas fa-star mr-1"></i> Diversos</button>
                </div>
            </div>
        `;
    }

    // 4. RENDERIZAÇÃO DO GRID
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full h-full flex flex-col items-center justify-center text-slate-500 py-16"><i class="fas fa-wind text-5xl mb-3 opacity-30"></i><p class="text-sm">Nenhum item encontrado.</p></div>`;
    } else {
        grid.innerHTML = filtered.map(item => {
            let rankStyle = getRankColor(item.rank);
            const isEquipped = Object.values(charData.ficha.equipamentos || charData.ficha.equipamento || {}).includes(item.id);
            const isEgo = charData.ficha.armaEspiritual && charData.ficha.armaEspiritual.itemBaseId === item.id && charData.ficha.armaEspiritual.ativo;

            let equipClass = 'border-slate-700';
            if (isEgo) equipClass = 'item-rainbow shadow-[0_0_10px_rgba(255,255,255,0.3)]';
            else if (isEquipped) equipClass = 'equipped shadow-[0_0_8px_rgba(16,185,129,0.5)] border-emerald-500';

            const isSelected = globalState.mochila.lastSelectedItem === item.id ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : '';

            return `
                <div class="inventory-slot relative group cursor-pointer hover:-translate-y-1 transition-transform ${isEquipped || isEgo ? 'equipped' : ''}" 
                     data-item-id="${item.id}" data-quantity="${item.qtd}" data-item-name="${item.nome.toLowerCase()}" title="${item.nome}">
                    
                    <div class="w-full aspect-square bg-slate-950 rounded-lg border ${equipClass} ${isSelected} overflow-hidden relative shadow-md group-hover:border-amber-400 pointer-events-none transition-all">
                        
                        <div class="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${rankStyle} z-10 shadow-sm backdrop-blur-sm">${item.rank?.toUpperCase() || 'F'}</div>
                        
                        ${item.isEquip ? '<div class="absolute top-1 right-1 text-[10px] text-sky-400 z-10 drop-shadow-md"><i class="fas fa-tshirt"></i></div>' : ''}
                        ${item.isConsumivel ? '<div class="absolute top-1 right-1 text-[10px] text-pink-400 z-10 drop-shadow-md"><i class="fas fa-flask"></i></div>' : ''}
                        ${item.isDiversos ? '<div class="absolute top-1 right-1 text-[10px] text-slate-300 z-10 drop-shadow-md"><i class="fas fa-star"></i></div>' : ''}
                        ${item.isMaterial && !item.isEquip && !item.isConsumivel && !item.isDiversos ? '<div class="absolute top-1 right-1 text-[10px] text-emerald-500 z-10 drop-shadow-md"><i class="fas fa-leaf"></i></div>' : ''}

                        <img src="${item.img}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                        
                        ${isEquipped && !isEgo ? '<div class="equipped-overlay text-[10px]">EQP</div>' : ''}
                        ${isEgo ? '<div class="equipped-overlay text-[10px]" style="background-color: rgba(0,0,0,0.4);">EGO</div>' : ''}

                        <div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent"></div>
                        <div class="absolute bottom-1 right-1 bg-black/90 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 shadow">x${item.qtd}</div>
                    </div>
                    
                    <div class="slot-actions flex justify-center gap-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/60 p-1.5 rounded backdrop-blur border border-slate-700/50" style="pointer-events: auto;">
                        ${item.isUsavel ? `<button class="btn-action-icon btn-use text-emerald-400 hover:text-emerald-300 hover:scale-110 transition-transform" title="Usar Item"><i class="fas fa-utensils pointer-events-none"></i></button>` : ''}
                        <button class="btn-action-icon btn-share text-sky-400 hover:text-sky-300 hover:scale-110 transition-transform" title="Enviar Item"><i class="fas fa-share pointer-events-none"></i></button>
                        <button class="btn-action-icon btn-delete text-red-500 hover:text-red-400 hover:scale-110 transition-transform" title="Jogar Fora"><i class="fas fa-trash pointer-events-none"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Atualização de Peso Global
    const weightStats = calculateWeightStats(charData.ficha, charData.ficha.levelPersonagemBase || 1);
    const wCurrentEl = document.getElementById('weight-current');
    const wMaxEl = document.getElementById('weight-max');
    const wTracker = document.getElementById('mochila-weight-tracker');

    if (wCurrentEl && wMaxEl && wTracker) {
        wCurrentEl.textContent = weightStats.current.toFixed(1);
        wMaxEl.textContent = weightStats.max.toFixed(1);
        const pct = weightStats.current / weightStats.max;
        wTracker.classList.remove('border-red-500', 'border-amber-500', 'border-slate-700', 'shadow-[0_0_10px_rgba(239,68,68,0.3)]');
        if (pct > 1) { wTracker.classList.add('border-red-500', 'shadow-[0_0_10px_rgba(239,68,68,0.3)]'); wCurrentEl.className = 'text-red-500 animate-pulse font-bold'; } 
        else if (pct >= 0.8) { wTracker.classList.add('border-amber-500'); wCurrentEl.className = 'text-amber-400 font-bold'; } 
        else { wTracker.classList.add('border-slate-700'); wCurrentEl.className = 'text-slate-300'; }
    }
}

function toggleMochilaItemDetails(itemId, forceOpen = false) {
    const detailsPanel = document.getElementById('item-details-panel');
    const emptyState = document.getElementById('mochila-empty-state');
    const actionPanel = document.getElementById('action-panel-container');
    
    if(!detailsPanel || !emptyState) return;

    if (!forceOpen && !detailsPanel.classList.contains('hidden') && globalState.mochila.lastSelectedItem === itemId) {
        detailsPanel.classList.add('hidden');
        emptyState.classList.remove('hidden');
        if(actionPanel) actionPanel.classList.add('hidden');
        globalState.mochila.lastSelectedItem = null;
        renderMochila(true); 
        return;
    }
    
    const item = globalState.cache.itens.get(itemId);
    if (!item) return;

    globalState.mochila.lastSelectedItem = itemId;
    renderMochila(true); 
    
    emptyState.classList.add('hidden');
    if(actionPanel) actionPanel.classList.add('hidden');
    
    detailsPanel.innerHTML = `
        <div id="item-details-content" class="flex flex-col h-full animate-fade-in">
            <div class="w-full h-40 bg-slate-950 rounded-lg border border-slate-700 mb-4 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                <img src="${item.imagemUrl || IMG_FALLBACK}" class="w-full h-full object-contain ${!item.imagemUrl ? 'opacity-30' : ''}">
            </div>
            
            <div class="flex flex-col flex-1 min-h-0">
                <h3 class="font-cinzel text-lg text-amber-400 mb-1 border-b border-slate-700 pb-2 shrink-0 leading-tight">${item.nome || 'Item sem nome'}</h3>
                
                <div class="overflow-y-auto custom-scroll pr-2 flex-1 mt-2 text-[11px] text-slate-300 leading-relaxed">
                    <p class="mb-4 italic opacity-90">${item.descricao?.replace(/\n/g, '<br>') || 'Nenhuma descrição encontrada.'}</p>
                    <div id="details-stats" class="space-y-1.5 font-mono text-slate-400 bg-slate-900/50 p-3 rounded border border-slate-800"></div>
                </div>
            </div>
        </div>
    `;

    const statsContainer = detailsPanel.querySelector('#details-stats');
    let hasStats = false;
    
    ['atk_base', 'def_base', 'eva_base', 'hp_base', 'mp_base', 'iniciativa_base', 'movimento_base', 'ap_base'].forEach(key => {
         if (item[key] && item[key] !== 0) {
            const p = document.createElement('p');
            const statName = key.replace('_base', '').toUpperCase();
            p.innerHTML = `<span class="text-slate-500">${statName}:</span> <span class="text-white font-bold">${item[key] > 0 ? '+' : ''}${item[key]}</span>`;
            statsContainer.appendChild(p);
            hasStats = true;
         }
    });

    Object.keys(item).forEach(key => {
        if (key.startsWith('bonus') && item[key] !== 0) {
            const p = document.createElement('p');
            const statName = key.replace('bonus', '').replace('ItemBase', '').replace(/([A-Z])/g, ' $1').trim().toUpperCase();
            p.innerHTML = `<span class="text-slate-500">${statName}:</span> <span class="text-white font-bold">${item[key] > 0 ? '+' : ''}${item[key]}</span>`;
            statsContainer.appendChild(p);
            hasStats = true;
        }
    });
    
    if (item.efeitos_especiais && Object.keys(item.efeitos_especiais).length > 0) {
        if (hasStats) statsContainer.appendChild(document.createElement('hr'));
        const effectNames = Object.keys(item.efeitos_especiais).map(effectId => {
            const effectData = globalState.cache.efeitos.get(effectId);
            return effectData ? effectData.nome : `ID:${effectId}`;
        }).join(', ');
        
        statsContainer.innerHTML += `<p class="mt-2 text-amber-500/80"><i class="fas fa-bolt mr-1"></i> ${effectNames}</p>`;
        hasStats = true;
    }
    
    if(!hasStats) statsContainer.classList.add('hidden');

    detailsPanel.classList.remove('hidden');
}

function createMochilaActionPanel(itemId, currentQuantity, actionType) {
    const actionContainer = document.getElementById('action-panel-container');
    if(!actionContainer) return;

    const itemDetails = globalState.cache.itens.get(itemId);
    
    let title = '';
    let buttonText = '';
    let btnColor = '';
    const isUse = actionType === 'use';
    const isShare = actionType === 'share';

    const isBackpack = itemDetails.nome.startsWith('Mochila');
    const efeitoVal = itemDetails.efeitoItemUsavel || 0;
    
    if (isShare) {
        title = `Enviar Item`;
        buttonText = 'Transferir';
        btnColor = 'bg-sky-600 hover:bg-sky-500 text-white';
    } else if (actionType === 'delete') {
        title = `Jogar Fora`;
        buttonText = 'Destruir';
        btnColor = 'bg-red-600 hover:bg-red-500 text-white';
    } else if (isUse) {
        title = isBackpack ? `Utilizar Mochila` : `Consumir Item`;
        buttonText = isBackpack ? 'Equipar +Carga' : 'Consumir 1x';
        btnColor = isBackpack ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white';
    }

    actionContainer.innerHTML = `
        <div class="animate-fade-in bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 class="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-3">${title}</h4>
            
            <div class="space-y-3">
                ${!isUse ? `
                    <div>
                        <label class="block text-[9px] text-slate-500 font-bold uppercase mb-1">Quantidade</label>
                        <input type="number" id="action-quantity" value="1" min="1" max="${currentQuantity}" class="w-full bg-slate-950 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:border-amber-500 outline-none font-mono">
                        <p class="text-[8px] text-slate-500 mt-1 text-right">Disponível: ${currentQuantity}</p>
                    </div>
                ` : `
                    <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-center text-slate-300">
                        ${isBackpack ? `<i class="fas fa-weight-hanging text-sky-400 mr-1"></i> Aumenta +${efeitoVal}kg` : `<i class="fas fa-heartbeat text-emerald-400 mr-1"></i> Recupera +${efeitoVal} Fome`}
                    </div>
                `}

                <div class="${isShare ? '' : 'hidden'}" id="target-character-field">
                    <label class="block text-[9px] text-slate-500 font-bold uppercase mb-1">Destinatário</label>
                    <select id="share-character-select" class="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-sky-500 outline-none"></select>
                </div>

                <button id="btn-action-confirm" class="w-full ${btnColor} font-bold uppercase tracking-widest text-[10px] py-2 rounded transition-transform hover:scale-[1.02] shadow-md mt-2">
                    ${buttonText}
                </button>
            </div>
        </div>
    `;
    
    if (isShare) {
        const select = actionContainer.querySelector('#share-character-select');
        const currentCharId = globalState.selectedCharacterId;
        globalState.cache.all_personagens.forEach((char, id) => {
            if (id !== currentCharId) select.add(new Option(`${char.nome} (${char.jogador || '???'})`, id));
        });
        if (select.options.length === 0) {
            select.add(new Option('Nenhum aliado', ''));
            select.disabled = true;
        }
    }

    actionContainer.classList.remove('hidden');

    actionContainer.querySelector('#btn-action-confirm').addEventListener('click', () => {
        if (isUse) {
            confirmUseItem(itemId);
        } else {
            const qty = parseInt(actionContainer.querySelector('#action-quantity').value);
            if (isShare) confirmShareItem(itemId, qty);
            else confirmDeleteItem(itemId, qty);
        }
    });
}

// LOGICAS DE BANCO DE DADOS
async function confirmUseItem(itemId) {
    const charId = globalState.selectedCharacterId;
    const itemDetails = globalState.cache.itens.get(itemId);
    const efeitoVal = Number(itemDetails.efeitoItemUsavel) || 0;
    const isBackpack = itemDetails.nome.startsWith('Mochila');
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const docSnap = await t.get(ref);
            if (!docSnap.exists()) throw "Ficha não encontrada.";
            const data = docSnap.data();
            const mochila = data.mochila || {};
            
            if (!mochila[itemId] || mochila[itemId] < 1) throw "Item não está na mochila.";
            mochila[itemId] -= 1;
            if (mochila[itemId] <= 0) delete mochila[itemId];
            
            if (isBackpack) {
                const currentBonus = Number(data.bonusPesoMochilas || 0);
                const currentUses = Number(data.qtdMochilasUsadas || 0);
                t.update(ref, { mochila: mochila, bonusPesoMochilas: currentBonus + efeitoVal, qtdMochilasUsadas: currentUses + 1 });
            } else {
                const atributos = data.atributosBasePersonagem || {};
                const fomeExtra = Number(atributos.pontosFomeExtraTotal || 0);
                const fomeMax = Math.floor(100 + fomeExtra);
                let fomeAtual = data.fomeAtual !== undefined ? Number(data.fomeAtual) : fomeMax;
                t.update(ref, { mochila: mochila, fomeAtual: Number(Math.min(fomeMax, fomeAtual + efeitoVal).toFixed(1)) });
            }
        });
        
        document.getElementById('action-panel-container')?.classList.add('hidden');
        if (isBackpack) alert(`Equipado! +${efeitoVal}kg permanentemente.`);
        else alert(`Consumido! Recuperou ${efeitoVal} de Fome.`);
        renderMochila(); 
    } catch (e) { alert("Erro ao usar item: " + e); }
}

async function confirmDeleteItem(itemId, quantityToDelete) {
    const charId = globalState.selectedCharacterId;
    const sourceQuantity = parseInt(globalState.selectedCharacterData.ficha.mochila?.[itemId] || 0);

    if (isNaN(quantityToDelete) || quantityToDelete <= 0 || quantityToDelete > sourceQuantity) return alert("Quantidade inválida.");
    
    const newQuantity = sourceQuantity - quantityToDelete;
    const updateData = {};
    updateData[`mochila.${itemId}`] = (newQuantity > 0) ? newQuantity : deleteField();

    try {
        await updateDoc(doc(db, "rpg_fichas", charId), updateData);
        const updatedCharData = (await getDoc(doc(db, "rpg_fichas", charId))).data();
        const updatedCharWithId = { id: charId, ...updatedCharData };
        globalState.cache.personagens.set(charId, updatedCharWithId);
        globalState.cache.all_personagens.set(charId, updatedCharWithId);
        globalState.selectedCharacterData.ficha = updatedCharWithId;
        
        document.getElementById('action-panel-container')?.classList.add('hidden');
        renderMochila();
    } catch(e) { alert("Erro ao deletar item."); }
}

async function confirmShareItem(itemId, quantityToSend) {
    const sourceCharId = globalState.selectedCharacterId;
    const destCharId = document.getElementById('action-panel-container').querySelector('#share-character-select').value;
    const sourceQuantity = parseInt(globalState.selectedCharacterData.ficha.mochila?.[itemId] || 0);

    if (!destCharId || isNaN(quantityToSend) || quantityToSend <= 0 || quantityToSend > sourceQuantity) return alert("Verifique o destinatário e a quantidade.");

    try {
        await runTransaction(db, async (transaction) => {
            const sourceRef = doc(db, "rpg_fichas", sourceCharId);
            const destRef = doc(db, "rpg_fichas", destCharId);
            const sourceDoc = await transaction.get(sourceRef);
            if (!sourceDoc.exists() || (sourceDoc.data().mochila?.[itemId] || 0) < quantityToSend) throw new Error("Quantidade insuficiente!");
            
            const newSourceQuantity = sourceDoc.data().mochila[itemId] - quantityToSend;
            const updateSource = {};
            updateSource[`mochila.${itemId}`] = (newSourceQuantity > 0) ? newSourceQuantity : deleteField();
            
            transaction.update(sourceRef, updateSource);
            transaction.update(destRef, { [`mochila.${itemId}`]: increment(quantityToSend) });
        });

        alert("Enviado com sucesso!");
        const [updatedSource, updatedDest] = await Promise.all([ getDoc(doc(db, "rpg_fichas", sourceCharId)), getDoc(doc(db, "rpg_fichas", destCharId)) ]);
        
        if(updatedSource.exists()) {
            const updatedWithId = { id: sourceCharId, ...updatedSource.data() };
            globalState.cache.personagens.set(sourceCharId, updatedWithId);
            globalState.cache.all_personagens.set(sourceCharId, updatedWithId);
            globalState.selectedCharacterData.ficha = updatedWithId;
        }
        if(updatedDest.exists()) {
            const updatedWithId = {id: destCharId, ...updatedDest.data()};
            globalState.cache.personagens.set(destCharId, updatedWithId);
            globalState.cache.all_personagens.set(destCharId, updatedWithId);
        }
        
        document.getElementById('action-panel-container')?.classList.add('hidden');
        renderMochila();
    } catch (error) { alert("Erro ao enviar o item: " + error.message); }
}

// FUNÇÕES GLOBAIS DE INTERFACE
window.mudarAbaMochila = function(aba) { globalState.mochilaUI.abaAtiva = aba; renderMochila(); };
window.mudarOrdemMochila = function(ordem) { globalState.mochilaUI.ordenacao = ordem; renderMochila(); };
window.filtrarBuscaMochila = function(texto) { globalState.mochilaUI.busca = texto.toLowerCase(); renderMochila(true); };

export function setupMochilaListeners() {
    const contentArea = document.getElementById('mochila-content');
    if (contentArea) {
        contentArea.addEventListener('click', (e) => {
            const slot = e.target.closest('.inventory-slot');
            if (!slot || !globalState.selectedCharacterData) return;
            
            const { itemId, quantity } = slot.dataset;
            
            toggleMochilaItemDetails(itemId, true);
            
            if (e.target.classList.contains('btn-action-icon')) {
                e.stopPropagation();
                const charData = globalState.selectedCharacterData.ficha;
                const equippedItemIds = new Set(Object.values(charData.equipamento || charData.equipamentos || {}));

                if (e.target.classList.contains('btn-use')) {
                    createMochilaActionPanel(itemId, quantity, 'use');
                }
                else if (e.target.classList.contains('btn-delete')) {
                    if (equippedItemIds.has(itemId)) return alert('Desequipe o item antes de destruí-lo.');
                    createMochilaActionPanel(itemId, quantity, 'delete');
                } 
                else if (e.target.classList.contains('btn-share')) {
                     if (equippedItemIds.has(itemId)) return alert('Desequipe o item antes de enviá-lo.');
                    createMochilaActionPanel(itemId, quantity, 'share');
                }
            } else {
                const actionPanel = document.getElementById('action-panel-container');
                if (actionPanel) actionPanel.classList.add('hidden');
            }
        });
    }
}