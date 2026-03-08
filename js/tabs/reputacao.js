import { db, doc, onSnapshot, updateDoc, runTransaction, increment, deleteField, writeBatch, getDoc } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL, COINS } from '../core/state.js';

const ID_PREDIO_ARMAZENAMENTO = '0fwxHnGjLBuNw2kTxGSs';

// Função local de otimização de moedas (resolve o erro de import do calculos.js)
function optimizeCoins(totalCopper) {
    let remaining = totalCopper;
    const nGold = Math.floor(remaining / COINS.GOLD.val);
    remaining %= COINS.GOLD.val;
    const nSilver = Math.floor(remaining / COINS.SILVER.val);
    remaining %= COINS.SILVER.val;
    const nBronze = remaining;
    return { gold: nGold, silver: nSilver, bronze: nBronze };
}

// Instancia variáveis globais da interface de Armazém caso não existam
if (!globalState.transferCart) globalState.transferCart = { toStorage: {}, toMochila: {} };
if (!globalState.storageFilter) globalState.storageFilter = 'todos';

window.listenToStorage = function(charId) {
    if (globalState.storageUnsubscribe) {
        globalState.storageUnsubscribe();
        globalState.storageUnsubscribe = null;
    }
    if (!charId) return;

    // Escuta em tempo real as mudanças no armazém deste personagem
    globalState.storageUnsubscribe = onSnapshot(doc(db, "rpg_armazenamentos", charId), (docSnap) => {
        if (docSnap.exists()) {
            globalState.currentStorage = docSnap.data().itens || {};
        } else {
            globalState.currentStorage = {};
        }
        
        // Atualiza a tela se a aba de armazenamento estiver visível
        if (globalState.recursosUI && globalState.recursosUI.abaAtiva === 'armazenamento') {
            if (typeof window.renderStorageTab === 'function') {
                const dynContainer = document.getElementById('rep-dynamic-content');
                if(dynContainer) window.renderStorageTab(dynContainer);
            }
        }
    });
};

// NOME CORRIGIDO DE ACORDO COM O main.js
export function renderReputacaoTab() {
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

    const charData = globalState.selectedCharacterData;
    if(!charData || !charData.ficha) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }

    if (!globalState.storageUnsubscribe) window.listenToStorage(charData.id || globalState.selectedCharacterId);
    
    const ficha = charData.ficha;
    const recursos = ficha.recursos || { estabelecimentos: [], aliados: [], estoqueTemporario: {} };
    const estoqueTemp = recursos.estoqueTemporario || {};

    // Controle de Abas Internas (Estado Padrão)
    if (!globalState.recursosUI) globalState.recursosUI = { abaAtiva: 'estabelecimentos' };
    let ui = globalState.recursosUI;

    const estabelecimentosDoJogador = recursos.estabelecimentos || [];
    const hasStorage = estabelecimentosDoJogador.some(b => b.templateId === ID_PREDIO_ARMAZENAMENTO);

    // Se tem o prédio e tem itens temporários, migra automaticamente
    if (hasStorage && Object.keys(estoqueTemp).length > 0) {
        window.migrateTempToStorage(globalState.selectedCharacterId, estoqueTemp);
    }

    // Redireciona abas dependendo de ter o prédio de armazenamento ou não
    if (hasStorage && ui.abaAtiva === 'inventario') ui.abaAtiva = 'armazenamento';
    if (!hasStorage && ui.abaAtiva === 'armazenamento') ui.abaAtiva = 'inventario';

    const repStats = calculateReputationUsage(ficha); 
    const pctRep = repStats.total > 0 ? Math.min(100, Math.max(0, (repStats.used / repStats.total) * 100)) : 0;

    // Cálculo Financeiro (Produção e Consumo)
    const productionMap = new Map();
    const consumptionMap = new Map();
    const addToMap = (map, itemId, qtd) => map.set(itemId, (map.get(itemId) || 0) + qtd);

    estabelecimentosDoJogador.forEach(inst => {
        const tpl = globalState.cache.buildings.get(inst.templateId);
        if(tpl) {
            tpl.producaoPassiva?.forEach(r => addToMap(productionMap, r.itemId, r.qtd));
            tpl.custoManutencao?.forEach(c => addToMap(consumptionMap, c.itemId, c.qtd));
        }
    });

    const aliados = recursos.aliados || [];
    let allyWorking = 0;
    let buildOpen = 0;
    let buildFull = 0;
    let totalSlots = 0;

    estabelecimentosDoJogador.forEach(b => {
        const tpl = globalState.cache.buildings.get(b.templateId);
        if(tpl) {
            const slots = tpl.slotsTrabalho || 1;
            totalSlots += slots;
            const workers = aliados.filter(a => a.assignedBuildingId === b.uniqueId).length;
            if(workers >= slots) buildFull++; else buildOpen++;
        }
    });

    aliados.forEach(inst => {
        if (!inst.assignedBuildingId) return;
        allyWorking++;
        const tpl = globalState.cache.allies.get(inst.templateId);
        if(tpl) {
            tpl.producaoBase?.forEach(r => addToMap(productionMap, r.itemId, r.qtd));
            tpl.custoManutencao?.forEach(c => addToMap(consumptionMap, c.itemId, c.qtd));
        }
    });

    const allyIdle = aliados.length - allyWorking;
    const pctBuild = totalSlots > 0 ? Math.min(100, (allyWorking / totalSlots) * 100) : 0;
    const pctAlly = aliados.length > 0 ? Math.min(100, (allyWorking / aliados.length) * 100) : 0;

    // Cálculo de Lucro Líquido
    let netGold = 0;
    netGold += (productionMap.get(COINS.GOLD.id) || 0) * 100;
    netGold += (productionMap.get(COINS.SILVER.id) || 0) * 10;
    netGold += (productionMap.get(COINS.BRONZE.id) || 0) * 1;
    netGold -= (consumptionMap.get(COINS.GOLD.id) || 0) * 100;
    netGold -= (consumptionMap.get(COINS.SILVER.id) || 0) * 10;
    netGold -= (consumptionMap.get(COINS.BRONZE.id) || 0) * 1;

    let chestGold = 0;
    chestGold += (estoqueTemp[COINS.GOLD.id] || 0) * 100;
    chestGold += (estoqueTemp[COINS.SILVER.id] || 0) * 10;
    chestGold += (estoqueTemp[COINS.BRONZE.id] || 0) * 1;

    // Estrutura Principal do Painel
    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-slate-800 pb-2">
            <div class="text-xs text-slate-500 uppercase font-bold tracking-widest mt-2 flex items-center gap-3">
                PAINEL DE GESTÃO DO IMPÉRIO
            </div>
            ${globalState.isAdmin ? `<button onclick="window.adminEditReputation()" class="text-[10px] bg-red-900/50 text-red-300 px-3 py-1 rounded hover:bg-red-800" title="Editar Bônus de Reputação"><i class="fas fa-edit mr-1"></i> Edit GM</button>` : ''}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="reputation-summary-card dashboard-card-hover p-2 relative group">
                <div class="flex flex-col items-center w-full">
                    <span class="text-xl font-bold text-emerald-400 font-cinzel">${allyWorking} / ${totalSlots}</span>
                    <div class="rep-progress-container w-full max-w-[80%]">
                        <div class="rep-progress-fill bg-gradient-to-r from-emerald-500 to-green-400" style="width: ${pctBuild}%"></div>
                    </div>
                    <span class="reputation-summary-label mt-2"><i class="fas fa-city"></i> Vagas Ocupadas</span>
                </div>
                <div class="dashboard-tooltip-body hidden group-hover:block absolute bottom-full mb-2 w-48 text-left bg-slate-900 p-2 rounded shadow-lg border border-emerald-500 z-50">
                    <div class="text-xs text-white">Total Prédios: ${estabelecimentosDoJogador.length}</div>
                    <div class="text-xs text-emerald-400">Vagas Livres: ${buildOpen}</div>
                    <div class="text-xs text-red-400">Vagas Cheias: ${buildFull}</div>
                </div>
            </div>

            <div class="reputation-summary-card dashboard-card-hover p-2 relative group">
                <div class="flex flex-col items-center w-full">
                    <span class="text-xl font-bold text-sky-400 font-cinzel">${allyWorking} / ${aliados.length}</span>
                    <div class="rep-progress-container w-full max-w-[80%]">
                        <div class="rep-progress-fill bg-gradient-to-r from-sky-500 to-blue-400" style="width: ${pctAlly}%"></div>
                    </div>
                    <span class="reputation-summary-label mt-2"><i class="fas fa-users"></i> Taxa de Emprego</span>
                </div>
                <div class="dashboard-tooltip-body hidden group-hover:block absolute bottom-full mb-2 w-48 text-left bg-slate-900 p-2 rounded shadow-lg border border-sky-500 z-50">
                    <div class="text-xs text-emerald-400">Trabalhando: ${allyWorking}</div>
                    <div class="text-xs text-red-400">Ociosos: ${allyIdle}</div>
                </div>
            </div>

            <div class="reputation-summary-card dashboard-card-hover p-2 relative group">
                <div class="flex flex-col items-center w-full">
                    <span class="text-xl font-bold text-amber-400 font-cinzel">${repStats.used} / ${repStats.total}</span>
                    <div class="rep-progress-container w-full max-w-[80%]">
                        <div class="rep-progress-fill" style="width: ${pctRep}%"></div>
                    </div>
                    <span class="reputation-summary-label mt-2"><i class="fas fa-crown"></i> Cap. Reputação</span>
                </div>
                <div class="dashboard-tooltip-body hidden group-hover:block absolute bottom-full mb-2 w-64 text-left bg-slate-900 p-2 rounded shadow-lg border border-amber-500 z-50">
                    <div class="text-xs">Nível: +${ficha.levelPersonagemBase||1}</div>
                    <div class="text-xs">Méritos GM: +${recursos.reputacaoBonusGM||0}</div>
                    <div class="text-xs">Objetivos: +${recursos.reputacaoObjetivos||0}</div>
                    <div class="text-xs border-b border-slate-600 pb-1 mb-1">Coleções: +${repStats.colecao}</div>
                    <div class="text-xs text-emerald-400 font-bold">Total: ${repStats.total}</div>
                    <div class="text-xs text-red-400">Usado: -${repStats.used}</div>
                    <div class="text-xs text-white">Livre: ${repStats.available}</div>
                </div>
            </div>

            <div class="reputation-summary-card dashboard-card-hover relative group">
                <span class="reputation-summary-value ${netGold >= 0 ? 'text-emerald-400' : 'text-red-400'}">${(netGold / 100).toFixed(2)}</span>
                <span class="reputation-summary-label"><i class="fas fa-coins"></i> Moedas/h</span>
                <div class="absolute right-2 bottom-2 text-[10px] text-slate-500 bg-black/50 px-2 rounded">
                    Baú: <span class="text-amber-400 font-bold">${(chestGold / 100).toFixed(2)}</span>
                </div>
                <div class="dashboard-tooltip-body hidden group-hover:block absolute bottom-full mb-2 w-64 text-center bg-slate-900 p-2 rounded shadow-lg border border-emerald-500 z-50 text-xs text-slate-300">
                    Isso é o que seu império gera por hora (Líquido).<br><br>
                    O valor menor é o Ouro acumulado no Estoque aguardando coleta.
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-slate-900/50 p-4 rounded-lg border border-emerald-900/30 relative">
                <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <h4 class="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-3 flex items-center"><i class="fas fa-arrow-up mr-2"></i>Produção / Hora</h4>
                <div class="mini-grid-container min-h-[40px]">${renderSmallItemGrid(productionMap)}</div>
            </div>
            <div class="bg-slate-900/50 p-4 rounded-lg border border-red-900/30 relative">
                <div class="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 class="text-red-400 font-bold uppercase text-xs tracking-widest mb-3 flex items-center"><i class="fas fa-arrow-down mr-2"></i>Custos / Hora</h4>
                <div class="mini-grid-container min-h-[40px]">${renderSmallItemGrid(consumptionMap)}</div>
            </div>
        </div>

        <div class="sub-nav-container flex gap-2 overflow-x-auto mb-6 border-b border-slate-700 pb-0">
            <button class="sub-tab-btn ${ui.abaAtiva === 'estabelecimentos' ? 'active' : ''}" onclick="window.switchRepSubTab('estabelecimentos')">Meus Estabelecimentos</button>
            <button class="sub-tab-btn ${ui.abaAtiva === 'allies' ? 'active' : ''}" onclick="window.switchRepSubTab('allies')">Meus Aliados</button>
            ${!hasStorage ? `
                <button class="sub-tab-btn ${ui.abaAtiva === 'inventario' ? 'active' : ''}" onclick="window.switchRepSubTab('inventario')">Inv. Temporário (10 min)</button>
            ` : `
                <button class="sub-tab-btn ${ui.abaAtiva === 'armazenamento' ? 'active' : ''} border-emerald-500 text-emerald-400 font-bold" onclick="window.switchRepSubTab('armazenamento')">
                    <i class="fas fa-warehouse mr-1"></i> Armazém Central
                </button>
            `}
            <button class="sub-tab-btn ${ui.abaAtiva === 'store' ? 'active' : ''}" onclick="window.switchRepSubTab('store')">Comprar / Contratar</button>
        </div>

        <div id="rep-dynamic-content" class="w-full relative min-h-[300px]"></div>
    `;

    container.innerHTML = html;
    const dynContainer = document.getElementById('rep-dynamic-content');

    if (ui.abaAtiva === 'estabelecimentos') renderMyBuildings(dynContainer, estabelecimentosDoJogador, aliados);
    else if (ui.abaAtiva === 'allies') renderMyAllies(dynContainer, aliados, estabelecimentosDoJogador);
    else if (ui.abaAtiva === 'store') renderReputationStore(dynContainer, repStats);
    else if (ui.abaAtiva === 'inventario') renderResourceInventory(dynContainer, estoqueTemp, recursos.tempoConclusaoColeta);
    else if (ui.abaAtiva === 'armazenamento') {
        if (typeof window.renderStorageTab === 'function') window.renderStorageTab(dynContainer);
    }
}

// Vincula a função de renderização no escopo global para as chamadas inline do HTML
window.renderReputacaoTab = renderReputacaoTab;

// --- RENDERS DAS SUB-ABAS ---

function renderMyBuildings(container, buildings, allies) {
    if(buildings.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Você não possui estabelecimentos.</p>';
        return;
    }

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    buildings.forEach(inst => {
        const tpl = globalState.cache.buildings.get(inst.templateId);
        if(!tpl) return;
        const assigned = allies.filter(a => a.assignedBuildingId === inst.uniqueId);

        html += `
            <div class="asset-card relative group">
                <div class="h-32 bg-cover bg-center relative" style="background-image: url('${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}')">
                    <button onclick="window.deleteAsset('${inst.uniqueId}', 'building')" class="absolute top-2 left-2 bg-red-900/80 hover:bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center transition shadow-lg z-10" title="Demolir">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                    <div class="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-amber-400 border border-amber-500/30">Nível 1</div>
                </div>
                <div class="p-3 flex flex-col gap-2 flex-grow">
                    <h4 class="font-bold text-amber-500 font-cinzel text-lg">${tpl.nome}</h4>
                    <div class="text-xs flex justify-between"><span>Vagas:</span> <span class="text-white">${assigned.length} / ${tpl.slotsTrabalho}</span></div>
                    <div class="text-xs flex justify-between"><span>Reputação:</span> <span class="text-amber-400">+${tpl.reputacaoGerada}</span></div>
                    <div class="bg-slate-900/50 p-2 rounded border border-slate-700 mt-2">
                        <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">Produção Passiva</div>
                        <div class="text-xs text-sky-400">${renderResourceString(tpl.producaoPassiva)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function renderMyAllies(container, allies, buildings) {
    if(allies.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-10">Você não possui aliados contratados.</p>';
        return;
    }

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    allies.forEach(inst => {
        const tpl = globalState.cache.allies.get(inst.templateId);
        if(!tpl) return;
        const workplace = buildings.find(b => b.uniqueId === inst.assignedBuildingId);
        const wpName = workplace ? globalState.cache.buildings.get(workplace.templateId)?.nome : "Desempregado";

        html += `
            <div class="asset-card relative">
                <div class="h-32 bg-cover bg-center relative" style="background-image: url('${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}')">
                    <button onclick="window.deleteAsset('${inst.uniqueId}', 'ally')" class="absolute top-2 left-2 bg-red-900/80 hover:bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center transition shadow-lg z-10" title="Demitir">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
                <div class="p-3 flex flex-col gap-2 flex-grow">
                    <h4 class="font-bold text-sky-400 font-cinzel text-lg">${tpl.nome}</h4>
                    <p class="text-xs text-slate-400">${tpl.tipo}</p>
                    <div class="bg-slate-900/50 p-2 rounded border border-slate-700 mb-2">
                        <div class="text-[10px] text-slate-500 uppercase">Local de Trabalho</div>
                        <div class="text-sm font-bold ${workplace ? 'text-emerald-400' : 'text-red-400'} flex justify-between items-center">
                            <span class="truncate pr-2">${wpName}</span>
                            <button class="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 text-white" onclick="window.openAssignModal('${inst.uniqueId}')"><i class="fas fa-edit"></i></button>
                        </div>
                    </div>
                    <div class="text-xs flex justify-between"><span>Salário/h:</span> <span>${renderCostString(tpl.custoManutencao)}</span></div>
                    <div class="text-xs flex justify-between"><span>Produção Base:</span> <span class="text-sky-400">${renderResourceString(tpl.producaoBase)}</span></div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function renderReputationStore(container, repStats) {
    const charFicha = globalState.selectedCharacterData.ficha;
    const isLevelValid = (charFicha.levelPersonagemBase || 1) >= 5;
    const isSessionValid = globalState.activeSessionId && globalState.activeSessionId !== 'world';
    
    let warning = '';
    if (!isLevelValid || !isSessionValid) {
        warning = `
            <div class="bg-red-900/30 border border-red-500/50 p-3 rounded mb-4 text-xs text-red-200">
                <i class="fas fa-lock text-red-500 mr-2"></i><strong>Loja Bloqueada:</strong> ${!isLevelValid ? 'O personagem deve ser Nível 5+.' : 'Você deve estar em uma Sessão de Jogo.'}
            </div>
        `;
    }

    let html = `${warning}<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">`;
    
    // Predios
    html += `<div><h3 class="font-cinzel text-amber-500 text-lg border-b border-slate-700 pb-2 mb-4">Estabelecimentos</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`;
    globalState.cache.buildings.forEach(tpl => { html += createStoreCard(tpl, 'building', repStats, isLevelValid, isSessionValid); });
    html += `</div></div>`;

    // Aliados
    html += `<div><h3 class="font-cinzel text-sky-500 text-lg border-b border-slate-700 pb-2 mb-4">Contratar Aliados</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`;
    globalState.cache.allies.forEach(tpl => { html += createStoreCard(tpl, 'ally', repStats, isLevelValid, isSessionValid); });
    html += `</div></div></div>`;

    container.innerHTML = html;
}

function createStoreCard(tpl, type, repStats, isLevelValid, isSessionValid) {
    const reqRep = type === 'building' ? (tpl.reputacaoCusto || 0) : (tpl.reputacaoCustoBase || 0);
    // Para construir precisa ter Espaço Livre suficiente
    const isLocked = repStats.available < reqRep || !isLevelValid || !isSessionValid;
    const costResources = type === 'building' ? (tpl.custoConstrucao || []) : (tpl.custoAquisicao || []);

    let btnHtml = isLocked 
        ? `<button class="btn bg-slate-800 text-slate-500 w-full py-2 text-xs border border-slate-700" disabled><i class="fas fa-lock mr-1"></i> Req. ${reqRep} Espaço Rep</button>`
        : `<button class="btn btn-primary w-full py-2 text-xs" onclick="window.purchaseAsset('${tpl.id}', '${type}')"><i class="fas fa-shopping-cart mr-1"></i> Adquirir</button>`;

    return `
        <div class="asset-card ${isLocked ? 'grayscale opacity-70' : ''}">
            <div class="h-32 bg-cover bg-center relative" style="background-image: url('${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}')">
                <div class="absolute bottom-0 w-full bg-black/70 p-2"><h4 class="font-bold text-white text-sm truncate">${tpl.nome}</h4></div>
            </div>
            <div class="p-3 flex flex-col gap-2 flex-grow">
                <p class="text-xs text-slate-400 line-clamp-2 min-h-[2.5em]">${tpl.descricao || ''}</p>
                <div class="mt-auto pt-2 border-t border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] text-slate-500 uppercase">Custo</span>
                        ${reqRep > 0 ? `<span class="text-[10px] ${repStats.available < reqRep ? 'text-red-500' : 'text-amber-400'} font-bold"><i class="fas fa-crown"></i> ${reqRep}</span>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1 mb-3">${costResources.length > 0 ? renderResourcesMini(costResources) : '<span class="text-green-400 text-xs font-bold">Grátis</span>'}</div>
                    ${btnHtml}
                </div>
            </div>
        </div>
    `;
}

function renderResourceInventory(container, estoqueTemp, coletaFim) {
    let html = `
        <div class="bg-slate-900/80 p-6 rounded-lg border border-slate-700">
            <h3 class="font-cinzel text-amber-400 text-lg mb-1">Estoque Temporário</h3>
            <p class="text-xs text-slate-500 mb-6">Itens produzidos aguardando transporte de 10 minutos.</p>
    `;

    const itemIds = Object.keys(estoqueTemp || {});
    if(itemIds.length === 0) {
        html += `<div class="p-8 text-center text-slate-500 italic border-2 border-dashed border-slate-800 rounded-lg mb-6">O depósito está vazio.</div>`;
    } else {
        html += `<div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">`;
        itemIds.forEach(id => {
            const qty = estoqueTemp[id];
            let itemInfo = globalState.cache.allItems.get(id) || globalState.cache.itens.get(id) || { nome: "Item Desconhecido", imagemUrl: PLACEHOLDER_IMAGE_URL };
            html += `
                <div class="relative bg-slate-800 border border-slate-600 rounded p-1 group">
                    <img src="${itemInfo.imagemUrl}" class="w-full aspect-square object-contain" title="${itemInfo.nome}">
                    <span class="absolute bottom-0 right-0 bg-black/80 text-white text-[10px] px-1 rounded">${qty}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    const agora = Date.now();
    if (coletaFim) {
        if (agora < coletaFim) {
            const min = Math.ceil((coletaFim - agora) / 60000);
            html += `<button class="btn w-full py-4 bg-slate-800 border border-slate-600 text-slate-400 cursor-not-allowed flex items-center justify-center gap-3"><i class="fas fa-hourglass-half animate-pulse text-amber-500"></i> Chegando em ${min} min</button>`;
        } else {
            html += `<button onclick="window.handleCollectionClick()" class="btn btn-green w-full py-4 shadow-lg animate-bounce flex items-center justify-center gap-3"><i class="fas fa-box-open"></i> CONFIRMAR RECEBIMENTO</button>`;
        }
    } else if (itemIds.length > 0) {
        html += `<button onclick="window.handleCollectionClick()" class="btn btn-primary w-full py-4 flex items-center justify-center gap-3"><i class="fas fa-dolly"></i> INICIAR TRANSPORTE</button>`;
    } else {
        html += `<button class="btn bg-slate-800 text-slate-500 w-full py-4 cursor-not-allowed">Nada a coletar</button>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// =============================================================================
// --- SISTEMA DE ARMAZENAMENTO CENTRAL (BAÚ DIVIDIDO) ---
// =============================================================================

window.updateStorageFilter = function(filterValue) {
    globalState.storageFilter = filterValue;
    window.switchRepSubTab('armazenamento');
};

window.addToStorageCart = function(sourceSide, itemId) {
    const input = document.getElementById(`qty-${sourceSide}-${itemId}`);
    const qtyToAdd = parseInt(input.value) || 0;
    if (qtyToAdd <= 0) return;

    if (sourceSide === 'mochila') {
        globalState.transferCart.toStorage[itemId] = (globalState.transferCart.toStorage[itemId] || 0) + qtyToAdd;
    } else {
        globalState.transferCart.toMochila[itemId] = (globalState.transferCart.toMochila[itemId] || 0) + qtyToAdd;
    }
    window.switchRepSubTab('armazenamento');
};

window.removeFromStorageCart = function(targetKey, itemId) {
    delete globalState.transferCart[targetKey][itemId];
    window.switchRepSubTab('armazenamento');
};

window.clearStorageCart = function() {
    globalState.transferCart = { toStorage: {}, toMochila: {} };
    window.switchRepSubTab('armazenamento');
};

window.syncStorage = async function() {
    const charId = globalState.selectedCharacterId;
    const cart = globalState.transferCart;
    
    if (Object.keys(cart.toStorage).length === 0 && Object.keys(cart.toMochila).length === 0) return alert("Nada para sincronizar.");

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const storageRef = doc(db, "rpg_armazenamentos", charId);
            
            const [charSnap, storageSnap] = await Promise.all([t.get(charRef), t.get(storageRef)]);
            if (!charSnap.exists()) throw "Personagem não encontrado.";
            
            let mochila = charSnap.data().mochila || {};
            let storageItens = storageSnap.exists() ? (storageSnap.data().itens || {}) : {};

            for (let [id, qty] of Object.entries(cart.toStorage)) {
                if (!mochila[id] || mochila[id] < qty) throw "Falta item na mochila.";
                mochila[id] -= qty;
                if (mochila[id] <= 0) delete mochila[id];
                storageItens[id] = (storageItens[id] || 0) + qty;
            }

            for (let [id, qty] of Object.entries(cart.toMochila)) {
                if (!storageItens[id] || storageItens[id] < qty) throw "Falta item no armazém.";
                storageItens[id] -= qty;
                if (storageItens[id] <= 0) delete storageItens[id];
                mochila[id] = (mochila[id] || 0) + qty;
            }

            t.update(charRef, { mochila });
            t.set(storageRef, { itens: storageItens }, { merge: true });
        });

        globalState.transferCart = { toStorage: {}, toMochila: {} };
        alert("Transferência concluída!");
        window.switchRepSubTab('armazenamento');
    } catch(e) {
        console.error(e);
        alert("Erro na sincronização: " + e);
    }
};

window.migrateTempToStorage = async function(charId, estoqueTemporario) {
    if (!estoqueTemporario || Object.keys(estoqueTemporario).length === 0) return;
    try {
        const batch = writeBatch(db);
        const charRef = doc(db, "rpg_fichas", charId);
        const storageRef = doc(db, "rpg_armazenamentos", charId);
        
        batch.update(charRef, { "recursos.estoqueTemporario": deleteField() });
        
        const storageSnap = await getDoc(storageRef);
        let storageItens = storageSnap.exists() ? (storageSnap.data().itens || {}) : {};
        
        for (let [itemId, qtd] of Object.entries(estoqueTemporario)) {
            storageItens[itemId] = (storageItens[itemId] || 0) + qtd;
        }
        
        batch.set(storageRef, { itens: storageItens }, { merge: true });
        await batch.commit();
    } catch (e) { console.error("Erro na migração:", e); }
};

window.renderStorageTab = function(container) {
    if(!container) container = document.getElementById('rep-dynamic-content');
    if(!container) return;

    const charData = globalState.selectedCharacterData;
    const mochila = charData.ficha.mochila || {};
    const storage = globalState.currentStorage || {};
    const cart = globalState.transferCart || { toStorage: {}, toMochila: {} };
    const filter = globalState.storageFilter || 'todos';

    let materiaisSet = new Set();
    if (globalState.cache.receitas) {
        globalState.cache.receitas.forEach(function(receita) {
            if (receita.materiais && Array.isArray(receita.materiais)) {
                receita.materiais.forEach(mat => materiaisSet.add(mat.itemId)); 
            }
        });
    }

    const processItems = (sourceMap, cartData) => {
        let items = [];
        for (let [id, qty] of Object.entries(sourceMap)) {
            let info = globalState.cache.allItems.get(id) || globalState.cache.itens.get(id);
            if (!info) continue;
            
            let availableQty = qty - (cartData[id] || 0);
            if (availableQty <= 0) continue;

            const tipoStr = (info.tipoItem || info.categoria || "").toLowerCase();
            let isEquip = tipoStr.includes('arma') || tipoStr.includes('armadura') || tipoStr.includes('equipamento') || info.slot_equipavel_id;
            let isConsumivel = tipoStr.includes('consumível') || tipoStr.includes('poção') || info.itemUsavel;
            let isMaterial = materiaisSet.has(id) || tipoStr.includes('material') || tipoStr.includes('minério');

            if (filter === 'equipamentos' && !isEquip) continue;
            if (filter === 'consumiveis' && !isConsumivel) continue;
            if (filter === 'materiais' && !isMaterial) continue;
            if (filter === 'diversos' && (isEquip || isConsumivel || isMaterial)) continue;

            items.push({ id, qtd: availableQty, nome: info.nome, img: info.imagemUrl || PLACEHOLDER_IMAGE_URL, rank: info.tierId || info.tier || "F" });
        }
        return items.sort((a,b) => a.nome.localeCompare(b.nome));
    };

    const mochilaItems = processItems(mochila, cart.toStorage);
    const storageItems = processItems(storage, cart.toMochila);

    const generateListHtml = (items, sideName) => {
        if(items.length === 0) return `<div class="col-span-full py-10 text-center text-slate-500 italic">Vazio.</div>`;
        return items.map(item => `
            <div class="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col justify-between group hover:border-amber-500 transition-colors">
                <div class="flex items-start gap-2 mb-2">
                    <img src="${item.img}" class="w-10 h-10 object-contain bg-slate-900 rounded border border-slate-600">
                    <div class="flex-grow overflow-hidden">
                        <div class="text-[10px] font-bold text-white truncate" title="${item.nome}">${item.nome}</div>
                        <div class="text-[9px] text-slate-500">Rank ${item.rank}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between bg-slate-900 rounded p-1">
                    <span class="text-[10px] font-bold text-emerald-400">x${item.qtd}</span>
                    <div class="flex gap-1">
                        <input type="number" id="qty-${sideName}-${item.id}" value="1" min="1" max="${item.qtd}" class="w-12 bg-slate-950 border border-slate-700 rounded text-center text-[10px] text-white outline-none focus:border-sky-500">
                        <button onclick="window.addToStorageCart('${sideName}', '${item.id}')" class="bg-sky-600 hover:bg-sky-500 text-white rounded px-2 py-1 text-[10px] shadow transition">Mover</button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    let cartHtml = '';
    Object.entries(cart.toStorage).forEach(([id, qty]) => {
        let info = globalState.cache.allItems.get(id) || globalState.cache.itens.get(id);
        cartHtml += `<div onclick="window.removeFromStorageCart('toStorage', '${id}')" class="cursor-pointer bg-slate-800 border border-sky-500 text-sky-300 text-[10px] px-2 py-1 rounded flex items-center gap-2 hover:bg-red-900/50 hover:border-red-500 transition" title="Cancelar"><span>[Para Baú] ${info?.nome} <strong>x${qty}</strong></span> <i class="fas fa-times opacity-50"></i></div>`;
    });
    Object.entries(cart.toMochila).forEach(([id, qty]) => {
        let info = globalState.cache.allItems.get(id) || globalState.cache.itens.get(id);
        cartHtml += `<div onclick="window.removeFromStorageCart('toMochila', '${id}')" class="cursor-pointer bg-slate-800 border border-amber-500 text-amber-300 text-[10px] px-2 py-1 rounded flex items-center gap-2 hover:bg-red-900/50 hover:border-red-500 transition" title="Cancelar"><span>[Para Mochila] ${info?.nome} <strong>x${qty}</strong></span> <i class="fas fa-times opacity-50"></i></div>`;
    });
    if(!cartHtml) cartHtml = '<span class="text-[10px] text-slate-500 italic">Nenhum item pendente.</span>';

    const hasPending = Object.keys(cart.toStorage).length > 0 || Object.keys(cart.toMochila).length > 0;

    container.innerHTML = `
        <div class="bg-slate-900/80 p-4 rounded-lg border border-emerald-900/50 shadow-2xl animate-fade-in flex flex-col min-h-[600px]">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
                <h3 class="font-cinzel text-emerald-400 text-xl"><i class="fas fa-warehouse mr-2"></i> Logística Central</h3>
                <div class="flex gap-2">
                    <button onclick="window.updateStorageFilter('todos')" class="px-3 py-1 rounded text-[10px] uppercase font-bold border transition ${filter === 'todos' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}">Tudo</button>
                    <button onclick="window.updateStorageFilter('equipamentos')" class="px-3 py-1 rounded text-[10px] uppercase font-bold border transition ${filter === 'equipamentos' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}">Equip</button>
                    <button onclick="window.updateStorageFilter('consumiveis')" class="px-3 py-1 rounded text-[10px] uppercase font-bold border transition ${filter === 'consumiveis' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}">Consumível</button>
                    <button onclick="window.updateStorageFilter('materiais')" class="px-3 py-1 rounded text-[10px] uppercase font-bold border transition ${filter === 'materiais' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}">Material</button>
                </div>
            </div>

            <div class="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                <div class="flex flex-col border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                    <div class="bg-slate-800 p-2 text-center text-xs font-bold text-amber-400 uppercase tracking-widest border-b border-slate-700">Mochila Pessoal</div>
                    <div class="flex-grow p-3 overflow-y-auto custom-scroll h-[400px]">
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${generateListHtml(mochilaItems, 'mochila')}</div>
                    </div>
                </div>
                <div class="flex flex-col border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                    <div class="bg-slate-800 p-2 text-center text-xs font-bold text-sky-400 uppercase tracking-widest border-b border-slate-700">Armazém Central</div>
                    <div class="flex-grow p-3 overflow-y-auto custom-scroll h-[400px]">
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${generateListHtml(storageItems, 'storage')}</div>
                    </div>
                </div>
            </div>

            <div class="mt-4 bg-slate-800 p-4 rounded-lg border border-slate-600 flex flex-col gap-3 shadow-inner">
                <div class="flex flex-wrap gap-2 items-center">
                    <span class="text-[10px] text-slate-400 uppercase font-bold mr-2"><i class="fas fa-clipboard-list mr-1"></i> Transferências:</span>
                    ${cartHtml}
                </div>
                <div class="flex justify-end gap-4 mt-2 pt-3 border-t border-slate-700">
                    <button onclick="window.clearStorageCart()" class="btn bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 px-6" ${!hasPending ? 'disabled' : ''}>Limpar Fila</button>
                    <button onclick="window.syncStorage()" class="btn btn-green shadow-lg font-bold uppercase tracking-wider py-2 px-10 flex items-center gap-2" ${!hasPending ? 'disabled' : ''}>
                        <i class="fas fa-sync-alt"></i> Sincronizar Tudo
                    </button>
                </div>
            </div>
        </div>
    `;
};


// --- FUNÇÕES UTILITÁRIAS GLOBAIS DA ABA ---

window.switchRepSubTab = function(tabName) {
    if (!globalState.recursosUI) globalState.recursosUI = { abaAtiva: 'estabelecimentos' };
    globalState.recursosUI.abaAtiva = tabName;
    window.renderReputacaoTab();
};

window.deleteAsset = async function(uniqueId, type) {
    if(!confirm("Tem certeza que deseja remover? Recursos não são devolvidos.")) return;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", globalState.selectedCharacterId);
            const d = (await t.get(ref)).data();
            const r = d.recursos;
            if (type === 'building') {
                r.estabelecimentos = r.estabelecimentos.filter(b => b.uniqueId !== uniqueId);
                r.aliados.forEach(a => { if (a.assignedBuildingId === uniqueId) a.assignedBuildingId = null; });
            } else {
                r.aliados = r.aliados.filter(a => a.uniqueId !== uniqueId);
            }
            t.update(ref, { recursos: r });
        });
        alert("Removido com sucesso!");
    } catch(e) { alert("Erro ao remover."); }
};

window.purchaseAsset = async function(templateId, type) {
    const charId = globalState.selectedCharacterId;
    const cache = type === 'building' ? globalState.cache.buildings : globalState.cache.allies;
    const tpl = cache.get(templateId);
    if(!tpl || !confirm(`Comprar ${tpl.nome}?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const docSnap = await t.get(ref);
            const data = docSnap.data();
            const mochila = data.mochila || {};
            const r = data.recursos || { estabelecimentos: [], aliados: [] };
            
            const costs = type === 'building' ? (tpl.custoConstrucao || []) : (tpl.custoAquisicao || []);
            let costValue = 0; 
            let playerValue = (mochila[COINS.GOLD.id]||0)*100 + (mochila[COINS.SILVER.id]||0)*10 + (mochila[COINS.BRONZE.id]||0);

            for(const c of costs) {
                if (c.itemId === COINS.BRONZE.id) costValue += c.qtd;
                else if (c.itemId === COINS.SILVER.id) costValue += c.qtd * 10;
                else if (c.itemId === COINS.GOLD.id) costValue += c.qtd * 100;
                else {
                    if ((mochila[c.itemId] || 0) < c.qtd) throw `Falta material: ${c.nome}`;
                    mochila[c.itemId] -= c.qtd;
                    if(mochila[c.itemId] <= 0) delete mochila[c.itemId];
                }
            }

            if (playerValue < costValue) throw "Ouro insuficiente.";

            let remaining = playerValue - costValue;
            delete mochila[COINS.GOLD.id]; delete mochila[COINS.SILVER.id]; delete mochila[COINS.BRONZE.id];
            
            const g = Math.floor(remaining / 100); remaining %= 100;
            const s = Math.floor(remaining / 10); remaining %= 10;
            if(g>0) mochila[COINS.GOLD.id] = g;
            if(s>0) mochila[COINS.SILVER.id] = s;
            if(remaining>0) mochila[COINS.BRONZE.id] = remaining;

            const newAsset = { templateId: tpl.id, uniqueId: Date.now().toString(36), dataAquisicao: Date.now() };
            if(type === 'building') { newAsset.assignedAllies = []; r.estabelecimentos.push(newAsset); }
            else { newAsset.assignedBuildingId = null; r.aliados.push(newAsset); }

            t.update(ref, { mochila, recursos: r });
        });
    } catch(e) { alert(e); }
};

window.handleCollectionClick = async function() {
    const charId = globalState.selectedCharacterId;
    const r = globalState.selectedCharacterData.ficha.recursos;
    if (!r.tempoConclusaoColeta) {
        if(!confirm("Iniciar transporte? Levará 10 minutos.")) return;
        await updateDoc(doc(db, "rpg_fichas", charId), { "recursos.tempoConclusaoColeta": Date.now() + (10 * 60000) });
    } else if (Date.now() >= r.tempoConclusaoColeta) {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const est = d.recursos.estoqueTemporario || {};
            const moch = d.mochila || {};
            for (const [id, q] of Object.entries(est)) moch[id] = (moch[id]||0) + q;
            t.update(ref, { mochila: moch, "recursos.estoqueTemporario": deleteField(), "recursos.tempoConclusaoColeta": deleteField() });
        });
        alert("Itens guardados!");
    } else { alert("Ainda não chegou."); }
};

window.adminEditReputation = async function() {
    const num = parseInt(prompt("Bônus GM:", globalState.selectedCharacterData.ficha.recursos?.reputacaoBonusGM || 0));
    if(!isNaN(num)) await updateDoc(doc(db, "rpg_fichas", globalState.selectedCharacterId), { "recursos.reputacaoBonusGM": num });
};

// Helpers Matemáticos Internos
function calculateReputationUsage(ficha) {
    let totalCap = (ficha.levelPersonagemBase || 1); 
    if (ficha.profissoes) Object.values(ficha.profissoes).forEach(p => totalCap += (p.nivel || 0));
    totalCap += Number(ficha.recursos?.reputacaoBonusGM || 0) + Number(ficha.recursos?.reputacaoObjetivos || 0);

    let repColecao = 0;
    ['colecao_jogadores', 'colecao_npcs', 'colecao_cidades'].forEach(k => {
        if(ficha[k]) Object.values(ficha[k]).forEach(v => { if (v?.resgatado) repColecao += (k==='colecao_cidades'?10:(k==='colecao_npcs'?5:2)); });
    });
    totalCap += repColecao;

    const buildings = ficha.recursos?.estabelecimentos || [];
    let used = 0;
    buildings.forEach(b => {
        const tpl = globalState.cache.buildings.get(b.templateId);
        if (tpl) { totalCap += (tpl.reputacaoGerada || 0); used += (tpl.reputacaoCusto || 0); }
    });

    (ficha.recursos?.aliados || []).forEach(a => {
        const tpl = globalState.cache.allies.get(a.templateId);
        if (tpl) used += (tpl.reputacaoCustoBase || 0);
    });

    return { total: totalCap, used, available: totalCap - used, colecao: repColecao };
}

function renderSmallItemGrid(mapObj) {
    if(mapObj.size === 0) return '<span class="text-xs text-slate-600">Nada.</span>';
    let h = '';
    mapObj.forEach((qty, id) => {
        const item = globalState.cache.allItems.get(id) || globalState.cache.itens.get(id);
        const img = item?.imagemUrl ? `background-image:url('${item.imagemUrl}')` : `background-color:#334`;
        h += `<div class="mini-slot" style="${img}" title="${item?.nome||'Item'}"><span class="mini-slot-qty">${qty}</span></div>`;
    });
    return h;
}

function renderResourcesMini(list) {
    return list.map(r => {
        const item = globalState.cache.allItems.get(r.itemId) || globalState.cache.itens.get(r.itemId);
        return `<div class="flex items-center bg-black/40 px-1 rounded border border-slate-700" title="${item?.nome}"><img src="${item?.imagemUrl||PLACEHOLDER_IMAGE_URL}" class="w-3 h-3 mr-1 object-cover"><span class="text-[9px] text-white font-mono">${r.qtd}</span></div>`;
    }).join('');
}

function renderResourceString(list) {
    return list?.length ? list.map(c => `${c.qtd}x ${globalState.cache.allItems.get(c.itemId)?.nome||'Item'}`).join(', ') : "Nada";
}
function renderCostString(list) {
    return list?.length ? list.map(c => `${c.qtd}x ${globalState.cache.allItems.get(c.itemId)?.nome||'Item'}`).join(', ') : "Grátis";
}

window.openAssignModal = function(allyId) {
    const r = globalState.selectedCharacterData.ficha.recursos;
    const tpl = globalState.cache.allies.get(r.aliados.find(a=>a.uniqueId===allyId).templateId);
    const valid = r.estabelecimentos.filter(b => {
        const tb = globalState.cache.buildings.get(b.templateId);
        const w = r.aliados.filter(a => a.assignedBuildingId === b.uniqueId).length;
        return w < (tb.slotsTrabalho||1) && (!tpl.estabelecimentosPermitidos?.length || tpl.estabelecimentosPermitidos.includes(b.templateId));
    });

    const m = document.createElement('div');
    m.innerHTML = `
        <div class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
            <div class="bg-slate-800 p-6 rounded max-w-sm w-full">
                <h3 class="text-white font-bold mb-4">Mudar Emprego</h3>
                <button onclick="window.confirmAssign('${allyId}', null); this.parentElement.parentElement.remove()" class="btn bg-red-900 w-full mb-2">Desempregar</button>
                ${valid.map(b => `<button onclick="window.confirmAssign('${allyId}', '${b.uniqueId}'); this.parentElement.parentElement.remove()" class="btn bg-slate-700 w-full mb-2">${globalState.cache.buildings.get(b.templateId).nome}</button>`).join('')}
                <button onclick="this.parentElement.parentElement.remove()" class="btn w-full mt-2">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
}

window.confirmAssign = async function(aId, bId) {
    await runTransaction(db, async t => {
        const ref = doc(db, "rpg_fichas", globalState.selectedCharacterId);
        const d = (await t.get(ref)).data();
        d.recursos.aliados.find(a => a.uniqueId === aId).assignedBuildingId = bId;
        t.update(ref, { recursos: d.recursos });
    });
}