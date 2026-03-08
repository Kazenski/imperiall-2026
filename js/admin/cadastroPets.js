import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let petState = {
    activeTab: 'pets', // 'pets', 'habilidades', 'tabelaXP'
    cache: { 
        pets: [], 
        skills: [], 
        xpTable: {}, 
        mobs: [],
        itensDieta: [] 
    },
    
    // Editor de Pet
    editingPetId: null,
    selectedSkills: [], // Array de IDs
    diet: [], // Array de objetos {itemId, nome, xp}
    productionItems: [], // Array de objetos {id, nome}
    dietFilter: '',
    
    // Editor de Habilidade
    editingSkillId: null
};

export async function renderCadastroPetsTab() {
    const container = document.getElementById('cadastro-pets-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left flex items-center gap-4">
                    <div class="p-4 bg-emerald-500/10 rounded-full border-2 border-emerald-500/30 text-emerald-500 text-3xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <i class="fas fa-paw"></i>
                    </div>
                    <div>
                        <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-emerald-500 tracking-widest drop-shadow-md">Gestor de Bestiário</h1>
                        <p class="text-slate-400 mt-2 text-sm italic">Configuração de Companheiros Animais e Mágicos</p>
                    </div>
                </div>
                
                <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-700" id="pet-tabs-nav">
                    <button class="pet-tab-btn active" data-tab="pets">Pets Configurados</button>
                    <button class="pet-tab-btn" data-tab="habilidades">Habilidades</button>
                    <button class="pet-tab-btn" data-tab="tabelaXP">Tabela XP</button>
                </div>
            </header>

            <div id="pet-dynamic-content" class="w-full relative min-h-[500px]">
                <div id="pet-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-emerald-500 mb-4"></div>
                    <p class="text-emerald-500 font-cinzel tracking-widest">Abrindo os Estábulos...</p>
                </div>
                <div id="pet-view" class="w-full hidden"></div>
            </div>

            <footer class="fixed bottom-2 right-2 opacity-30 hover:opacity-100 transition z-50">
                 <button onclick="window.petTools.backupPets()" class="text-[10px] text-slate-500 hover:text-white bg-black/50 px-2 py-1 rounded shadow-lg border border-slate-700">Backup JSON</button>
            </footer>

        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('pet-tabs-nav');
    if (!nav) return;

    const baseClasses = ['px-6', 'py-3', 'rounded-lg', 'font-bold', 'text-sm', 'transition-all'];
    const activeClasses = ['bg-emerald-600', 'text-white', 'shadow-lg'];
    const inactiveClasses = ['text-slate-400', 'hover:text-white', 'hover:bg-slate-800'];

    nav.querySelectorAll('.pet-tab-btn').forEach(btn => {
        btn.classList.add(...baseClasses);
        if (btn.dataset.tab === petState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
        } else {
            btn.classList.add(...inactiveClasses);
            btn.classList.remove(...activeClasses);
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.pet-tab-btn');
        if (btn) {
            petState.activeTab = btn.dataset.tab;
            petState.editingPetId = null;
            petState.editingSkillId = null;
            setupTabs(); 
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        const [petsSnap, skillSnap, xpDoc, mobsSnap, itens1Snap, itens2Snap] = await Promise.all([
            getDocs(collection(db, 'rpg_pets')),
            getDocs(collection(db, 'rpg_habilidadesPet')),
            getDoc(doc(db, 'rpg_tabelaXpPet', 'padrao')),
            getDocs(query(collection(db, 'rpg_fichasNPCMonstros'), orderBy('nome'))),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila'))
        ]);

        const todosDocsItens = [...itens1Snap.docs, ...itens2Snap.docs];
        const itensFiltrados = todosDocsItens.map(d => ({ id: d.id, ...d.data() }))
            .filter(item => !item.slot_equipavel_id && item.tipo !== 'Equipamento')
            .filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))
            .sort((a,b) => (a.nome||'').localeCompare(b.nome||''));

        petState.cache = {
            pets: petsSnap.docs.map(d => ({id: d.id, ...d.data()})),
            skills: skillSnap.docs.map(d => ({id: d.id, ...d.data()})),
            xpTable: xpDoc.exists() ? xpDoc.data() : { niveis: {} },
            mobs: mobsSnap.docs.map(d => ({id: d.id, ...d.data()})),
            itensDieta: itensFiltrados
        };

        document.getElementById('pet-loading').classList.add('hidden');
        document.getElementById('pet-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('pet-loading').innerHTML = '<p class="text-red-500 font-bold p-10">O bando fugiu (Erro de Conexão).</p>';
    }
}

function renderActiveView() {
    const view = document.getElementById('pet-view');
    if (!view) return;

    if (petState.activeTab === 'pets') {
        if (petState.editingPetId !== null || petState.activeTabState === 'new') view.innerHTML = renderPetForm();
        else view.innerHTML = renderPetList();
    } else if (petState.activeTab === 'habilidades') {
        view.innerHTML = renderHabilidadesView();
    } else if (petState.activeTab === 'tabelaXP') {
        view.innerHTML = renderXPTableView();
    }
}

// ============================================================================
// 1. BESTIÁRIO (PETS)
// ============================================================================
function renderPetList() {
    const list = petState.cache.pets;

    if(list.length === 0) {
        return `
            <div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-2xl">
                <button onclick="window.petTools.newPet()" class="btn bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl shadow-lg font-bold text-lg"><i class="fas fa-plus mr-2"></i> Criar Primeiro Pet</button>
            </div>
        `;
    }

    return `
        <div class="mb-6">
            <button onclick="window.petTools.newPet()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition uppercase tracking-widest text-lg"><i class="fas fa-plus"></i> Criar Novo Template de Pet</button>
        </div>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            ${list.map(p => `
                <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:border-emerald-500 shadow-xl group relative flex flex-col aspect-[1/1.2]" onclick="window.petTools.editPet('${p.id}')">
                    <img src="${p.imagemUrl || 'https://placehold.co/200x300/1e293b/a1a1aa?text=?'}" class="w-full h-3/4 object-cover opacity-80 group-hover:opacity-100 transition-opacity bg-black">
                    <div class="h-1/4 bg-gradient-to-t from-black via-black/80 to-transparent absolute bottom-0 w-full flex flex-col justify-end p-2 text-center pb-3">
                        <h4 class="text-emerald-400 font-bold text-sm leading-tight group-hover:text-white transition-colors truncate">${escapeHTML(p.nome)}</h4>
                        <span class="text-[9px] text-slate-400 uppercase tracking-widest truncate">Lv. ${p.level || 1}</span>
                    </div>
                    <button onclick="event.stopPropagation(); window.petTools.deletePet('${p.id}', '${escapeHTML(p.nome)}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPetForm() {
    const isEdit = petState.editingPetId !== null;
    const data = isEdit ? petState.cache.pets.find(e => e.id === petState.editingPetId) : {};
    
    // Avatar Mob (Se estiver editando, busca o Mob que cedeu a foto/status)
    const currentMob = petState.cache.mobs.find(m => m.id === (data.mobBaseId || petState.formMobId));
    const imgPet = currentMob?.imageUrls?.imagem1 || data?.imagemUrl || 'https://placehold.co/200x200/1e293b/a1a1aa?text=?';

    // Dieta HTML
    const term = petState.dietFilter.toLowerCase();
    const matDisponiveis = petState.cache.itensDieta.filter(i => (i.nome||'').toLowerCase().includes(term)).slice(0,50);
    
    let dietHtml = petState.diet.length === 0 ? '<p class="text-slate-500 italic text-sm text-center py-6 col-span-full">Nenhum item configurado.</p>' : petState.diet.map((item, idx) => `
        <div class="flex justify-between items-center bg-slate-900 border border-slate-700 p-3 rounded-lg group hover:border-emerald-500 transition-colors">
            <span class="text-slate-200 text-sm font-semibold truncate">${escapeHTML(item.nome)}</span>
            <div class="flex items-center gap-3">
                <span class="text-emerald-400 text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-700 shadow-inner">+${item.xp} XP</span>
                <button type="button" onclick="window.petTools.removeDietItem(${idx})" class="text-red-500 hover:text-red-400 p-1"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    // Produção HTML
    let prodHtml = petState.productionItems.length === 0 ? '<p class="text-slate-500 italic text-xs text-center py-2 col-span-full">Este pet não produz nada.</p>' : petState.productionItems.map((item, idx) => `
        <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700">
            <span class="text-sm text-amber-400 font-bold">${escapeHTML(item.nome)}</span>
            <button type="button" onclick="window.petTools.removeProdItem(${idx})" class="text-red-500 hover:text-red-400"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');

    // Habilidades Toggle HTML
    let skillsHtml = petState.cache.skills.map(h => {
        const isSelected = petState.selectedSkills.includes(h.id);
        return `
            <div onclick="window.petTools.toggleSkill('${h.id}')" class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none ${isSelected ? 'bg-emerald-900/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}">
                <span class="text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-400'}">${escapeHTML(h.nome)}</span>
                <div class="w-10 h-5 rounded-full relative transition-colors duration-200 ${isSelected ? 'bg-emerald-500' : 'bg-slate-700'}">
                    <div class="absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-md ${isSelected ? 'translate-x-6' : 'translate-x-1'}"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="bg-slate-800/50 p-6 md:p-10 rounded-2xl border border-emerald-500/30 shadow-2xl animate-fade-in pb-24">
            <div class="flex justify-between items-center border-b border-slate-700 pb-4 mb-8">
                <h2 class="text-3xl font-cinzel font-bold text-emerald-400 flex items-center"><i class="fas fa-paw mr-3 text-slate-500"></i> ${isEdit ? 'Editar Espírito Animal' : 'Criar Novo Companheiro'}</h2>
                <button onclick="window.petTools.closePetForm()" class="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors uppercase tracking-widest text-xs">Voltar à Lista</button>
            </div>

            <form id="pet-form" onsubmit="window.petTools.savePet(event)" class="space-y-8">
                <input type="hidden" id="f-id" value="${data.id||''}">

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-6 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">1. DNA da Criatura</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div class="md:col-span-8 space-y-6">
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Monstro Base (Herdar Imagem e Status)</label>
                                <select id="f-mobId" onchange="window.petTools.updatePreviewMob(this.value)" ${isEdit ? 'disabled' : 'required'} class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white outline-none focus:border-emerald-500 disabled:opacity-50">
                                    <option value="">Selecione uma criatura do Bestiário...</option>
                                    ${petState.cache.mobs.map(m => `<option value="${m.id}" ${(data.mobBaseId || petState.formMobId) === m.id ? 'selected' : ''}>${escapeHTML(m.nome)}</option>`).join('')}
                                </select>
                                ${isEdit ? '<p class="text-[10px] text-red-400 mt-1">O monstro base não pode ser alterado após a criação.</p>' : ''}
                            </div>
                            
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nome do Pet (Opcional - Ex: Fenrir)</label>
                                <input type="text" id="f-nome" value="${escapeHTML(data.nome||'')}" placeholder="${currentMob ? currentMob.nome : 'Nome customizado...'}" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-emerald-200 outline-none focus:border-emerald-500">
                            </div>

                            <div class="grid grid-cols-2 gap-6 pt-4 border-t border-slate-700">
                                <div>
                                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nível Inicial</label>
                                    <input type="number" id="f-lvl" value="${data.level||1}" min="1" max="100" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white text-center font-mono outline-none focus:border-emerald-500">
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Taxa XP Jogador (%)</label>
                                    <input type="number" id="f-taxa" value="${data.taxaXpJogador||10}" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-amber-400 text-center font-mono outline-none focus:border-amber-500">
                                </div>
                            </div>
                        </div>

                        <div class="md:col-span-4 flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                            ${currentMob ? `
                                <img src="${imgPet}" class="w-32 h-32 object-cover rounded-full border-4 border-emerald-600 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                <h4 class="text-lg font-cinzel text-emerald-400 font-bold text-center">${escapeHTML(currentMob.nome)}</h4>
                                <div class="flex gap-3 mt-2 text-xs text-slate-400 font-mono">
                                    <span class="bg-slate-800 px-2 py-1 rounded">HP: ${currentMob.hpMaxPersonagemBase || 0}</span>
                                    <span class="bg-slate-800 px-2 py-1 rounded border-l-2 border-red-500">ATK: ${currentMob.atk_base || 0}</span>
                                </div>
                            ` : `<div class="text-slate-500 text-sm italic text-center p-6"><i class="fas fa-ghost text-4xl mb-2 block"></i> Selecione um Monstro.</div>`}
                        </div>
                    </div>
                </section>

                <section class="form-section shadow-lg w-full bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                    <h3 class="text-lg font-bold mb-6 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">2. Produção & Utilitários</h3>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <label class="mb-2 block text-xs font-bold text-slate-400 uppercase tracking-widest">Geração Diária de Itens</label>
                            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
                                <div class="flex gap-2">
                                    <select id="prod-select" class="flex-grow bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-emerald-500 rounded p-2 text-sm">
                                        <option value="">Selecione item para produzir...</option>
                                        ${matDisponiveis.map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('')}
                                    </select>
                                    <button type="button" onclick="window.petTools.addProdItem()" class="btn bg-sky-600 hover:bg-sky-500 text-white w-12 flex justify-center items-center rounded shadow-lg"><i class="fas fa-plus"></i></button>
                                </div>
                                <p class="text-[10px] text-slate-500 mt-2 font-mono">Formula: Qtd = ceil(Nível do Pet / 5)</p>
                            </div>
                            <div class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scroll">
                                ${prodHtml}
                            </div>
                        </div>

                        <div>
                            <label class="mb-2 block text-xs font-bold text-slate-400 uppercase tracking-widest">Passiva Exclusiva na Ficha (Texto)</label>
                            <textarea id="f-efeito-esp" rows="6" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-sky-300 outline-none focus:border-sky-500 custom-scroll" placeholder="Ex: O mestre deste pet recebe +2 de Percepção permanente.">${escapeHTML(data.efeitoEspecial||'')}</textarea>
                        </div>
                    </div>
                </section>

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-6 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">3. Dieta de Crescimento (Itens Consumidos)</h3>
                    
                    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
                            <div>
                                <label class="text-[10px] text-slate-500 block mb-1 uppercase font-bold">1. Filtrar Item</label>
                                <input type="text" placeholder="Buscar material..." value="${escapeHTML(petState.dietFilter)}" onkeyup="window.petTools.filterDiet(this.value)" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded text-white text-sm outline-none focus:border-emerald-500">
                            </div>
                            <div>
                                <label class="text-[10px] text-slate-500 block mb-1 uppercase font-bold">2. Selecionar Ração</label>
                                <select id="diet-select" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded text-slate-300 text-sm outline-none focus:border-emerald-500">
                                    <option value="">Lista Alimentar...</option>
                                    ${matDisponiveis.map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="text-[10px] text-emerald-500 block mb-1 uppercase font-bold">XP Fornecido</label>
                                <input type="number" id="diet-xp" value="10" class="w-24 bg-slate-900 border border-emerald-600/50 px-3 py-2 rounded text-emerald-400 text-sm font-bold text-center outline-none focus:border-emerald-500">
                            </div>
                            <button type="button" onclick="window.petTools.addDietItem()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-[38px] px-4 rounded transition-colors shadow-lg"><i class="fas fa-plus"></i> Add</button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                        ${dietHtml}
                    </div>
                </section>

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-4 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">4. Repertório de Habilidades</h3>
                    <p class="text-xs text-slate-400 mb-6">Ative os botões das técnicas base que este pet conhece.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                        ${skillsHtml}
                    </div>
                </section>

                <div class="sticky bottom-0 bg-slate-950/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 flex z-30 mt-8 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                    <button type="submit" id="btn-save-pet" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl tracking-widest rounded-lg shadow-lg border border-emerald-500/50 uppercase transition-transform hover:scale-[1.01]">
                        <i class="fas fa-paw mr-3"></i> ${isEdit ? 'Atualizar Pet no Bestiário' : 'Registrar Novo Pet'}
                    </button>
                </div>
            </form>
        </div>
    `;
}

// ============================================================================
// 2. HABILIDADES
// ============================================================================
function renderHabilidadesView() {
    const list = petState.cache.skills;
    const editingData = petState.editingSkillId ? list.find(s => s.id === petState.editingSkillId) : null;

    return `
        <div class="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-fade-in">
            
            <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <h3 class="text-2xl font-cinzel font-bold text-emerald-400 mb-6 border-b border-slate-600 pb-3">
                    ${editingData ? 'Editar Habilidade Bestial' : 'Cadastrar Nova Técnica de Pet'}
                </h3>
                <form onsubmit="window.petTools.saveSkill(event)" class="space-y-6">
                    <input type="hidden" id="s-id" value="${editingData?.id||''}">
                    
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div class="md:col-span-8">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Nome da Habilidade</label>
                            <input type="text" id="s-nome" value="${escapeHTML(editingData?.nome||'')}" required placeholder="Ex: Mordida Feroz" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white outline-none focus:border-emerald-500">
                        </div>
                        <div class="md:col-span-4">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Nível Mínimo Exigido</label>
                            <input type="number" id="s-lvl" value="${editingData?.levelRequerido||1}" min="1" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white text-center outline-none focus:border-emerald-500">
                        </div>
                        <div class="md:col-span-12">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Descrição Interpretativa</label>
                            <textarea id="s-desc" rows="2" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-slate-300 outline-none focus:border-emerald-500 custom-scroll">${escapeHTML(editingData?.descricao||'')}</textarea>
                        </div>
                        <div class="md:col-span-12">
                            <label class="text-xs text-sky-400 block mb-1 font-bold uppercase tracking-wider">Mecânica de Jogo (Opcional)</label>
                            <input type="text" id="s-efeito" value="${escapeHTML(editingData?.efeito||'')}" placeholder="Ex: Causa dano igual a 1d6 + ATK" class="w-full bg-slate-950 border border-sky-900 p-3 rounded-lg text-sky-200 outline-none focus:border-sky-500">
                        </div>
                    </div>
                    
                    <div class="flex gap-4 pt-4 border-t border-slate-700">
                        <button type="submit" id="btn-save-skill" class="w-48 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors uppercase tracking-widest">
                            <i class="fas fa-save mr-2"></i> Salvar Técnica
                        </button>
                        ${editingData ? `
                            <button type="button" onclick="window.petTools.cancelSkill()" class="w-48 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest">Cancelar</button>
                        ` : ''}
                    </div>
                </form>
            </div>

            <div>
                <h3 class="text-lg font-bold text-slate-300 mb-4 pl-3 border-l-4 border-emerald-500 uppercase tracking-widest">Enciclopédia de Técnicas</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${list.map(s => `
                        <div class="bg-slate-900 p-6 rounded-2xl border border-slate-700 relative group hover:border-emerald-500 transition-colors shadow-lg flex flex-col h-full">
                            <div class="flex justify-between items-start mb-3">
                                <h4 class="font-bold text-emerald-400 text-lg pr-4 leading-tight">${escapeHTML(s.nome)}</h4>
                                <span class="text-[10px] font-bold bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 shrink-0">Lv. ${s.levelRequerido}</span>
                            </div>
                            <p class="text-xs text-slate-400 mb-4 line-clamp-3 flex-grow italic">"${escapeHTML(s.descricao)}"</p>
                            ${s.efeito ? `
                                <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4">
                                    <p class="text-[11px] text-sky-400 font-mono line-clamp-2"><strong class="text-slate-500">Mecânica:</strong> ${escapeHTML(s.efeito)}</p>
                                </div>
                            ` : ''}
                            <div class="flex justify-end items-center mt-auto border-t border-slate-800 pt-4 gap-2">
                                <button onclick="window.petTools.editSkill('${s.id}')" class="w-8 h-8 bg-sky-900/50 hover:bg-sky-600 text-sky-400 hover:text-white rounded flex items-center justify-center transition-colors"><i class="fas fa-pen text-xs"></i></button>
                                <button onclick="window.petTools.deleteSkill('${s.id}', '${escapeHTML(s.nome)}')" class="w-8 h-8 bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white rounded flex items-center justify-center transition-colors"><i class="fas fa-trash text-xs"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// 3. TABELA DE XP
// ============================================================================
function renderXPTableView() {
    const tableData = petState.cache.xpTable.niveis || {};
    const levels = Object.entries(tableData).sort((a,b)=>Number(a[0])-Number(b[0]));

    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl mx-auto animate-fade-in h-[75vh]">
            
            <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl flex flex-col h-full">
                <h3 class="text-2xl font-cinzel font-bold text-emerald-400 mb-6 pb-4 border-b border-slate-600">Matemática de Nível do Pet</h3>
                <p class="text-sm text-slate-400 mb-8">Defina os parâmetros para calcular os requisitos de evolução da dieta do nível 1 ao 100.</p>
                
                <form onsubmit="window.petTools.generateXP(event)" class="space-y-6 flex-grow">
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">XP Base (Fome Nvl 1)</label>
                        <input type="number" id="xp-base" value="50" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xl text-center">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">Aumento Fixo por Nível (+)</label>
                        <input type="number" id="xp-inc" value="25" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xl text-center">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">Multiplicador Exponencial (*)</label>
                        <input type="number" step="0.01" id="xp-mult" value="1.05" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-amber-400 outline-none focus:border-amber-500 font-mono text-xl text-center">
                    </div>
                    <button type="submit" id="btn-save-xp" class="w-full py-5 mt-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition-colors uppercase tracking-widest text-lg">
                        <i class="fas fa-calculator mr-2"></i> Recalcular e Salvar Progressão
                    </button>
                </form>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-inner flex flex-col h-full overflow-hidden relative">
                <h3 class="text-lg font-cinzel font-bold text-emerald-400 p-6 border-b border-slate-800 bg-slate-950 z-10 shadow-md">Gasto Energético Projetado</h3>
                
                <div class="flex-grow overflow-y-auto custom-scroll p-4">
                    ${levels.length === 0 ? '<p class="text-center text-slate-500 italic mt-10">Tabela Vazia.</p>' : `
                        <table class="w-full text-sm text-left">
                            <thead class="text-[10px] text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-900 shadow-md">
                                <tr><th class="py-3 px-4 border-b border-slate-800">Nível Alvo</th><th class="py-3 px-4 border-b border-slate-800 text-right">Comida Acumulada Necessária</th></tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800">
                                ${levels.map(([lvl, xp]) => `
                                    <tr class="hover:bg-slate-800/50 transition-colors">
                                        <td class="py-3 px-4 font-bold text-emerald-500 text-lg">${lvl}</td>
                                        <td class="py-3 px-4 font-mono text-slate-300 text-right text-base">${xp.toLocaleString()} <span class="text-[10px] text-slate-500 ml-1">XP</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>

        </div>
    `;
}

// ============================================================================
// AÇÕES EXPOSTAS NO WINDOW (PET_TOOLS)
// ============================================================================
window.petTools = {
    // ---- PETS ----
    newPet: () => {
        petState.editingPetId = null;
        petState.activeTabState = 'new';
        petState.selectedSkills = [];
        petState.diet = [];
        petState.productionItems = [];
        petState.formMobId = '';
        petState.dietFilter = '';
        renderActiveView();
    },

    editPet: (id) => {
        petState.editingPetId = id;
        petState.activeTabState = 'edit';
        const p = petState.cache.pets.find(x => x.id === id);
        petState.selectedSkills = p.habilidadesConhecidas || [];
        petState.diet = p.itensConsumiveis || [];
        petState.productionItems = p.itensProducao || [];
        petState.formMobId = p.mobBaseId;
        petState.dietFilter = '';
        renderActiveView();
    },

    closePetForm: () => {
        petState.editingPetId = null;
        petState.activeTabState = null;
        renderActiveView();
    },

    deletePet: async (id, nome) => {
        if(!confirm(`Sacrificar e remover permanentemente o pet "${nome}"?`)) return;
        try {
            await deleteDoc(doc(db, 'rpg_pets', id));
            await loadAllData();
        } catch(e) { alert("Erro ao sacrificar: " + e.message); }
    },

    updatePreviewMob: (mobId) => {
        petState.formMobId = mobId;
        renderActiveView();
    },

    filterDiet: (val) => { petState.dietFilter = val; renderActiveView(); },
    
    addDietItem: () => {
        const select = document.getElementById('diet-select');
        const xp = parseInt(document.getElementById('diet-xp').value) || 10;
        const itemId = select.value;
        
        if(!itemId) return;
        const itemObj = petState.cache.itensDieta.find(i => i.id === itemId);
        if(itemObj) {
            petState.diet.push({ itemId: itemObj.id, nome: itemObj.nome, xp: xp });
            renderActiveView();
        }
    },
    removeDietItem: (idx) => { petState.diet.splice(idx, 1); renderActiveView(); },

    addProdItem: () => {
        const sel = document.getElementById('prod-select').value;
        if(!sel) return;
        if(petState.productionItems.some(p => p.id === sel)) return alert("Item já adicionado na produção.");
        
        const itemObj = petState.cache.itensDieta.find(i => i.id === sel);
        if(itemObj) {
            petState.productionItems.push({ id: itemObj.id, nome: itemObj.nome });
            renderActiveView();
        }
    },
    removeProdItem: (idx) => { petState.productionItems.splice(idx, 1); renderActiveView(); },

    toggleSkill: (id) => {
        const idx = petState.selectedSkills.indexOf(id);
        if(idx > -1) petState.selectedSkills.splice(idx, 1);
        else petState.selectedSkills.push(id);
        renderActiveView();
    },

    savePet: async (e) => {
        e.preventDefault();
        const mobId = document.getElementById('f-mobId').value;
        if(!mobId && !petState.editingPetId) return alert("Selecione a raça/monstro do bestiário!");

        const btn = document.getElementById('btn-save-pet');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> Encubando...';
        btn.disabled = true;

        const docId = petState.editingPetId || doc(collection(db, 'rpg_pets')).id;
        
        const mobRef = petState.cache.mobs.find(m => m.id === mobId) || petState.cache.mobs.find(m => m.id === petState.formMobId);

        const payload = {
            nome: document.getElementById('f-nome').value.trim() || mobRef.nome,
            mobBaseId: mobRef.id,
            level: Number(document.getElementById('f-lvl').value) || 1,
            taxaXpJogador: Number(document.getElementById('f-taxa').value) || 10,
            
            // Dados Base copiados para facilitar leitura na UI sem joins extras
            imagemUrl: mobRef.imageUrls?.imagem1 || null,
            descricaoBase: mobRef.descricao || '',
            
            // Evolução e Combate
            experienciaAtual: 0,
            itensConsumiveis: petState.diet,
            itensProducao: petState.productionItems,
            habilidadesConhecidas: petState.selectedSkills,
            efeitoEspecial: document.getElementById('f-efeito-esp').value.trim(),
            
            atualizadoEm: serverTimestamp()
        };

        if(!petState.editingPetId) payload.criadoEm = serverTimestamp();

        try {
            await setDoc(doc(db, 'rpg_pets', docId), payload, { merge: true });
            btn.innerHTML = '<i class="fas fa-check mr-3"></i> Ovo Chocado!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                petState.editingPetId = null;
                petState.activeTabState = null;
                loadAllData();
            }, 1000);
        } catch(err) {
            alert("Erro genético: " + err.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    },

    // ---- HABILIDADES ----
    editSkill: (id) => { petState.editingSkillId = id; renderActiveView(); },
    cancelSkill: () => { petState.editingSkillId = null; renderActiveView(); },
    deleteSkill: async (id, nome) => {
        if(!confirm(`Apagar a técnica de pet: ${nome}?`)) return;
        await deleteDoc(doc(db, 'rpg_habilidadesPet', id));
        loadAllData();
    },
    saveSkill: async (e) => {
        e.preventDefault();
        const id = document.getElementById('s-id').value;
        const payload = {
            nome: document.getElementById('s-nome').value.trim(),
            levelRequerido: Number(document.getElementById('s-lvl').value)||1,
            descricao: document.getElementById('s-desc').value,
            efeito: document.getElementById('s-efeito').value
        };

        const btn = document.getElementById('btn-save-skill');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            if(id) await updateDoc(doc(db, 'rpg_habilidadesPet', id), payload);
            else await setDoc(doc(collection(db, 'rpg_habilidadesPet')), payload);
            petState.editingSkillId = null;
            loadAllData();
        } catch(err) { alert(err.message); btn.disabled=false; btn.innerHTML='Salvar Técnica'; }
    },

    // ---- TABELA XP ----
    generateXP: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-xp');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Simulando Crescimento...';
        btn.disabled = true;

        const base = Number(document.getElementById('xp-base').value)||50;
        const inc = Number(document.getElementById('xp-inc').value)||25;
        const mult = Number(document.getElementById('xp-mult').value)||1.05;

        const table = {};
        let currentReq = base;
        for(let i=1; i<=100; i++) {
            if (i > 1) currentReq = Math.floor((currentReq + inc) * mult);
            table[i] = currentReq;
        }

        try {
            await setDoc(doc(db, 'rpg_tabelaXpPet', 'padrao'), { niveis: table });
            loadAllData();
        } catch(err) {
            alert(err.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-calculator mr-2"></i> Recalcular e Salvar Progressão';
        }
    },

    // ---- BACKUP RAW (JSON) ----
    backupPets: () => {
        const data = {
            pets: petState.cache.pets,
            skills: petState.cache.skills,
            xpTable: petState.cache.xpTable
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_bestiario_pets_${Date.now()}.json`;
        a.click();
    }
};