import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';

let repState = {
    activeTab: 'buildings', // buildings, allies
    activeView: 'list', // list, form
    cache: { buildings: [], allies: [], items: [] },
    
    editingId: null,
    pendingImage: null,
    
    // Arrays temporários do Form
    formResources: {
        custoConstrucao: [],
        custoManutencao: [],
        producaoPassiva: [],
        estabelecimentosPermitidos: []
    }
};

export async function renderCadastroReputacaoTab() {
    const container = document.getElementById('cadastro-reputacao-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-amber-900/50 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left flex items-center gap-4">
                    <div class="p-4 bg-amber-500/10 rounded-full border-2 border-amber-500/30 text-amber-500 text-3xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <i class="fas fa-chess-rook"></i>
                    </div>
                    <div>
                        <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Gestor de Império</h1>
                        <p class="text-slate-400 mt-2 text-sm italic uppercase tracking-[0.2em] font-bold">Recursos & Reputação</p>
                    </div>
                </div>
                
                <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-700 shadow-lg" id="rep-tabs-nav">
                    <button class="rep-tab-btn active" data-tab="buildings">Estabelecimentos</button>
                    <button class="rep-tab-btn" data-tab="allies">Aliados (NPCs)</button>
                </div>
            </header>

            <div id="rep-dynamic-content" class="w-full relative min-h-[500px]">
                <div id="rep-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 mb-4"></div>
                    <p class="text-amber-500 font-cinzel tracking-widest">Calculando Impostos...</p>
                </div>
                <div id="rep-view" class="w-full hidden"></div>
            </div>

        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('rep-tabs-nav');
    if (!nav) return;

    const baseClasses = ['px-6', 'py-3', 'rounded-lg', 'font-bold', 'text-sm', 'transition-all', 'uppercase', 'tracking-wider'];
    const activeClasses = ['bg-amber-600', 'text-slate-950', 'shadow-lg'];
    const inactiveClasses = ['text-slate-400', 'hover:text-white', 'hover:bg-slate-800'];

    nav.querySelectorAll('.rep-tab-btn').forEach(btn => {
        btn.classList.add(...baseClasses);
        if (btn.dataset.tab === repState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
        } else {
            btn.classList.add(...inactiveClasses);
            btn.classList.remove(...activeClasses);
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.rep-tab-btn');
        if (btn) {
            repState.activeTab = btn.dataset.tab;
            repState.activeView = 'list';
            repState.editingId = null;
            setupTabs(); 
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        const [buildSnap, allySnap, icSnap, imSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_estabelecimentos_templates'), orderBy('nome'))),
            getDocs(query(collection(db, 'rpg_aliados_templates'), orderBy('nome'))),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila'))
        ]);

        const rawItems = [...icSnap.docs, ...imSnap.docs].map(d => ({ id: d.id, ...d.data() }));
        const itemMap = new Map();
        
        // Deduplicação Inteligente do código original
        rawItems.forEach(item => {
            const existing = itemMap.get(item.id);
            if (!existing || (!existing.imagemUrl && item.imagemUrl)) {
                itemMap.set(item.id, item);
            }
        });

        const uniqueItems = Array.from(itemMap.values()).filter(i => i.nome).sort((a,b) => a.nome.localeCompare(b.nome));

        repState.cache = {
            buildings: buildSnap.docs.map(d => ({id: d.id, ...d.data()})),
            allies: allySnap.docs.map(d => ({id: d.id, ...d.data()})),
            items: uniqueItems
        };

        document.getElementById('rep-loading').classList.add('hidden');
        document.getElementById('rep-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('rep-loading').innerHTML = '<p class="text-red-500 font-bold p-10">Erro fatal ao carregar Banco do Império.</p>';
    }
}

function renderActiveView() {
    const view = document.getElementById('rep-view');
    if (!view) return;

    if (repState.activeView === 'form') {
        if(repState.activeTab === 'buildings') view.innerHTML = renderBuildingForm();
        else view.innerHTML = renderAllyForm();
    } else {
        view.innerHTML = renderList();
    }
}

// ============================================================================
// UI DE LISTAGEM
// ============================================================================
function renderList() {
    const isBuilding = repState.activeTab === 'buildings';
    const list = isBuilding ? repState.cache.buildings : repState.cache.allies;
    const btnText = isBuilding ? 'Criar Novo Estabelecimento' : 'Criar Novo Aliado';

    let html = `
        <div class="mb-8">
            <button onclick="window.repTools.newItem()" class="w-full py-5 bg-gradient-to-r from-amber-700 to-amber-600 hover:brightness-110 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition font-cinzel text-xl tracking-widest border border-amber-500/50">
                <i class="fas fa-plus"></i> ${btnText}
            </button>
        </div>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
    `;

    if (list.length === 0) {
        html += `<div class="col-span-full text-center p-10 text-slate-500 italic text-lg bg-slate-900 rounded-xl border border-slate-800">Nenhum registro encontrado.</div>`;
    } else {
        list.forEach(item => {
            const tag = item.tipo || (item.custoConstrucao ? 'Construção' : 'Item');
            html += `
                <div class="bg-[#1c1917] border-2 border-[#475569] rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:border-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] group flex flex-col aspect-[1/1.3] relative" onclick="window.repTools.editItem('${item.id}')">
                    <div class="relative h-[80%] overflow-hidden bg-black">
                        <img src="${item.imagemUrl || 'https://placehold.co/400x300/1e293b/a1a1aa?text=Img'}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-[#1c1917] via-transparent to-transparent"></div>
                    </div>
                    <div class="flex-grow p-2 text-center flex flex-col items-center justify-center bg-gradient-to-t from-[#292524] to-[#1c1917]">
                        <h4 class="text-amber-500 font-bold font-cinzel leading-tight">${escapeHTML(item.nome)}</h4>
                        <span class="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">${escapeHTML(tag)}</span>
                    </div>
                    <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="event.stopPropagation(); window.repTools.deleteItem('${item.id}', '${escapeHTML(item.nome)}')" class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-500 shadow-lg"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    return html;
}

// ============================================================================
// HELPERS HTML PARA RECURSOS E PRÉDIOS
// ============================================================================
function renderResourcePicker(label, listKey) {
    const list = repState.formResources[listKey];
    
    let itemsHtml = list.length === 0 ? '<p class="text-sm text-slate-500 text-center italic py-4">Nenhum item configurado.</p>' : list.map((res, idx) => `
        <div class="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-700 group hover:border-amber-500 transition-colors mb-2">
            <div class="flex items-center gap-3">
                <img src="${res.imagemUrl || 'https://placehold.co/32x32/1e293b/white?text=?'}" class="w-8 h-8 rounded bg-black object-cover border border-slate-600">
                <span class="text-sm text-slate-200 font-bold">${escapeHTML(res.nome)}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-amber-400 font-mono font-bold bg-black/40 px-3 py-1 rounded shadow-inner">x${res.qtd}</span>
                <button type="button" onclick="window.repTools.removeResource('${listKey}', ${idx})" class="text-red-500 hover:text-red-400 p-2 rounded transition"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    return `
        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700 shadow-lg hover:border-amber-900/50 transition-colors">
            <label class="mb-3 block text-amber-500 font-bold text-xs uppercase tracking-widest">${label}</label>
            <div class="flex flex-col md:flex-row gap-3 mb-4">
                <div class="flex-grow flex gap-2">
                    <input type="text" id="filter-${listKey}" placeholder="Filtrar..." onkeyup="window.repTools.updateDropdownFilter('${listKey}')" class="w-1/3 bg-slate-950 border border-slate-600 rounded p-3 text-white text-sm outline-none focus:border-amber-500">
                    <select id="select-${listKey}" class="w-2/3 bg-slate-950 border border-slate-600 rounded p-3 text-white text-sm outline-none focus:border-amber-500 cursor-pointer">
                        <option value="">Selecione um recurso...</option>
                        ${repState.cache.items.slice(0, 100).map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-2 shrink-0 md:w-48">
                    <input type="number" id="qty-${listKey}" min="1" value="1" class="w-20 bg-slate-950 border border-slate-600 rounded p-3 text-amber-400 font-bold text-center outline-none focus:border-amber-500">
                    <button type="button" onclick="window.repTools.addResource('${listKey}')" class="flex-grow bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded flex items-center justify-center transition-colors"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <div class="max-h-48 overflow-y-auto custom-scroll pr-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                ${itemsHtml}
            </div>
        </div>
    `;
}

function renderBuildingSelector() {
    const selectedIds = repState.formResources.estabelecimentosPermitidos;
    const bHtml = repState.cache.buildings.map(b => {
        const isSelected = selectedIds.includes(b.id);
        return `
            <div onclick="window.repTools.toggleBuilding('${b.id}')" class="relative border-2 rounded-xl cursor-pointer overflow-hidden transition-all group aspect-square flex flex-col ${isSelected ? 'border-amber-500 scale-[1.02] shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'}">
                <div class="flex-grow w-full bg-black relative">
                    <img src="${b.imagemUrl || 'https://placehold.co/100x100/1e293b/white?text=?'}" class="w-full h-full object-cover">
                    ${isSelected ? '<div class="absolute inset-0 bg-amber-500/20"></div>' : ''}
                </div>
                <div class="h-10 flex items-center justify-center p-1 text-center transition-colors ${isSelected ? 'bg-amber-900/90' : 'bg-black/90'}">
                    <span class="text-[10px] font-bold leading-tight ${isSelected ? 'text-amber-400' : 'text-slate-400'}">${escapeHTML(b.nome)}</span>
                </div>
                ${isSelected ? '<div class="absolute top-2 right-2 bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black shadow-lg z-10"><i class="fas fa-check"></i></div>' : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-700 shadow-lg hover:border-amber-900/50 transition-colors mt-4">
            <label class="mb-4 block text-amber-500 font-bold text-xs uppercase tracking-widest">Locais de Trabalho Permitidos</label>
            ${repState.cache.buildings.length === 0 ? '<p class="text-slate-500 italic text-center py-4">Nenhum estabelecimento cadastrado.</p>' : `
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-80 overflow-y-auto custom-scroll p-2">
                    ${bHtml}
                </div>
            `}
        </div>
    `;
}

// ============================================================================
// UI DE FORMULÁRIO: ESTABELECIMENTO
// ============================================================================
function renderBuildingForm() {
    const isEdit = repState.editingId !== null;
    const data = isEdit ? repState.cache.buildings.find(b => b.id === repState.editingId) : {};

    return `
        <div class="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-32 animate-fade-in">
            <div class="flex justify-between items-center bg-[#171717] p-6 rounded-xl border border-amber-900/50 shadow-md">
                <h2 class="text-3xl font-cinzel text-amber-500 font-bold flex items-center gap-3"><i class="fas fa-castle"></i> ${isEdit ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</h2>
                <button onclick="window.repTools.closeForm()" class="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-2 rounded-lg transition-colors uppercase tracking-widest text-xs">Cancelar</button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div class="lg:col-span-5 space-y-6">
                    <div class="bg-[#171717] border border-slate-700 p-6 rounded-xl shadow-lg">
                        <h3 class="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-3 font-cinzel">Perfil da Construção</h3>
                        
                        <div class="mb-6">
                            <label class="mb-2 block text-xs font-bold text-amber-500 uppercase tracking-widest">Imagem do Modelo</label>
                            <div class="relative w-full h-64 bg-black rounded-xl border-2 border-dashed border-slate-600 overflow-hidden group mb-2 flex items-center justify-center" id="img-container">
                                <img id="f-preview" src="${data.imagemUrl||''}" class="w-full h-full object-cover ${data.imagemUrl ? '' : 'hidden'}">
                                <div id="f-placeholder" class="flex flex-col items-center text-slate-500 ${data.imagemUrl ? 'hidden' : ''}">
                                    <i class="fas fa-upload text-4xl mb-2 text-amber-500"></i>
                                    <span class="text-sm font-bold uppercase tracking-wide">Upload (Max 2MB)</span>
                                </div>
                            </div>
                            <input type="file" id="f-img" accept="image/*" onchange="window.repTools.previewImage(this)" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-slate-900 file:font-bold cursor-pointer">
                        </div>

                        <div class="space-y-4">
                            <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Nome do Estabelecimento</label><input type="text" id="f-nome" value="${escapeHTML(data.nome||'')}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-amber-100 font-bold text-lg outline-none focus:border-amber-500"></div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Custo Reputação</label><input type="number" id="f-custoRep" value="${data.reputacaoCusto||0}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-red-400 font-bold text-center outline-none focus:border-red-500"></div>
                                <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Gera Reputação</label><input type="number" id="f-geraRep" value="${data.reputacaoGerada||0}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-green-400 font-bold text-center outline-none focus:border-green-500"></div>
                            </div>
                            
                            <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Vagas de Trabalho (Slots)</label><input type="number" id="f-slots" value="${data.slotsTrabalho||1}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white text-center font-mono outline-none focus:border-amber-500"></div>
                            
                            <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Descrição</label><textarea id="f-desc" rows="4" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-slate-300 outline-none focus:border-amber-500 custom-scroll text-sm">${escapeHTML(data.descricao||'')}</textarea></div>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-7">
                    <div class="bg-[#171717] border border-slate-700 p-6 rounded-xl shadow-lg h-full flex flex-col gap-6">
                        <h3 class="text-xl font-bold text-white border-b border-slate-700 pb-3 font-cinzel">Economia & Recursos</h3>
                        ${renderResourcePicker('Materiais de Construção (Custo Único)', 'custoConstrucao')}
                        ${renderResourcePicker('Custo de Manutenção (Por Hora)', 'custoManutencao')}
                        ${renderResourcePicker('Produção Automática Passiva', 'producaoPassiva')}
                    </div>
                </div>
            </div>

            <div class="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 p-4 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div class="max-w-7xl mx-auto">
                    <button onclick="window.repTools.saveBuilding()" id="btn-save-rep" class="w-full py-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xl tracking-widest rounded-xl shadow-lg uppercase transition-transform hover:scale-[1.005]"><i class="fas fa-save mr-2"></i> Salvar Estabelecimento</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// UI DE FORMULÁRIO: ALIADO
// ============================================================================
function renderAllyForm() {
    const isEdit = repState.editingId !== null;
    const data = isEdit ? repState.cache.allies.find(a => a.id === repState.editingId) : {};

    return `
        <div class="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-32 animate-fade-in">
            <div class="flex justify-between items-center bg-[#171717] p-6 rounded-xl border border-amber-900/50 shadow-md">
                <h2 class="text-3xl font-cinzel text-amber-500 font-bold flex items-center gap-3"><i class="fas fa-user-shield"></i> ${isEdit ? 'Editar Aliado' : 'Novo Aliado'}</h2>
                <button onclick="window.repTools.closeForm()" class="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-2 rounded-lg transition-colors uppercase tracking-widest text-xs">Cancelar</button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div class="lg:col-span-5 space-y-6">
                    <div class="bg-[#171717] border border-slate-700 p-6 rounded-xl shadow-lg">
                        <h3 class="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-3 font-cinzel">Perfil do NPC</h3>
                        
                        <div class="mb-6">
                            <label class="mb-2 block text-xs font-bold text-amber-500 uppercase tracking-widest">Imagem do Modelo</label>
                            <div class="relative w-full h-64 bg-black rounded-xl border-2 border-dashed border-slate-600 overflow-hidden group mb-2 flex items-center justify-center" id="img-container">
                                <img id="f-preview" src="${data.imagemUrl||''}" class="w-full h-full object-cover ${data.imagemUrl ? '' : 'hidden'}">
                                <div id="f-placeholder" class="flex flex-col items-center text-slate-500 ${data.imagemUrl ? 'hidden' : ''}">
                                    <i class="fas fa-upload text-4xl mb-2 text-amber-500"></i>
                                    <span class="text-sm font-bold uppercase tracking-wide">Upload (Max 2MB)</span>
                                </div>
                            </div>
                            <input type="file" id="f-img" accept="image/*" onchange="window.repTools.previewImage(this)" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-slate-900 file:font-bold cursor-pointer">
                        </div>

                        <div class="space-y-4">
                            <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Nome do Aliado</label><input type="text" id="f-nome" value="${escapeHTML(data.nome||'')}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-amber-100 font-bold text-lg outline-none focus:border-amber-500"></div>
                            
                            <div>
                                <label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Classe Profissional</label>
                                <select id="f-tipo" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white font-bold outline-none focus:border-amber-500">
                                    <option value="Trabalhador" ${data.tipo==='Trabalhador'?'selected':''}>Trabalhador (Geral)</option>
                                    <option value="Vendedor" ${data.tipo==='Vendedor'?'selected':''}>Vendedor (Comércio)</option>
                                    <option value="Profissional" ${data.tipo==='Profissional'?'selected':''}>Profissional (Crafting)</option>
                                    <option value="Caseiro" ${data.tipo==='Caseiro'?'selected':''}>Caseiro (Doméstico)</option>
                                    <option value="Mercenario" ${data.tipo==='Mercenario'?'selected':''}>Mercenário (Combate)</option>
                                </select>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Custo Reputação</label><input type="number" id="f-custoRep" value="${data.reputacaoCustoBase||1}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white font-bold text-center outline-none focus:border-amber-500"></div>
                                <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Taxa XP Drenada (%)</label><input type="number" id="f-taxaXp" value="${data.taxaXp||10}" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-sky-400 font-bold text-center outline-none focus:border-sky-500"></div>
                            </div>
                            
                            <div><label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Descrição / Biografia</label><textarea id="f-desc" rows="4" class="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-slate-300 outline-none focus:border-amber-500 custom-scroll text-sm">${escapeHTML(data.descricao||'')}</textarea></div>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-7">
                    <div class="bg-[#171717] border border-slate-700 p-6 rounded-xl shadow-lg h-full flex flex-col gap-6">
                        <h3 class="text-xl font-bold text-white border-b border-slate-700 pb-3 font-cinzel">Contrato de Trabalho</h3>
                        ${renderResourcePicker('Salário / Manutenção (Por Hora)', 'custoManutencao')}
                        ${renderResourcePicker('Produção Pessoal (Rende algo sozinho?)', 'producaoBase')}
                        ${renderBuildingSelector()}
                    </div>
                </div>
            </div>

            <div class="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 p-4 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div class="max-w-7xl mx-auto">
                    <button onclick="window.repTools.saveAlly()" id="btn-save-rep" class="w-full py-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xl tracking-widest rounded-xl shadow-lg uppercase transition-transform hover:scale-[1.005]"><i class="fas fa-save mr-2"></i> Assinar Contrato (Salvar)</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// AÇÕES EXPOSTAS (WINDOW)
// ============================================================================
window.repTools = {
    newItem: () => {
        repState.editingId = null;
        repState.pendingImage = null;
        repState.formResources = { custoConstrucao: [], custoManutencao: [], producaoPassiva: [], estabelecimentosPermitidos: [] };
        repState.activeView = 'form';
        renderActiveView();
    },

    editItem: (id) => {
        repState.editingId = id;
        repState.pendingImage = null;
        
        const list = repState.activeTab === 'buildings' ? repState.cache.buildings : repState.cache.allies;
        const item = list.find(x => x.id === id);
        if(!item) return;

        if (repState.activeTab === 'buildings') {
            repState.formResources = {
                custoConstrucao: item.custoConstrucao || [],
                custoManutencao: item.custoManutencao || [],
                producaoPassiva: item.producaoPassiva || [],
                estabelecimentosPermitidos: []
            };
        } else {
            repState.formResources = {
                custoConstrucao: [],
                custoManutencao: item.custoManutencao || [],
                producaoPassiva: item.producaoBase || [], // Alias para reutilizar o Picker
                estabelecimentosPermitidos: item.estabelecimentosPermitidos || []
            };
        }

        repState.activeView = 'form';
        renderActiveView();
    },

    closeForm: () => {
        repState.activeView = 'list';
        repState.editingId = null;
        renderActiveView();
    },

    deleteItem: async (id, nome) => {
        if(!confirm(`Deseja demolir/exilar permanentemente "${nome}"?`)) return;
        const col = repState.activeTab === 'buildings' ? 'rpg_estabelecimentos_templates' : 'rpg_aliados_templates';
        try {
            await deleteDoc(doc(db, col, id));
            loadAllData();
        } catch(e) { alert(e.message); }
    },

    previewImage: (input) => {
        if (input.files && input.files[0]) {
            repState.pendingImage = input.files[0];
            document.getElementById('f-preview').src = URL.createObjectURL(input.files[0]);
            document.getElementById('f-preview').classList.remove('hidden');
            document.getElementById('f-placeholder').classList.add('hidden');
            document.getElementById('img-container').classList.replace('border-dashed', 'border-solid');
            document.getElementById('img-container').classList.replace('border-slate-600', 'border-amber-500');
        }
    },

    // --- Helpers de Formulário ---
    updateDropdownFilter: (listKey) => {
        const filterVal = document.getElementById(`filter-${listKey}`).value.toLowerCase();
        const select = document.getElementById(`select-${listKey}`);
        
        // Filtra até 100 itens da lista mestre global
        const filtered = repState.cache.items.filter(i => (i.nome||'').toLowerCase().includes(filterVal)).slice(0, 100);
        
        select.innerHTML = '<option value="">Selecione um recurso...</option>' + 
                           filtered.map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('');
    },

    addResource: (listKey) => {
        const select = document.getElementById(`select-${listKey}`);
        const qtyInput = document.getElementById(`qty-${listKey}`);
        
        const itemId = select.value;
        const qty = parseInt(qtyInput.value) || 1;
        if (!itemId) return;

        const itemObj = repState.cache.items.find(i => i.id === itemId);
        if (!itemObj) return;

        const existingIdx = repState.formResources[listKey].findIndex(v => v.itemId === itemId);
        if (existingIdx >= 0) {
            repState.formResources[listKey][existingIdx].qtd += qty;
        } else {
            repState.formResources[listKey].push({
                itemId: itemId,
                nome: itemObj.nome,
                qtd: qty,
                imagemUrl: itemObj.imagemUrl || ''
            });
        }
        
        select.value = '';
        qtyInput.value = 1;
        document.getElementById(`filter-${listKey}`).value = '';
        window.repTools.updateDropdownFilter(listKey);
        renderActiveView(); // Força update do form
    },

    removeResource: (listKey, index) => {
        repState.formResources[listKey].splice(index, 1);
        renderActiveView();
    },

    toggleBuilding: (id) => {
        const arr = repState.formResources.estabelecimentosPermitidos;
        const idx = arr.indexOf(id);
        if (idx > -1) arr.splice(idx, 1);
        else arr.push(id);
        renderActiveView();
    },

    // --- Salvar Dados ---
    saveBuilding: async () => {
        const nome = document.getElementById('f-nome').value.trim();
        if(!nome) return alert("O Prédio precisa de um nome!");

        const btn = document.getElementById('btn-save-rep');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Construindo...';
        btn.disabled = true;

        const payload = {
            nome: nome,
            reputacaoCusto: Number(document.getElementById('f-custoRep').value) || 0,
            reputacaoGerada: Number(document.getElementById('f-geraRep').value) || 0,
            slotsTrabalho: Number(document.getElementById('f-slots').value) || 1,
            descricao: document.getElementById('f-desc').value,
            custoConstrucao: repState.formResources.custoConstrucao,
            custoManutencao: repState.formResources.custoManutencao,
            producaoPassiva: repState.formResources.producaoPassiva,
            atualizadoEm: serverTimestamp()
        };

        await processSave('rpg_estabelecimentos_templates', payload, 'buildings');
    },

    saveAlly: async () => {
        const nome = document.getElementById('f-nome').value.trim();
        if(!nome) return alert("O Aliado precisa de um nome!");

        const btn = document.getElementById('btn-save-rep');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Assinando...';
        btn.disabled = true;

        const payload = {
            nome: nome,
            tipo: document.getElementById('f-tipo').value,
            reputacaoCustoBase: Number(document.getElementById('f-custoRep').value) || 1,
            taxaXp: Number(document.getElementById('f-taxaXp').value) || 10,
            descricao: document.getElementById('f-desc').value,
            custoManutencao: repState.formResources.custoManutencao,
            producaoBase: repState.formResources.producaoPassiva, // Alias de reaproveitamento de layout
            estabelecimentosPermitidos: repState.formResources.estabelecimentosPermitidos,
            atualizadoEm: serverTimestamp()
        };

        await processSave('rpg_aliados_templates', payload, 'allies');
    }
};

async function processSave(collectionName, payload, folderName) {
    const id = repState.editingId || doc(collection(db, collectionName)).id;
    let oldImg = null;
    
    // Busca imagem antiga para deleção
    if (repState.editingId) {
        const list = folderName === 'buildings' ? repState.cache.buildings : repState.cache.allies;
        oldImg = list.find(x => x.id === id)?.imagemUrl;
    }

    let finalUrl = oldImg;

    if (repState.pendingImage) {
        try {
            if (oldImg && oldImg.includes('firebasestorage')) {
                try { await deleteObject(ref(storage, oldImg)); } catch(e){}
            }
            // Comprime a imagem mantendo uma boa qualidade mas leve
            const blob = await compressImage(repState.pendingImage, 600, 600, 0.8);
            const storageRef = ref(storage, `imagens_reputacao/${folderName}/${Date.now()}_${id}.jpg`);
            await uploadBytes(storageRef, blob);
            finalUrl = await getDownloadURL(storageRef);
        } catch(imgErr) {
            console.error(imgErr);
        }
    }
    payload.imagemUrl = finalUrl || null;

    try {
        await setDoc(doc(db, collectionName, id), payload, { merge: true });
        repState.activeView = 'list';
        repState.editingId = null;
        repState.pendingImage = null;
        loadAllData();
    } catch(err) {
        alert("Erro no Registro: " + err.message);
        document.getElementById('btn-save-rep').disabled = false;
        document.getElementById('btn-save-rep').innerHTML = '<i class="fas fa-save mr-2"></i> TENTAR NOVAMENTE';
    }
}