import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, orderBy, query, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

const BASE_CASH = 1000;

let shopState = {
    activeTab: 'tab-config', 
    cache: { 
        shopTypes: [], itemTiers: [], shopTiers: [], shops: [], locations: [], 
        allItensCadastrados: [], allItensMochila: [], masterList: [] 
    },
    // Ordenação
    sortConfig: { field: 'nome', dir: 'asc' },
    // Filtros
    typeItemSearch: '',
    typeFilterSource: 'all',
    typeFilterTag: '',
    showOnlyUntagged: false,
    selectedItems: new Set(),
    shopTypeSelectedItems: new Set()
};

export async function renderCadastroLojasTab() {
    const container = document.getElementById('cadastro-lojas-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left flex items-center gap-4">
                    <div class="p-4 bg-blue-500/10 rounded-full border-2 border-blue-500/30 text-blue-500 text-3xl shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div>
                        <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-blue-500 tracking-widest drop-shadow-md">Engine Econômica</h1>
                        <p class="text-slate-400 mt-2 text-sm italic">Matrizes de Probabilidade & Gestão de Comércio</p>
                    </div>
                </div>
            </header>

            <nav class="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4" id="shop-tabs-nav">
                <button class="shop-tab-btn active" data-tab="tab-config">1. Config. Base</button>
                <button class="shop-tab-btn" data-tab="tab-matrix">2. Matriz de Lojas</button>
                <button class="shop-tab-btn" data-tab="tab-shops">3. Gestão de Lojas</button>
                <button class="shop-tab-btn" data-tab="tab-items">4. Classificação Itens</button>
                <button class="shop-tab-btn" data-tab="tab-shop-types">5. Tipos de Loja (Tags)</button>
                <button class="shop-tab-btn" data-tab="tab-audit">6. Auditoria Estoque</button>
            </nav>

            <div id="shop-dynamic-content" class="w-full relative min-h-[500px]">
                <div id="shop-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 mb-4"></div>
                    <p class="text-blue-400 font-cinzel tracking-widest" id="shop-loading-text">Analisando Mercado...</p>
                </div>
                <div id="shop-view" class="w-full hidden"></div>
            </div>

        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('shop-tabs-nav');
    if (!nav) return;

    const baseClasses = ['bg-slate-900', 'text-slate-400', 'border', 'border-slate-800', 'hover:bg-slate-800', 'px-4', 'py-2', 'rounded', 'font-bold', 'text-xs', 'transition-colors'];
    const activeClasses = ['bg-blue-600', 'text-white', 'border-blue-500', 'shadow-lg'];

    nav.querySelectorAll('.shop-tab-btn').forEach(btn => {
        btn.classList.add(...baseClasses);
        if (btn.dataset.tab === shopState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.shop-tab-btn');
        if (btn) {
            shopState.activeTab = btn.dataset.tab;
            setupTabs(); 
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        const [
            stSnap, itSnap, shtSnap, shopsSnap, locSnap, 
            icSnap, imSnap, masterSnap
        ] = await Promise.all([
            getDocs(collection(db, 'rpg_shop_types')),
            getDocs(collection(db, 'rpg_item_tiers')),
            getDocs(collection(db, 'rpg_shop_tiers')),
            getDocs(collection(db, 'rpg_lojas')),
            getDocs(collection(db, 'rpg_locations')),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila')),
            getDocs(collection(db, 'rpg_balanceamento_itens_precos_geral'))
        ]);

        shopState.cache = {
            shopTypes: stSnap.docs.map(d => ({id: d.id, ...d.data()})),
            itemTiers: itSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (b.probabilidade||0) - (a.probabilidade||0)),
            shopTiers: shtSnap.docs.map(d => ({id: d.id, ...d.data()})),
            shops: shopsSnap.docs.map(d => ({id: d.id, ...d.data()})),
            locations: locSnap.docs.map(d => ({id: d.id, ...d.data()})),
            allItensCadastrados: icSnap.docs.map(d => ({id: d.id, ...d.data()})),
            allItensMochila: imSnap.docs.map(d => ({id: d.id, ...d.data()})),
            masterList: masterSnap.docs.map(d => ({id: d.id, ...d.data()}))
        };

        document.getElementById('shop-loading').classList.add('hidden');
        document.getElementById('shop-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('shop-loading').innerHTML = '<p class="text-red-500 font-bold p-10">Bolsa de Valores Inacessível (Erro DB).</p>';
    }
}

function setLoading(isLoad, msg = "Processando...") {
    const l = document.getElementById('shop-loading');
    const v = document.getElementById('shop-view');
    const t = document.getElementById('shop-loading-text');
    if(!l || !v) return;
    if(isLoad) {
        if(t) t.textContent = msg;
        l.classList.remove('hidden'); v.classList.add('hidden');
    } else {
        l.classList.add('hidden'); v.classList.remove('hidden');
    }
}

function renderActiveView() {
    const view = document.getElementById('shop-view');
    if (!view) return;

    switch (shopState.activeTab) {
        case 'tab-config': view.innerHTML = renderConfigBase(); break;
        case 'tab-matrix': view.innerHTML = renderMatrix(); break;
        case 'tab-shops': view.innerHTML = renderShops(); break;
        case 'tab-items': view.innerHTML = renderItemsClass(); break;
        case 'tab-shop-types': view.innerHTML = renderShopTypesTags(); break;
        case 'tab-audit': view.innerHTML = renderAudit(); break;
    }
}

// ============================================================================
// VIEWS
// ============================================================================

function renderConfigBase() {
    return `
        <div class="flex flex-col lg:flex-row gap-6 animate-fade-in h-[70vh]">
            
            <div class="w-full lg:w-1/3 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col shadow-lg overflow-hidden">
                <div class="p-4 bg-slate-900 border-b border-slate-700 font-bold text-amber-500 flex justify-between items-center">
                    <span><i class="fas fa-tags mr-2"></i>Tipos de Loja</span>
                    <button onclick="window.shopTools.addShopType()" class="text-xs bg-slate-700 px-3 py-1.5 rounded hover:text-white transition"><i class="fas fa-plus"></i></button>
                </div>
                <div class="flex-grow overflow-y-auto custom-scroll p-4 space-y-2">
                    ${shopState.cache.shopTypes.map(t => `
                        <div class="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-700 group">
                            <input type="text" class="bg-transparent border-none text-white w-full outline-none font-bold text-sm" value="${escapeHTML(t.nome)}" onchange="window.shopTools.updateDocField('rpg_shop_types', '${t.id}', 'nome', this.value)">
                            <button onclick="window.shopTools.deleteDocById('rpg_shop_types', '${t.id}')" class="text-slate-600 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="w-full lg:w-2/3 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col shadow-lg overflow-hidden">
                <div class="p-4 bg-slate-900 border-b border-slate-700 font-bold text-purple-400 flex justify-between items-center">
                    <span><i class="fas fa-gem mr-2"></i>Tiers de Itens (Raridade)</span>
                    <button onclick="window.shopTools.addItemTier()" class="text-xs bg-slate-700 px-3 py-1.5 rounded hover:text-white transition"><i class="fas fa-plus"></i> Novo Tier</button>
                </div>
                <div class="flex-grow overflow-x-auto overflow-y-auto custom-scroll bg-slate-900">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-700 z-10">
                            <tr>
                                <th class="p-3">Nome (ID)</th><th class="p-3 text-center">Prob. Global (%)</th><th class="p-3 text-center">Qtd Min</th><th class="p-3 text-center">Qtd Max</th><th class="p-3 text-center">Valor Min</th><th class="p-3 text-center">Valor Max</th><th class="p-3 text-center">Slots</th><th class="p-3 text-center w-10">Del</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            ${shopState.cache.itemTiers.map(t => `
                                <tr class="hover:bg-slate-800/50">
                                    <td class="p-1"><input class="w-full bg-transparent border-0 text-amber-500 font-bold px-2 py-2 outline-none" value="${escapeHTML(t.nome)}" onchange="window.shopTools.localItemUpdate('${t.id}', 'nome', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-white py-2 outline-none" value="${t.probabilidade||0}" onchange="window.shopTools.localItemUpdate('${t.id}', 'probabilidade', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-white py-2 outline-none" value="${t.qtdMin||1}" onchange="window.shopTools.localItemUpdate('${t.id}', 'qtdMin', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-white py-2 outline-none" value="${t.qtdMax||1}" onchange="window.shopTools.localItemUpdate('${t.id}', 'qtdMax', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-emerald-400 py-2 outline-none" value="${t.valorMin||0}" onchange="window.shopTools.localItemUpdate('${t.id}', 'valorMin', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-emerald-400 py-2 outline-none" value="${t.valorMax||0}" onchange="window.shopTools.localItemUpdate('${t.id}', 'valorMax', this.value)"></td>
                                    <td class="p-1"><input type="number" class="w-full bg-transparent border-0 text-center text-blue-400 font-bold py-2 outline-none" value="${t.slotsOcupados||1}" onchange="window.shopTools.localItemUpdate('${t.id}', 'slotsOcupados', this.value)"></td>
                                    <td class="p-1 text-center"><button onclick="window.shopTools.deleteDocById('rpg_item_tiers', '${t.id}')" class="text-red-600 hover:text-red-400"><i class="fas fa-times"></i></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="p-3 border-t border-slate-700 bg-slate-950 text-right">
                    <button onclick="window.shopTools.saveItemTiers()" class="btn bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded shadow-lg"><i class="fas fa-save mr-2"></i> Salvar Tiers de Itens</button>
                </div>
            </div>
        </div>
    `;
}

function renderMatrix() {
    const itemTiers = shopState.cache.itemTiers;

    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl flex flex-col h-[70vh] shadow-lg animate-fade-in overflow-hidden">
            <div class="p-6 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
                <div>
                    <h2 class="text-xl font-bold text-blue-400 font-cinzel"><i class="fas fa-chess-board mr-2"></i> Matriz de Distribuição & Economia</h2>
                    <p class="text-xs text-slate-400 mt-1">Defina os Tiers das lojas, multiplicadores de caixa e a chance de cada item aparecer nelas.</p>
                </div>
                <button onclick="window.shopTools.addShopTier()" class="btn bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded"><i class="fas fa-plus mr-2"></i> Novo Tier de Loja</button>
            </div>
            
            <div class="flex-grow overflow-auto custom-scroll bg-slate-950 relative">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="sticky top-0 bg-slate-900 text-slate-300 z-10 shadow-md">
                        <tr>
                            <th class="p-4 border-r border-slate-700 min-w-[200px]">Tier da Loja</th>
                            <th class="p-4 border-r border-slate-700 text-center" title="Chance de existir no mapa">Spawn %</th>
                            <th class="p-4 border-r border-slate-700 text-center" title="Multiplica o Caixa Base (${BASE_CASH} CP)">Mult. Caixa</th>
                            ${itemTiers.map(it => `<th class="p-3 border-r border-slate-700 text-center text-purple-300 font-bold truncate max-w-[100px]">% ${escapeHTML(it.nome)}</th>`).join('')}
                            <th class="p-4 text-center w-10">Del</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${shopState.cache.shopTiers.map(shopTier => {
                            const dist = shopTier.distribution || {};
                            return `
                                <tr class="hover:bg-slate-800/50 transition-colors">
                                    <td class="p-1 border-r border-slate-700"><input class="w-full bg-transparent border-0 font-bold text-amber-500 px-3 py-3 outline-none" value="${escapeHTML(shopTier.nome)}" onchange="window.shopTools.localMatrixUpdate('${shopTier.id}', 'nome', this.value)"></td>
                                    <td class="p-1 border-r border-slate-700"><input type="number" class="w-full bg-transparent border-0 text-center text-slate-300 py-3 outline-none" value="${shopTier.probabilidade||0}" onchange="window.shopTools.localMatrixUpdate('${shopTier.id}', 'probabilidade', this.value)"></td>
                                    <td class="p-1 border-r border-slate-700"><input type="number" step="0.1" class="w-full bg-transparent border-0 text-center text-green-400 font-bold py-3 outline-none" value="${shopTier.multiplicadorCaixa||1}" onchange="window.shopTools.localMatrixUpdate('${shopTier.id}', 'multiplicadorCaixa', this.value)"></td>
                                    ${itemTiers.map(it => `<td class="p-1 border-r border-slate-800 bg-slate-900/30 hover:bg-slate-800"><input type="number" class="w-full bg-transparent border-0 text-center text-purple-200 py-3 outline-none" value="${dist[it.id]||0}" onchange="window.shopTools.localMatrixUpdate('${shopTier.id}', 'dist_${it.id}', this.value)"></td>`).join('')}
                                    <td class="p-1 text-center"><button onclick="window.shopTools.deleteDocById('rpg_shop_tiers', '${shopTier.id}')" class="text-red-600 hover:text-red-400"><i class="fas fa-times"></i></button></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="p-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center shrink-0">
                <p class="text-xs text-amber-500/80 italic font-bold">⚠️ Alterações aqui mudam toda a economia futura.</p>
                <div class="flex gap-4">
                    <button onclick="window.shopTools.triggerStockRandomization()" class="btn bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <i class="fas fa-dice mr-2"></i> Rolar Estoques Globais
                    </button>
                    <button onclick="window.shopTools.saveShopMatrix()" class="btn bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded shadow-lg">
                        <i class="fas fa-save mr-2"></i> Salvar Matriz
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderShops() {
    const { field, dir } = shopState.sortConfig;

    const sortedShops = [...shopState.cache.shops].sort((a, b) => {
        let valA = a[field] || ''; let valB = b[field] || '';
        if (field === 'caixaAtual') { valA = Number(valA); valB = Number(valB); } 
        else { valA = valA.toString().toLowerCase(); valB = valB.toString().toLowerCase(); }
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    return `
        <div class="flex flex-col h-[75vh] gap-6 animate-fade-in">
            
            <div class="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shrink-0 shadow-xl">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                    <h3 class="font-bold font-cinzel text-amber-500 text-xl"><i class="fas fa-store mr-2"></i> Criar ou Editar Loja</h3>
                    <button onclick="window.shopTools.resetShopForm()" class="text-xs text-slate-400 hover:text-white uppercase tracking-widest"><i class="fas fa-broom mr-1"></i> Limpar Painel</button>
                </div>
                
                <input type="hidden" id="shop-id">
                
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Nome da Loja</label>
                        <input type="text" id="shop-name" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-amber-500" placeholder="Ex: O Anão Bêbado">
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Cidade/Local</label>
                        <select id="shop-location" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-amber-500">
                            <option value="">-- Local --</option>
                            ${shopState.cache.locations.map(l => `<option value="${escapeHTML(l.name || l.nome)}">${escapeHTML(l.name || l.nome)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Tipos de Venda (Tags)</label>
                        <div id="shop-types-container" class="bg-slate-950 border border-slate-600 rounded p-2 h-24 overflow-y-auto custom-scroll grid grid-cols-1 gap-1">
                            ${shopState.cache.shopTypes.map(t => `
                                <label class="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-800 p-1.5 rounded transition select-none text-slate-300 hover:text-white">
                                    <input type="checkbox" class="shop-type-cb w-3 h-3 bg-slate-900 border-slate-500 rounded text-amber-500" value="${escapeHTML(t.nome)}">
                                    <span>${escapeHTML(t.nome)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Tier Econômico</label>
                        <select id="shop-tier" onchange="window.shopTools.updateEstimatedCash()" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-purple-300 outline-none focus:border-amber-500 font-bold">
                            <option value="">-- Tier (Matriz) --</option>
                            ${shopState.cache.shopTiers.map(t => `<option value="${t.id}">${escapeHTML(t.nome)} (${t.multiplicadorCaixa}x)</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Caixa (CP)</label>
                        <div class="flex gap-2">
                            <input type="number" id="shop-cash" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-amber-400 font-mono outline-none" placeholder="Automático">
                            <button onclick="window.shopTools.updateEstimatedCash()" class="bg-slate-800 hover:bg-slate-700 px-3 rounded border border-slate-600 text-slate-300 transition" title="Recalcular Base"><i class="fas fa-sync-alt"></i></button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Capacidade (Slots)</label>
                        <input type="number" id="shop-slots" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-blue-400 font-mono font-bold outline-none" value="12">
                    </div>
                    <div>
                        <label class="text-xs uppercase text-slate-400 font-bold mb-1 block">Turnos Abertos</label>
                        <div class="flex gap-2 text-xs">
                            <label class="flex items-center gap-1 cursor-pointer bg-slate-950 px-3 py-2 rounded border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition"><input type="checkbox" class="shop-hours" value="Manhã"> M</label>
                            <label class="flex items-center gap-1 cursor-pointer bg-slate-950 px-3 py-2 rounded border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition"><input type="checkbox" class="shop-hours" value="Tarde" checked> T</label>
                            <label class="flex items-center gap-1 cursor-pointer bg-slate-950 px-3 py-2 rounded border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition"><input type="checkbox" class="shop-hours" value="Noite"> N</label>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 bg-slate-950 p-2.5 rounded border border-slate-600">
                        <input type="checkbox" id="shop-visible" class="w-5 h-5 rounded bg-slate-800 border-slate-500 text-green-500 cursor-pointer" checked>
                        <label for="shop-visible" class="text-sm font-bold text-slate-300 cursor-pointer">Loja Visível</label>
                    </div>
                </div>
                
                <button onclick="window.shopTools.saveShop()" class="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg uppercase tracking-widest transition-colors"><i class="fas fa-save mr-2"></i> Salvar Loja</button>
            </div>

            <div class="flex-grow bg-slate-800/80 rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-xl">
                <div class="p-4 bg-slate-900 border-b border-slate-700 font-bold text-xs text-slate-400 uppercase tracking-wider">Lojas no Mundo (Clique na Tabela para Ordenar)</div>
                <div class="overflow-auto custom-scroll relative">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-950 text-slate-300 sticky top-0 shadow-md z-10">
                            <tr>
                                <th class="p-3 cursor-pointer hover:text-white transition" onclick="window.shopTools.sortShops('nome')">Nome <i class="fas fa-sort ml-1 text-slate-600"></i></th>
                                <th class="p-3 cursor-pointer hover:text-white transition" onclick="window.shopTools.sortShops('cidade')">Local <i class="fas fa-sort ml-1 text-slate-600"></i></th>
                                <th class="p-3 cursor-pointer hover:text-white transition" onclick="window.shopTools.sortShops('tipo')">Tags <i class="fas fa-sort ml-1 text-slate-600"></i></th>
                                <th class="p-3 cursor-pointer hover:text-white transition" onclick="window.shopTools.sortShops('tierId')">Tier <i class="fas fa-sort ml-1 text-slate-600"></i></th>
                                <th class="p-3 cursor-pointer hover:text-white transition" onclick="window.shopTools.sortShops('caixaAtual')">Caixa (CP) <i class="fas fa-sort ml-1 text-slate-600"></i></th>
                                <th class="p-3 text-center">Status</th>
                                <th class="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            ${sortedShops.map(shop => {
                                const tier = shopState.cache.shopTiers.find(t => t.id === shop.tierId);
                                const tierName = tier ? tier.nome : 'N/A';
                                const tiposStr = (shop.tipos && shop.tipos.length > 0) ? shop.tipos.join(', ') : (shop.tipo || '-');
                                return `
                                    <tr class="hover:bg-slate-800/50 transition-colors">
                                        <td class="p-3 font-bold text-slate-200">${escapeHTML(shop.nome)}</td>
                                        <td class="p-3 text-xs text-slate-400">${escapeHTML(shop.cidade)}</td>
                                        <td class="p-3 text-[10px] text-sky-400 max-w-[150px] truncate" title="${escapeHTML(tiposStr)}">${escapeHTML(tiposStr)}</td>
                                        <td class="p-3 text-xs font-bold text-purple-400">${escapeHTML(tierName)}</td>
                                        <td class="p-3 text-xs font-mono text-amber-400 font-bold">${shop.caixaAtual} / ${shop.caixaMaximo}</td>
                                        <td class="p-3 text-center">${shop.disponivel ? '<i class="fas fa-eye text-green-500"></i>' : '<i class="fas fa-eye-slash text-red-600"></i>'}</td>
                                        <td class="p-3 text-center flex justify-center gap-2">
                                            <button onclick="window.shopTools.editShop('${shop.id}')" class="w-8 h-8 rounded bg-sky-900/50 hover:bg-sky-600 text-sky-400 hover:text-white flex items-center justify-center transition"><i class="fas fa-edit text-xs"></i></button>
                                            <button onclick="window.shopTools.deleteDocById('rpg_lojas', '${shop.id}')" class="w-8 h-8 rounded bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white flex items-center justify-center transition"><i class="fas fa-trash text-xs"></i></button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderItemsClass() {
    let combined = [
        ...shopState.cache.allItensCadastrados.map(i => ({...i, _source: 'rpg_itensCadastrados'})),
        ...shopState.cache.allItensMochila.map(i => ({...i, _source: 'rpg_itensMochila'}))
    ];

    const search = shopState.typeItemSearch.toLowerCase();
    const sourceF = shopState.typeFilterSource;
    const tagF = shopState.typeFilterTag;

    const filtered = combined.filter(i => {
        if(sourceF !== 'all' && i._source !== (sourceF === 'grimorio' ? 'rpg_itensCadastrados' : 'rpg_itensMochila')) return false;
        if(!i.nome.toLowerCase().includes(search)) return false;
        
        const isClassified = !!i.tierId;
        if(shopState.showOnlyUntagged && isClassified) return false;
        
        if(tagF && tagF === 'NONE' && i.tierId) return false;
        if(tagF && tagF !== 'NONE' && i.tierId !== tagF) return false;

        return true;
    });

    return `
        <div class="flex flex-col h-[75vh] bg-slate-800/60 p-6 rounded-2xl border border-slate-700 animate-fade-in shadow-2xl">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shrink-0 border-b border-slate-700 pb-4">
                <div>
                    <h3 class="font-bold font-cinzel text-blue-400 text-xl"><i class="fas fa-layer-group mr-2"></i> Classificação de Tiers (Base de Preços)</h3>
                    <p class="text-xs text-slate-400 mt-1">Selecione itens e atribua a raridade econômica.</p>
                </div>
                
                <div class="flex items-center bg-slate-900 p-2 rounded-xl border border-slate-700 shadow-inner gap-3">
                    <label class="text-xs font-bold text-amber-500 uppercase tracking-widest pl-2">Ação em Lote:</label>
                    <select id="bulk-tier-select" class="bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-amber-500 text-sm">
                        <option value="">-- Escolher Tier --</option>
                        ${shopState.cache.itemTiers.map(t => `<option value="${t.id}">${escapeHTML(t.nome)}</option>`).join('')}
                    </select>
                    <button onclick="window.shopTools.applyBulkTier()" class="btn bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"><i class="fas fa-check-double mr-2"></i> Injetar Tier</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 shrink-0 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <input type="text" placeholder="Procurar nome do item..." value="${escapeHTML(shopState.typeItemSearch)}" onkeyup="window.shopTools.updateItemsFilter('typeItemSearch', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                <select onchange="window.shopTools.updateItemsFilter('typeFilterSource', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                    <option value="all" ${shopState.typeFilterSource==='all'?'selected':''}>Qualquer Fonte</option>
                    <option value="grimorio" ${shopState.typeFilterSource==='grimorio'?'selected':''}>Equipamentos</option>
                    <option value="mochila" ${shopState.typeFilterSource==='mochila'?'selected':''}>Mochila</option>
                </select>
                <select onchange="window.shopTools.updateItemsFilter('typeFilterTag', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-purple-300 font-bold outline-none focus:border-blue-500" ${shopState.showOnlyUntagged ? 'disabled' : ''}>
                    <option value="">Qualquer Tier (Todos)</option>
                    <option value="NONE" ${shopState.typeFilterTag==='NONE'?'selected':''}>Sem Tier</option>
                    ${shopState.cache.itemTiers.map(t => `<option value="${t.id}" ${shopState.typeFilterTag===t.id?'selected':''}>${escapeHTML(t.nome)}</option>`).join('')}
                </select>

                <label class="flex items-center gap-2 cursor-pointer bg-slate-950 p-2 rounded border border-slate-600 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                    <input type="checkbox" ${shopState.showOnlyUntagged ? 'checked' : ''} onchange="window.shopTools.updateItemsFilter('showOnlyUntagged', this.checked)" class="w-4 h-4 rounded bg-slate-900 border-slate-500 text-amber-500 focus:ring-amber-500">
                    <span>Apenas Itens Não Classificados</span>
                </label>

                <div class="flex justify-between items-center bg-slate-950 border border-slate-600 p-2 rounded gap-2">
                    <span class="text-sm font-bold text-amber-500">${shopState.selectedItems.size} Sel.</span>
                    <div class="flex gap-2">
                        <button onclick="window.shopTools.toggleAllItems(true)" class="text-xs text-blue-400 hover:text-white underline">Todos</button>
                        <button onclick="window.shopTools.toggleAllItems(false)" class="text-xs text-slate-400 hover:text-white underline">Nenhum</button>
                    </div>
                </div>
            </div>

            <div class="flex-grow overflow-auto custom-scroll p-2 bg-slate-950 rounded-xl border border-slate-800">
                ${filtered.length === 0 ? '<p class="text-slate-500 text-center mt-10 italic">Nenhum item filtrado.</p>' : `
                    <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                        ${filtered.map(item => {
                            const isSel = shopState.selectedItems.has(`${item._source}|${item.id}`);
                            const tier = shopState.cache.itemTiers.find(t => t.id === item.tierId);
                            const img = item.imagemUrl || 'https://placehold.co/100x100/1e293b/a1a1aa?text=?';
                            return `
                                <div onclick="window.shopTools.toggleItemSel('${item._source}', '${item.id}')" class="aspect-[1/1.2] bg-slate-900 rounded-lg border flex flex-col relative overflow-hidden cursor-pointer group transition-all ${isSel ? 'border-amber-500 scale-105 shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10' : 'border-slate-700 hover:border-blue-500'}">
                                    <div class="h-[70%] w-full bg-black relative">
                                        <img src="${img}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                                        ${isSel ? `<div class="absolute top-1 right-1 bg-amber-500 text-black w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"><i class="fas fa-check"></i></div>` : ''}
                                    </div>
                                    <div class="h-[30%] bg-gradient-to-t from-slate-950 to-transparent flex flex-col items-center justify-end p-1 pb-1.5 text-center">
                                        <span class="text-[9px] font-bold text-white leading-tight truncate w-full px-1">${escapeHTML(item.nome)}</span>
                                        <span class="text-[8px] font-bold mt-0.5 ${tier ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50' : 'bg-red-900/50 text-red-400 border border-red-700/50'} px-1.5 rounded truncate max-w-full">${tier ? escapeHTML(tier.nome) : 'SEM TIER'}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderShopTypesTags() {
    let combined = [
        ...shopState.cache.allItensCadastrados.map(i => ({...i, _source: 'rpg_itensCadastrados'})),
        ...shopState.cache.allItensMochila.map(i => ({...i, _source: 'rpg_itensMochila'}))
    ];

    const search = shopState.typeItemSearch.toLowerCase();
    const sourceF = shopState.typeFilterSource;
    const tagF = shopState.typeFilterTag;

    const filtered = combined.filter(i => {
        if(sourceF !== 'all' && i._source !== (sourceF === 'grimorio' ? 'rpg_itensCadastrados' : 'rpg_itensMochila')) return false;
        if(!i.nome.toLowerCase().includes(search)) return false;
        
        let hasTag = i.shopTypes && i.shopTypes.length > 0;
        if(shopState.showOnlyUntagged && hasTag) return false;
        
        if(tagF && (!i.shopTypes || !i.shopTypes.includes(tagF))) return false;
        return true;
    });

    return `
        <div class="flex flex-col h-[75vh] bg-slate-800/60 p-6 rounded-2xl border border-slate-700 animate-fade-in shadow-2xl">
            <div class="flex flex-col gap-4 mb-6 shrink-0 bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <h3 class="font-bold text-orange-400 text-xl font-cinzel"><i class="fas fa-tags mr-2"></i> Associação de Lojas (Tags)</h3>
                        <p class="text-xs text-slate-400 mt-1">Marque caixas abaixo e selecione itens para injetar múltiplas categorias neles.</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="window.shopTools.applyTags('add')" class="btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded shadow-lg"><i class="fas fa-plus mr-2"></i> Adicionar Tags</button>
                        <button onclick="window.shopTools.applyTags('remove')" class="btn bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow-lg"><i class="fas fa-minus mr-2"></i> Remover Tags</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800" id="tags-action-container">
                    ${shopState.cache.shopTypes.map(t => `
                        <label class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-600 cursor-pointer hover:bg-slate-700 hover:border-orange-500 transition-colors select-none">
                            <input type="checkbox" class="action-tag-cb w-4 h-4 rounded bg-slate-900 border-slate-500 text-orange-500 focus:ring-orange-500" value="${escapeHTML(t.nome)}">
                            <span class="text-xs font-bold text-slate-300">${escapeHTML(t.nome)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 shrink-0 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <input type="text" placeholder="Buscar nome..." value="${escapeHTML(shopState.typeItemSearch)}" onkeyup="window.shopTools.updateItemsFilter('typeItemSearch', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-orange-500">
                <select onchange="window.shopTools.updateItemsFilter('typeFilterSource', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-white outline-none focus:border-orange-500">
                    <option value="all" ${shopState.typeFilterSource==='all'?'selected':''}>Qualquer Fonte</option>
                    <option value="grimorio" ${shopState.typeFilterSource==='grimorio'?'selected':''}>Equipamentos</option>
                    <option value="mochila" ${shopState.typeFilterSource==='mochila'?'selected':''}>Mochila</option>
                </select>
                <select onchange="window.shopTools.updateItemsFilter('typeFilterTag', this.value)" class="w-full bg-slate-950 border border-slate-600 rounded p-2 text-orange-300 font-bold outline-none focus:border-orange-500" ${shopState.showOnlyUntagged ? 'disabled' : ''}>
                    <option value="">Filtrar por Tag (Todas)</option>
                    ${shopState.cache.shopTypes.map(t => `<option value="${escapeHTML(t.nome)}" ${shopState.typeFilterTag===t.nome?'selected':''}>${escapeHTML(t.nome)}</option>`).join('')}
                </select>

                <label class="flex items-center gap-2 cursor-pointer bg-slate-950 p-2 rounded border border-slate-600 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                    <input type="checkbox" ${shopState.showOnlyUntagged ? 'checked' : ''} onchange="window.shopTools.updateItemsFilter('showOnlyUntagged', this.checked)" class="w-4 h-4 rounded bg-slate-900 border-slate-500 text-orange-500 focus:ring-orange-500">
                    <span>Apenas Itens Sem Tags</span>
                </label>

                <div class="flex justify-between items-center bg-slate-950 border border-slate-600 p-2 rounded gap-2">
                    <span class="text-sm font-bold text-orange-500">${shopState.shopTypeSelectedItems.size} Sel.</span>
                    <div class="flex gap-2">
                        <button onclick="window.shopTools.toggleAllTagsSel(true)" class="text-xs text-blue-400 hover:text-white underline">Todos</button>
                        <button onclick="window.shopTools.toggleAllTagsSel(false)" class="text-xs text-slate-400 hover:text-white underline">Nenhum</button>
                    </div>
                </div>
            </div>

            <div class="flex-grow overflow-auto custom-scroll p-2 bg-slate-950 rounded-xl border border-slate-800">
                ${filtered.length === 0 ? '<p class="text-slate-500 text-center mt-10 italic">Nenhum item filtrado.</p>' : `
                    <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3" id="tags-grid-items">
                        ${filtered.map(item => {
                            const isSel = shopState.shopTypeSelectedItems.has(`${item._source}|${item.id}`);
                            const types = item.shopTypes || [];
                            const img = item.imagemUrl || 'https://placehold.co/100x100/1e293b/a1a1aa?text=?';
                            return `
                                <div onclick="window.shopTools.toggleTagSel('${item._source}', '${item.id}')" data-key="${item._source}|${item.id}" class="tag-card aspect-[1/1.3] bg-slate-900 rounded-lg border flex flex-col relative overflow-hidden cursor-pointer group transition-all ${isSel ? 'border-orange-500 scale-105 shadow-[0_0_10px_rgba(249,115,22,0.5)] z-10' : 'border-slate-700 hover:border-blue-500'}">
                                    <div class="h-[60%] w-full bg-black relative">
                                        <img src="${img}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                                        ${isSel ? `<div class="absolute top-1 right-1 bg-orange-500 text-black w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"><i class="fas fa-check"></i></div>` : ''}
                                    </div>
                                    <div class="h-[40%] bg-gradient-to-t from-slate-950 to-transparent flex flex-col items-center justify-start p-1 text-center border-t border-slate-800">
                                        <span class="text-[9px] font-bold text-white leading-tight truncate w-full px-1 mb-1">${escapeHTML(item.nome)}</span>
                                        <div class="flex flex-wrap gap-0.5 justify-center w-full px-0.5 max-h-[25px] overflow-hidden">
                                            ${types.length > 0 
                                                ? types.map(t => `<span class="text-[7px] font-bold bg-slate-800 text-orange-300 border border-slate-600 px-1 rounded truncate max-w-full">${escapeHTML(t)}</span>`).join('') 
                                                : '<span class="text-[8px] font-bold bg-red-900/30 text-red-400 border border-red-900 px-1 rounded">Sem Tag</span>'}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <div class="mt-6 pt-4 border-t border-slate-700 flex justify-end gap-4 shrink-0">
                <button onclick="window.shopTools.generateMasterList()" class="btn bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center">
                    <i class="fas fa-database mr-2"></i> Atualizar Lista Mestra (Database)
                </button>
            </div>
        </div>
    `;
}

function renderAudit() {
    return `
        <div class="flex flex-col h-[75vh] bg-slate-800/60 p-6 rounded-2xl border border-slate-700 animate-fade-in shadow-2xl">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shrink-0 bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner">
                <div>
                    <h3 class="font-bold text-emerald-400 font-cinzel text-xl"><i class="fas fa-clipboard-check mr-2"></i> Auditoria de Estoque</h3>
                    <p class="text-xs text-slate-400 mt-1">Visualize o conteúdo físico e econômico gerado dentro de cada loja.</p>
                </div>
                
                <div class="flex items-center gap-3 w-full md:w-auto">
                    <label class="text-sm font-bold text-slate-300 uppercase">Loja Analisada:</label>
                    <select id="audit-shop-select" onchange="window.shopTools.renderAuditInventory(this.value)" class="w-full md:w-64 bg-slate-950 border border-slate-600 p-3 rounded-lg text-emerald-300 font-bold outline-none focus:border-emerald-500">
                        <option value="">-- Selecione uma Loja --</option>
                        ${shopState.cache.shops.map(s => `<option value="${s.id}">${escapeHTML(s.nome)} (${escapeHTML(s.cidade)})</option>`).join('')}
                    </select>
                    <button onclick="window.shopTools.renderAuditInventory(document.getElementById('audit-shop-select').value)" class="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition-colors" title="Forçar Atualização"><i class="fas fa-sync"></i></button>
                </div>
            </div>

            <div id="audit-shop-info" class="hidden grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div class="text-center border-r border-slate-700">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Caixa Disponível (CP)</div>
                    <div id="audit-cash" class="text-2xl font-mono text-amber-400 font-bold">0</div>
                </div>
                <div class="text-center border-r border-slate-700">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Ocupação (Slots Físicos)</div>
                    <div id="audit-slots" class="text-2xl font-mono text-blue-400 font-bold">0 / 0</div>
                </div>
                <div class="text-center border-r border-slate-700">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Tier da Matriz</div>
                    <div id="audit-tier" class="text-2xl font-cinzel text-purple-400 font-bold truncate px-2">-</div>
                </div>
                <div class="text-center flex flex-col justify-center">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Última Reposição G.</div>
                    <div id="audit-date" class="text-xs text-slate-300">-</div>
                </div>
            </div>

            <div class="flex-grow overflow-auto custom-scroll border border-slate-700 rounded-xl bg-slate-950 shadow-inner">
                <table class="w-full text-left text-sm border-collapse">
                    <thead class="bg-slate-900 text-emerald-500 uppercase text-[10px] font-bold sticky top-0 shadow-md z-10">
                        <tr>
                            <th class="p-3 border-b border-r border-slate-800 text-center w-16">Foto</th>
                            <th class="p-3 border-b border-r border-slate-800">Nome na Prateleira</th>
                            <th class="p-3 border-b border-r border-slate-800 text-center">Raridade (Tier)</th>
                            <th class="p-3 border-b border-r border-slate-800 text-center">Qtd Atual</th>
                            <th class="p-3 border-b border-r border-slate-800 text-center text-red-400" title="Preço que o jogador paga para comprar da loja">Compra P/ Jogador</th>
                            <th class="p-3 border-b border-slate-800 text-center text-green-400" title="Preço que a loja paga ao jogador pelo item">Venda P/ Loja</th>
                        </tr>
                    </thead>
                    <tbody id="audit-inventory-body" class="divide-y divide-slate-800 text-slate-300">
                        <tr><td colspan="6" class="text-center p-12 text-slate-500 italic text-lg">Selecione uma loja acima para investigar.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// AÇÕES EXPOSTAS (WINDOW)
// ------------------------------------------------------------------------------------
window.shopTools = {
    // ---- 1. CONFIGURAÇÕES BASE ----
    addShopType: async () => {
        const nome = prompt("Nome da nova Tag de Loja (Ex: Ferreiro, Ervas, Magia):");
        if(nome) {
            await setDoc(doc(collection(db, 'rpg_shop_types')), { nome, criadoEm: serverTimestamp() });
            loadAllData();
        }
    },
    addItemTier: async () => {
        const newId = prompt("Nome do Tier de Item (Ex: Comum, Raro, S, A):");
        if(newId) {
            await setDoc(doc(db, 'rpg_item_tiers', newId), { nome: newId, probabilidade: 10, qtdMin: 1, qtdMax: 5, valorMin: 10, valorMax: 50, slotsOcupados: 1 });
            loadAllData();
        }
    },
    localItemUpdate: (id, field, val) => {
        const t = shopState.cache.itemTiers.find(i => i.id === id);
        if(t) t[field] = isNaN(val) ? val : Number(val);
    },
    saveItemTiers: async () => {
        setLoading(true, 'Salvando Tiers de Itens...');
        const batch = writeBatch(db);
        shopState.cache.itemTiers.forEach(t => { batch.update(doc(db, 'rpg_item_tiers', t.id), t); });
        await batch.commit();
        loadAllData();
    },
    deleteDocById: async (colName, id) => {
        if(!confirm("Tem certeza absoluta? Isso pode quebrar a economia.")) return;
        await deleteDoc(doc(db, colName, id));
        loadAllData();
    },

    // ---- 2. MATRIZ ----
    addShopTier: async () => {
        const name = prompt("Nome do Tier de Loja (Ex: Pobre, Luxo, Capital):");
        if(name) {
            await setDoc(doc(collection(db, 'rpg_shop_tiers')), { nome: name, probabilidade: 10, multiplicadorCaixa: 1.0, distribution: {} });
            loadAllData();
        }
    },
    localMatrixUpdate: (shopTierId, key, val) => {
        const t = shopState.cache.shopTiers.find(i => i.id === shopTierId);
        if(!t) return;
        if (key.startsWith('dist_')) {
            const itemTierId = key.replace('dist_', '');
            if (!t.distribution) t.distribution = {};
            t.distribution[itemTierId] = Number(val);
        } else {
            t[key] = key === 'nome' ? val : Number(val);
        }
    },
    saveShopMatrix: async () => {
        setLoading(true, 'Consolidando Matriz Global...');
        const batch = writeBatch(db);
        shopState.cache.shopTiers.forEach(t => { batch.update(doc(db, 'rpg_shop_tiers', t.id), t); });
        await batch.commit();
        loadAllData();
    },
    triggerStockRandomization: async () => {
        if(!confirm("PERIGO: Isso vai recriar o estoque de TODAS as lojas com base nos números atuais desta matriz. Continuar?")) return;
        setLoading(true, 'Processando Função de Randomização Econômica...');
        
        // Simulação da Função 12 (Client Side Stock Update)
        try {
            if(shopState.cache.masterList.length === 0) throw new Error("Lista Mestra Vazia. Gere-a na Aba 5.");
            const itemsByTier = {};
            shopState.cache.masterList.forEach(item => {
                if(!itemsByTier[item.tierId]) itemsByTier[item.tierId] = [];
                itemsByTier[item.tierId].push(item);
            });

            let shopsUpdated = 0;
            const updates = [];

            for (const shop of shopState.cache.shops) {
                const shopTier = shopState.cache.shopTiers.find(t => t.id === shop.tierId);
                if (!shopTier || !shopTier.distribution) continue;

                const shopSpawnRoll = Math.random() * 100;
                if (shopSpawnRoll > (Number(shopTier.probabilidade)||100)) {
                    updates.push(updateDoc(doc(db, "rpg_lojas", shop.id), { itensEstoque: {}, disponivel: false, ultimaAtualizacaoEstoque: serverTimestamp() }));
                    shopsUpdated++;
                    continue;
                }

                const maxSlots = parseInt(shop.slots || 12);
                const shopTypes = shop.tipos || (shop.tipo ? [shop.tipo] : []);
                const newInventory = {};
                let currentSlotsUsed = 0;

                const tierWeights = [];
                for (const [tId, chance] of Object.entries(shopTier.distribution)) {
                    if (chance > 0) tierWeights.push({ id: tId, weight: chance });
                }
                const totalWeight = tierWeights.reduce((acc, curr) => acc + curr.weight, 0);

                let attempts = 0;
                while (currentSlotsUsed < maxSlots && attempts < 150 && totalWeight > 0) {
                    attempts++;
                    let rollMatrix = Math.random() * totalWeight;
                    let targetTierId = null;
                    for (const tw of tierWeights) {
                        if (rollMatrix <= tw.weight) { targetTierId = tw.id; break; }
                        rollMatrix -= tw.weight;
                    }
                    if (!targetTierId) continue;

                    const tierConfig = shopState.cache.itemTiers.find(t => t.id === targetTierId);
                    const itemsOfTier = itemsByTier[targetTierId] || [];
                    if (!tierConfig || itemsOfTier.length === 0) continue;

                    const validItems = itemsOfTier.filter(item => {
                        if (shopTypes.length === 0) return true;
                        if (item.shopTypes && Array.isArray(item.shopTypes)) return shopTypes.some(t => item.shopTypes.includes(t));
                        return false;
                    });
                    if (validItems.length === 0) continue;

                    const randomItem = validItems[Math.floor(Math.random() * validItems.length)];
                    if ((Math.random() * 100) > (tierConfig.probabilidade || 100)) continue;

                    const slotsCost = parseInt(tierConfig.slotsOcupados || 1);
                    if (currentSlotsUsed + slotsCost > maxSlots) continue;

                    const minQ = parseInt(tierConfig.qtdMin || 1); const maxQ = parseInt(tierConfig.qtdMax || 1);
                    const qty = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;

                    const minP = parseInt(tierConfig.valorMin || 1); const maxP = parseInt(tierConfig.valorMax || 10);
                    const price = Math.floor(Math.random() * (maxP - minP + 1)) + minP;

                    if (newInventory[randomItem.id]) {
                        newInventory[randomItem.id].estoqueAtual += qty;
                        newInventory[randomItem.id].estoqueMaximo += qty;
                        currentSlotsUsed += slotsCost;
                    } else {
                        newInventory[randomItem.id] = {
                            nome: randomItem.nome, imagemUrl: randomItem.imagemUrl,
                            estoqueAtual: qty, estoqueMaximo: qty,
                            precoCompra: price, precoVenda: Math.floor(price * 0.5),
                            tierId: randomItem.tierId, slotsOcupados: slotsCost
                        };
                        currentSlotsUsed += slotsCost;
                    }
                }

                updates.push(updateDoc(doc(db, "rpg_lojas", shop.id), {
                    itensEstoque: newInventory, disponivel: true, 
                    caixaAtual: shop.caixaMaximo || 1000, ultimaAtualizacaoEstoque: serverTimestamp()
                }));
                shopsUpdated++;
            }

            const CHUNK = 500;
            for (let i = 0; i < updates.length; i += CHUNK) await Promise.all(updates.slice(i, i + CHUNK));
            
            alert(`Sincronização Perfeita! ${shopsUpdated} Lojas reabastecidas.`);
            loadAllData();
        } catch(e) {
            alert("Erro Fatal: " + e.message);
            loadAllData();
        }
    },

    // ---- 3. LOJAS ----
    updateEstimatedCash: () => {
        const tierId = document.getElementById('shop-tier').value;
        const tier = shopState.cache.shopTiers.find(t => t.id === tierId);
        if(tier) document.getElementById('shop-cash').value = Math.floor(BASE_CASH * (tier.multiplicadorCaixa || 1));
    },
    resetShopForm: () => {
        document.getElementById('shop-id').value = "";
        document.getElementById('shop-name').value = "";
        document.getElementById('shop-cash').value = "";
        document.getElementById('shop-location').value = "";
        document.getElementById('shop-tier').value = "";
        document.querySelectorAll('.shop-type-cb').forEach(cb => cb.checked = false);
    },
    editShop: (id) => {
        const shop = shopState.cache.shops.find(s => s.id === id);
        if(!shop) return;
        document.getElementById('shop-id').value = shop.id;
        document.getElementById('shop-name').value = shop.nome;
        document.getElementById('shop-location').value = shop.cidade;
        document.getElementById('shop-tier').value = shop.tierId;
        document.getElementById('shop-cash').value = shop.caixaMaximo;
        document.getElementById('shop-slots').value = shop.slots || 12;
        document.getElementById('shop-visible').checked = shop.disponivel;
        document.querySelectorAll('.shop-hours').forEach(cb => cb.checked = shop.horariosFuncionamento?.includes(cb.value));
        const shopTypes = shop.tipos || (shop.tipo ? [shop.tipo] : []);
        document.querySelectorAll('.shop-type-cb').forEach(cb => cb.checked = shopTypes.includes(cb.value));
    },
    saveShop: async () => {
        const id = document.getElementById('shop-id').value;
        const nome = document.getElementById('shop-name').value;
        const cidade = document.getElementById('shop-location').value;
        const tierId = document.getElementById('shop-tier').value;
        const caixaMax = parseInt(document.getElementById('shop-cash').value) || BASE_CASH;
        const disponivel = document.getElementById('shop-visible').checked;
        const slots = parseInt(document.getElementById('shop-slots').value) || 12;
        const horarios = Array.from(document.querySelectorAll('.shop-hours:checked')).map(cb => cb.value);
        const tipos = Array.from(document.querySelectorAll('.shop-type-cb:checked')).map(cb => cb.value);

        if(!nome || !cidade || !tierId) return alert("Preencha Nome, Cidade e Tier.");
        if(tipos.length === 0) return alert("Selecione pelo menos um Tipo de loja.");

        const data = { nome, cidade, tierId, slots, tipos, tipo: tipos[0], caixaMaximo: caixaMax, caixaAtual: caixaMax, horariosFuncionamento: horarios, disponivel, atualizadoEm: serverTimestamp(), itensEstoque: {} };

        try {
            setLoading(true, "Registrando Planta...");
            if(id) {
                const old = shopState.cache.shops.find(s => s.id === id);
                if(old) { data.caixaAtual = old.caixaAtual; data.itensEstoque = old.itensEstoque || {}; data.criadoEm = old.criadoEm; }
                await updateDoc(doc(db, 'rpg_lojas', id), data);
            } else {
                data.criadoEm = new Date().toISOString();
                await setDoc(doc(collection(db, 'rpg_lojas')), data);
            }
            window.shopTools.resetShopForm();
            loadAllData();
        } catch(e) { alert("Erro: " + e.message); loadAllData(); }
    },
    sortShops: (field) => {
        if (shopState.sortConfig.field === field) shopState.sortConfig.dir = shopState.sortConfig.dir === 'asc' ? 'desc' : 'asc';
        else { shopState.sortConfig.field = field; shopState.sortConfig.dir = 'asc'; }
        renderActiveView();
    },

    // ---- 4. ATRIBUIÇÃO DE TIERS ----
    updateItemsFilter: (key, val) => { shopState[key] = val; renderActiveView(); },
    toggleItemSel: (source, id) => {
        const k = `${source}|${id}`;
        if(shopState.selectedItems.has(k)) shopState.selectedItems.delete(k); else shopState.selectedItems.add(k);
        renderActiveView();
    },
    toggleAllItems: (checkAll) => {
        const container = document.getElementById('grid-items-classification');
        if(!container) return;
        const cards = container.querySelectorAll('.item-card');
        cards.forEach(c => {
            const k = c.dataset.key;
            if(checkAll) shopState.selectedItems.add(k); else shopState.selectedItems.delete(k);
        });
        renderActiveView();
    },
    applyBulkTier: async () => {
        const tierId = document.getElementById('bulk-tier-select').value;
        if(!tierId) return alert("Selecione um Tier de Raridade.");
        if(shopState.selectedItems.size === 0) return alert("Selecione itens no grid.");
        if(!confirm(`Atribuir Tier "${tierId}" para ${shopState.selectedItems.size} itens?`)) return;

        setLoading(true, "Alterando Raridades...");
        const promises = [];
        shopState.selectedItems.forEach(key => {
            const [source, id] = key.split('|');
            promises.push(updateDoc(doc(db, source, id), { tierId: tierId }));
        });

        try {
            await Promise.all(promises);
            shopState.selectedItems.clear();
            loadAllData();
        } catch(e) { alert("Erro: " + e.message); loadAllData(); }
    },

    // ---- 5. TIPOS DE LOJA (TAGS) ----
    toggleTagSel: (source, id) => {
        const k = `${source}|${id}`;
        if(shopState.shopTypeSelectedItems.has(k)) shopState.shopTypeSelectedItems.delete(k); else shopState.shopTypeSelectedItems.add(k);
        renderActiveView();
    },
    toggleAllTagsSel: (checkAll) => {
        const container = document.getElementById('tags-grid-items');
        if(!container) return;
        container.querySelectorAll('.tag-card').forEach(c => {
            const k = c.dataset.key;
            if(checkAll) shopState.shopTypeSelectedItems.add(k); else shopState.shopTypeSelectedItems.delete(k);
        });
        renderActiveView();
    },
    applyTags: async (mode) => {
        const selectedTags = Array.from(document.querySelectorAll('.action-tag-cb:checked')).map(cb => cb.value);
        if(selectedTags.length === 0) return alert("Marque as Tags que deseja Injetar/Remover no painel acima.");
        if(shopState.shopTypeSelectedItems.size === 0) return alert("Selecione itens no grid.");
        if(!confirm(`${mode === 'add' ? 'Adicionar' : 'Remover'} tags [${selectedTags.join(', ')}] em ${shopState.shopTypeSelectedItems.size} itens?`)) return;

        setLoading(true, "Modificando Tags de Categoria...");
        const promises = [];
        shopState.shopTypeSelectedItems.forEach(key => {
            const [source, id] = key.split('|');
            const ref = doc(db, source, id);
            
            let item = source === 'rpg_itensCadastrados' ? shopState.cache.allItensCadastrados.find(i=>i.id===id) : shopState.cache.allItensMochila.find(i=>i.id===id);
            if(item) {
                let types = new Set(item.shopTypes || []);
                selectedTags.forEach(tag => { if(mode === 'add') types.add(tag); else types.delete(tag); });
                promises.push(updateDoc(ref, { shopTypes: Array.from(types) }));
            }
        });

        try {
            await Promise.all(promises);
            shopState.shopTypeSelectedItems.clear();
            loadAllData();
        } catch(e) { alert("Erro: " + e.message); loadAllData(); }
    },
    generateMasterList: async () => {
        if(!confirm("Escanear TODO o DB e criar Lista Mestra Base de Preços?")) return;
        setLoading(true, "Consolidando Base Financeira. Pode demorar...");
        try {
            const all = [...shopState.cache.allItensCadastrados, ...shopState.cache.allItensMochila];
            const u = new Map();
            all.forEach(i => {
                if(!i.tierId) return; 
                const tier = shopState.cache.itemTiers.find(t => t.id === i.tierId);
                if(!tier) return; 
                const base = Math.floor((tier.valorMin + tier.valorMax) / 2);
                u.set(i.id, {
                    id: i.id, nome: i.nome, imagemUrl: i.imagemUrl || "",
                    tierId: i.tierId, shopTypes: i.shopTypes || [], basePrice: base,
                    raridadeId: i.raridadeId || tier.nome, slotsOcupados: Number(tier.slotsOcupados)||1,
                    probabilidadeGlobal: Number(tier.probabilidade)||100, updatedAt: serverTimestamp()
                });
            });
            const p = []; let c = 0;
            for (const [id, data] of u) {
                p.push(setDoc(doc(db, "rpg_balanceamento_itens_precos_geral", id), data));
                c++;
                if(c % 500 === 0) { await Promise.all(p); p.length = 0; }
            }
            await Promise.all(p);
            alert(`Selo Econômico Ouro: ${c} itens registrados.`);
            loadAllData();
        } catch(e) { alert(e.message); loadAllData(); }
    },

    // ---- 6. AUDITORIA ----
    renderAuditInventory: (shopId) => {
        const tbody = document.getElementById('audit-inventory-body');
        const info = document.getElementById('audit-shop-info');
        if(!shopId) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-12 text-slate-500 italic text-lg">Selecione uma loja para investigar.</td></tr>';
            info.classList.add('hidden');
            return;
        }

        const shop = shopState.cache.shops.find(s => s.id === shopId);
        if(!shop) return;

        info.classList.remove('hidden');
        document.getElementById('audit-cash').textContent = shop.caixaAtual || shop.caixaMaximo || 0;
        document.getElementById('audit-slots').textContent = `${Object.keys(shop.itensEstoque||{}).length} / ${shop.slots || 12}`;
        const tier = shopState.cache.shopTiers.find(t => t.id === shop.tierId);
        document.getElementById('audit-tier').textContent = tier ? tier.nome : shop.tierId;
        
        let dateStr = "Nunca";
        if(shop.ultimaAtualizacaoEstoque) dateStr = new Date(shop.ultimaAtualizacaoEstoque.seconds * 1000).toLocaleString('pt-BR');
        document.getElementById('audit-date').textContent = dateStr;

        const items = Object.entries(shop.itensEstoque || {});
        if(items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-12 text-amber-500 font-bold">Lojas vazias! Rode o Sorteio Global de Matriz na Aba 2.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(([id, d]) => {
            const itemTier = shopState.cache.itemTiers.find(t => t.id === d.tierId);
            const tName = itemTier ? itemTier.nome : (d.tierId || '-');
            return `
                <tr class="hover:bg-slate-800/50 transition border-b border-slate-800/50">
                    <td class="p-2 text-center"><img src="${d.imagemUrl||''}" class="w-10 h-10 object-contain mx-auto rounded border border-slate-600 bg-slate-900"></td>
                    <td class="p-2 font-bold text-slate-200">${escapeHTML(d.nome)}</td>
                    <td class="p-2 text-center text-xs font-bold text-purple-400 bg-slate-900/40">${escapeHTML(tName)}</td>
                    <td class="p-2 text-center font-bold text-white bg-slate-900 border-x border-slate-800">${d.estoqueAtual} <span class="text-slate-500 text-[10px]">/ ${d.estoqueMaximo}</span></td>
                    <td class="p-2 text-center font-mono text-amber-400 font-bold bg-red-900/10">${d.precoCompra} CP</td>
                    <td class="p-2 text-center font-mono text-emerald-500 bg-green-900/10">${d.precoVenda} CP</td>
                </tr>
            `;
        }).join('');
    }
};