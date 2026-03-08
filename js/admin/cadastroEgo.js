import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';

let egoState = {
    activeTab: 'espiritos', // 'espiritos', 'habilidades', 'tabelaXP'
    cache: { 
        espiritos: [], 
        skills: [], 
        xpTable: {}, 
        tiposArma: [],
        itensDieta: [] 
    },
    
    // Editor de Espírito
    editingEspiritoId: null,
    pendingImage: null,
    selectedSkills: [], // Array de IDs
    diet: [], // Array de objetos {itemId, nome, xp}
    dietFilter: '',
    
    // Editor de Habilidade
    editingSkillId: null
};

export async function renderCadastroEgoTab() {
    const container = document.getElementById('cadastro-ego-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left flex items-center gap-4">
                    <div class="p-4 bg-amber-500/10 rounded-full border-2 border-amber-500/30 text-amber-500 text-3xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <i class="fas fa-gavel"></i>
                    </div>
                    <div>
                        <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Forja Espiritual (EGO)</h1>
                        <p class="text-slate-400 mt-2 text-sm italic">Gestão de Armas Vivas e seus Códigos Genéticos</p>
                    </div>
                </div>
                
                <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-700" id="ego-tabs-nav">
                    <button class="ego-tab-btn active" data-tab="espiritos">Armas EGO</button>
                    <button class="ego-tab-btn" data-tab="habilidades">Manifestações (Skills)</button>
                    <button class="ego-tab-btn" data-tab="tabelaXP">Evolução (XP)</button>
                </div>
            </header>

            <div id="ego-dynamic-content" class="w-full relative min-h-[500px]">
                <div id="ego-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 mb-4"></div>
                    <p class="text-amber-500 font-cinzel tracking-widest">Aquecendo a Forja Cósmica...</p>
                </div>
                <div id="ego-view" class="w-full hidden"></div>
            </div>

        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('ego-tabs-nav');
    if (!nav) return;

    const baseClasses = ['px-6', 'py-3', 'rounded-lg', 'font-bold', 'text-sm', 'transition-all'];
    const activeClasses = ['bg-amber-600', 'text-slate-950', 'shadow-lg'];
    const inactiveClasses = ['text-slate-400', 'hover:text-white', 'hover:bg-slate-800'];

    nav.querySelectorAll('.ego-tab-btn').forEach(btn => {
        btn.classList.add(...baseClasses);
        if (btn.dataset.tab === egoState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
        } else {
            btn.classList.add(...inactiveClasses);
            btn.classList.remove(...activeClasses);
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.ego-tab-btn');
        if (btn) {
            egoState.activeTab = btn.dataset.tab;
            egoState.editingEspiritoId = null;
            egoState.editingSkillId = null;
            setupTabs(); 
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        const [espSnap, skillSnap, xpDoc, tiposSnap, itens1Snap, itens2Snap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_armasEspirituais'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_habilidadesEspirito'), orderBy("nome"))),
            getDoc(doc(db, 'rpg_tabelaXpEspirito', 'padrao')),
            getDocs(collection(db, 'rpg_itemTipos')),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila'))
        ]);

        const todosDocsItens = [...itens1Snap.docs, ...itens2Snap.docs];
        const itensFiltrados = todosDocsItens.map(d => ({ id: d.id, ...d.data() }))
            .filter(item => !item.slot_equipavel_id && item.tipo !== 'Equipamento')
            .filter((item, index, self) => index === self.findIndex((t) => t.id === item.id))
            .sort((a,b) => (a.nome||'').localeCompare(b.nome||''));

        egoState.cache = {
            espiritos: espSnap.docs.map(d => ({id: d.id, ...d.data()})),
            skills: skillSnap.docs.map(d => ({id: d.id, ...d.data()})),
            xpTable: xpDoc.exists() ? xpDoc.data() : { niveis: {} },
            tiposArma: tiposSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (a.nome||'').localeCompare(b.nome||'')),
            itensDieta: itensFiltrados
        };

        document.getElementById('ego-loading').classList.add('hidden');
        document.getElementById('ego-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('ego-loading').innerHTML = '<p class="text-red-500 font-bold p-10">O fogo apagou (Erro de Conexão).</p>';
    }
}

function renderActiveView() {
    const view = document.getElementById('ego-view');
    if (!view) return;

    if (egoState.activeTab === 'espiritos') {
        if (egoState.editingEspiritoId !== null || egoState.activeTabState === 'new') view.innerHTML = renderEspiritoForm();
        else view.innerHTML = renderEspiritoList();
    } else if (egoState.activeTab === 'habilidades') {
        view.innerHTML = renderHabilidadesView();
    } else if (egoState.activeTab === 'tabelaXP') {
        view.innerHTML = renderXPTableView();
    }
}

// ============================================================================
// 1. ARMAMENTO (ESPÍRITOS)
// ============================================================================
function renderEspiritoList() {
    const list = egoState.cache.espiritos;

    if(list.length === 0) {
        return `
            <div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-2xl">
                <button onclick="window.egoTools.newEspirito()" class="btn bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl shadow-lg font-bold text-lg"><i class="fas fa-plus mr-2"></i> Criar Primeiro Espírito</button>
            </div>
        `;
    }

    return `
        <div class="mb-6">
            <button onclick="window.egoTools.newEspirito()" class="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition uppercase tracking-widest text-lg"><i class="fas fa-plus"></i> Forjar Novo Modelo EGO</button>
        </div>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            ${list.map(e => `
                <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:border-amber-500 shadow-xl group relative flex flex-col aspect-[1/1.3]" onclick="window.egoTools.editEspirito('${e.id}')">
                    <img src="${e.imagemUrl || 'https://placehold.co/200x300/1e293b/a1a1aa?text=?'}" class="w-full h-3/4 object-cover">
                    <div class="h-1/4 bg-gradient-to-t from-black via-black/80 to-transparent absolute bottom-0 w-full flex flex-col justify-end p-2 text-center pb-3">
                        <h4 class="text-amber-400 font-bold text-sm leading-tight group-hover:text-white transition-colors truncate">${escapeHTML(e.nome)}</h4>
                        <span class="text-[9px] text-slate-400 uppercase tracking-widest truncate">${escapeHTML(e.classe || 'Arma')}</span>
                    </div>
                    <button onclick="event.stopPropagation(); window.egoTools.deleteEspirito('${e.id}', '${escapeHTML(e.nome)}')" class="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderEspiritoForm() {
    const isEdit = egoState.editingEspiritoId !== null;
    const data = isEdit ? egoState.cache.espiritos.find(e => e.id === egoState.editingEspiritoId) : {};
    
    // Dieta HTML
    const term = egoState.dietFilter.toLowerCase();
    const matDisponiveis = egoState.cache.itensDieta.filter(i => (i.nome||'').toLowerCase().includes(term)).slice(0,50); // Limite de 50 visualizações rápidas
    
    let dietHtml = egoState.diet.length === 0 ? '<p class="text-slate-500 italic text-sm text-center py-6">Nenhuma comida configurada.</p>' : egoState.diet.map((item, idx) => `
        <div class="flex justify-between items-center bg-slate-900 border border-slate-700 p-3 rounded-lg group hover:border-amber-500 transition-colors">
            <span class="text-slate-200 text-sm font-semibold truncate">${escapeHTML(item.nome)}</span>
            <div class="flex items-center gap-3">
                <span class="text-amber-400 text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-700 shadow-inner">+${item.xp} XP</span>
                <button type="button" onclick="window.egoTools.removeDietItem(${idx})" class="text-red-500 hover:text-red-400 p-1"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    // Habilidades Toggle HTML
    let skillsHtml = egoState.cache.skills.map(h => {
        const isSelected = egoState.selectedSkills.includes(h.id);
        return `
            <div onclick="window.egoTools.toggleSkill('${h.id}')" class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none ${isSelected ? 'bg-amber-900/30 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}">
                <span class="text-sm font-bold ${isSelected ? 'text-amber-400' : 'text-slate-400'}">${escapeHTML(h.nome)}</span>
                <div class="w-10 h-5 rounded-full relative transition-colors duration-200 ${isSelected ? 'bg-amber-500' : 'bg-slate-700'}">
                    <div class="absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-md ${isSelected ? 'translate-x-6' : 'translate-x-1'}"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="bg-slate-800/50 p-6 md:p-10 rounded-2xl border border-amber-500/30 shadow-2xl animate-fade-in pb-24">
            <div class="flex justify-between items-center border-b border-slate-700 pb-4 mb-8">
                <h2 class="text-3xl font-cinzel font-bold text-amber-400 flex items-center"><i class="fas fa-gavel mr-3 text-slate-500"></i> ${isEdit ? 'Reforjar Espírito' : 'Criar Novo Espírito'}</h2>
                <button onclick="window.egoTools.closeEspiritoForm()" class="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors uppercase tracking-widest text-xs">Voltar à Lista</button>
            </div>

            <form id="ego-form" onsubmit="window.egoTools.saveEspirito(event)" class="space-y-8">
                <input type="hidden" id="f-id" value="${data.id||''}">
                <input type="hidden" id="f-oldImg" value="${data.imagemUrl||''}">

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-6 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">1. Identidade</h3>
                    <div class="flex flex-col md:flex-row gap-8">
                        <div class="flex-shrink-0 mx-auto md:mx-0 w-48">
                            <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-widest text-center">Retrato EGO</label>
                            <div class="aspect-[1/1.3] bg-black rounded-xl border-2 border-slate-600 relative overflow-hidden mb-3">
                                <img id="ego-img-preview" src="${data.imagemUrl || 'https://placehold.co/300x400/1e293b/a1a1aa?text=?'}" class="w-full h-full object-cover opacity-80">
                            </div>
                            <input type="file" id="f-img" accept="image/*" onchange="window.egoTools.previewImage(this)" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-amber-600 file:text-white cursor-pointer">
                        </div>

                        <div class="flex-grow space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="text-xs text-slate-400 block mb-1 font-bold uppercase">Nome do Espírito</label>
                                    <input type="text" id="f-nome" value="${escapeHTML(data.nome||'')}" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white outline-none focus:border-amber-500">
                                </div>
                                <div>
                                    <label class="text-xs text-slate-400 block mb-1 font-bold uppercase">Classe (Tipo de Arma)</label>
                                    <select id="f-classe" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-amber-200 outline-none focus:border-amber-500">
                                        <option value="">Selecione...</option>
                                        ${egoState.cache.tiposArma.length > 0 ? egoState.cache.tiposArma.map(t => `<option value="${t.id}" ${data.classe===t.id?'selected':''}>${escapeHTML(t.nome)}</option>`).join('') : '<option value="espada">Espada</option><option value="machado">Machado</option>'}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-700">
                                <div>
                                    <label class="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Nível Inicial</label>
                                    <input type="number" id="f-lvl" value="${data.level||1}" min="1" max="100" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white text-center font-mono outline-none focus:border-amber-500">
                                </div>
                                <div>
                                    <label class="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Taxa XP Drenada (%)</label>
                                    <input type="number" id="f-taxa" value="${data.taxaXpJogador||20}" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-amber-400 text-center font-mono outline-none focus:border-amber-500">
                                </div>
                                <div>
                                    <label class="text-[10px] text-slate-400 block mb-1 font-bold uppercase">Dano Base Bruto (+)</label>
                                    <input type="number" id="f-danoBase" value="${data.danoBase||0}" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-red-400 text-center font-mono outline-none focus:border-red-500">
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-6 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">2. Dieta de Evolução</h3>
                    
                    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
                            <div>
                                <label class="text-[10px] text-slate-500 block mb-1 uppercase font-bold">1. Buscar Item</label>
                                <input type="text" placeholder="Filtrar materiais..." value="${escapeHTML(egoState.dietFilter)}" onkeyup="window.egoTools.filterDiet(this.value)" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded text-white text-sm outline-none focus:border-amber-500">
                            </div>
                            <div>
                                <label class="text-[10px] text-slate-500 block mb-1 uppercase font-bold">2. Selecionar Sacrifício</label>
                                <select id="diet-select" class="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded text-slate-300 text-sm outline-none focus:border-amber-500">
                                    <option value="">Selecione o item...</option>
                                    ${matDisponiveis.map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="text-[10px] text-amber-500 block mb-1 uppercase font-bold">XP Gerado</label>
                                <input type="number" id="diet-xp" value="10" class="w-24 bg-slate-900 border border-amber-600/50 px-3 py-2 rounded text-amber-400 text-sm font-bold text-center outline-none focus:border-amber-500">
                            </div>
                            <button type="button" onclick="window.egoTools.addDietItem()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold h-[38px] px-4 rounded transition-colors shadow-lg"><i class="fas fa-plus"></i> Add</button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scroll pr-2" id="diet-grid">
                        ${dietHtml}
                    </div>
                </section>

                <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-inner">
                    <h3 class="text-lg font-bold mb-4 text-white border-b border-slate-700 pb-2 tracking-widest uppercase">3. Manifestações Iniciais</h3>
                    <p class="text-xs text-slate-400 mb-6">Ative os botões das magias/habilidades que esta arma já possui ao ser encontrada.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                        ${skillsHtml}
                    </div>
                </section>

                <div class="sticky bottom-0 bg-slate-950/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 flex z-30 mt-8 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                    <button type="submit" id="btn-save-ego" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl tracking-widest rounded-lg shadow-lg border border-emerald-500/50 uppercase transition-transform hover:scale-[1.01]">
                        <i class="fas fa-gavel mr-3"></i> ${isEdit ? 'Reforjar Arma' : 'Criar Arma EGO'}
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
    const list = egoState.cache.skills;
    const editingData = egoState.editingSkillId ? list.find(s => s.id === egoState.editingSkillId) : null;

    return `
        <div class="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-fade-in">
            
            <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <h3 class="text-2xl font-cinzel font-bold text-amber-400 mb-6 border-b border-slate-600 pb-3">
                    ${editingData ? 'Editar Habilidade' : 'Cadastrar Nova Habilidade'}
                </h3>
                <form onsubmit="window.egoTools.saveSkill(event)" class="space-y-6">
                    <input type="hidden" id="s-id" value="${editingData?.id||''}">
                    
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div class="md:col-span-6">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Nome da Técnica</label>
                            <input type="text" id="s-nome" value="${escapeHTML(editingData?.nome||'')}" required placeholder="Ex: Corte Devastador" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white outline-none focus:border-amber-500">
                        </div>
                        <div class="md:col-span-3">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Nível Mínimo</label>
                            <input type="number" id="s-lvl" value="${editingData?.levelRequerido||1}" min="1" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white text-center outline-none focus:border-amber-500">
                        </div>
                        <div class="md:col-span-3">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider text-purple-400">Custo (EGO)</label>
                            <input type="number" id="s-custo" value="${editingData?.custoEgo||0}" class="w-full bg-slate-950 border border-purple-900 p-3 rounded-lg text-purple-400 font-bold text-center outline-none focus:border-purple-500">
                        </div>
                        <div class="md:col-span-12">
                            <label class="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">Descrição (Roleplay)</label>
                            <textarea id="s-desc" rows="2" class="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-slate-300 outline-none focus:border-amber-500 custom-scroll">${escapeHTML(editingData?.descricao||'')}</textarea>
                        </div>
                        <div class="md:col-span-12">
                            <label class="text-xs text-sky-400 block mb-1 font-bold uppercase tracking-wider">Efeito Técnico (Mecânica)</label>
                            <input type="text" id="s-efeito" value="${escapeHTML(editingData?.efeito||'')}" placeholder="Ex: Causa +20 de Dano Físico..." class="w-full bg-slate-950 border border-sky-900 p-3 rounded-lg text-sky-200 outline-none focus:border-sky-500">
                        </div>
                    </div>
                    
                    <div class="flex gap-4 pt-4 border-t border-slate-700">
                        <button type="submit" id="btn-save-skill" class="w-48 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors uppercase tracking-widest">
                            <i class="fas fa-save mr-2"></i> Salvar
                        </button>
                        ${editingData ? `
                            <button type="button" onclick="window.egoTools.cancelSkill()" class="w-48 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest">Cancelar</button>
                        ` : ''}
                    </div>
                </form>
            </div>

            <div>
                <h3 class="text-lg font-bold text-slate-300 mb-4 pl-3 border-l-4 border-amber-500 uppercase tracking-widest">Habilidades Manifestadas</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${list.map(s => `
                        <div class="bg-slate-900 p-6 rounded-2xl border border-slate-700 relative group hover:border-amber-500 transition-colors shadow-lg flex flex-col h-full">
                            <div class="flex justify-between items-start mb-3">
                                <h4 class="font-bold text-amber-400 text-lg pr-4">${escapeHTML(s.nome)}</h4>
                                <span class="text-[10px] font-bold bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 shrink-0">Lv. ${s.levelRequerido}</span>
                            </div>
                            <p class="text-xs text-slate-400 mb-4 line-clamp-3 flex-grow italic">"${escapeHTML(s.descricao)}"</p>
                            <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4">
                                <p class="text-[11px] text-sky-400 font-mono line-clamp-2"><strong class="text-slate-500">Mecânica:</strong> ${escapeHTML(s.efeito)}</p>
                            </div>
                            <div class="flex justify-between items-center mt-auto border-t border-slate-800 pt-4">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-900/20 px-2 py-1 rounded">Custo: ${s.custoEgo} EGO</span>
                                <div class="flex gap-2">
                                    <button onclick="window.egoTools.editSkill('${s.id}')" class="w-8 h-8 bg-sky-900/50 hover:bg-sky-600 text-sky-400 hover:text-white rounded flex items-center justify-center transition-colors"><i class="fas fa-pen text-xs"></i></button>
                                    <button onclick="window.egoTools.deleteSkill('${s.id}', '${escapeHTML(s.nome)}')" class="w-8 h-8 bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white rounded flex items-center justify-center transition-colors"><i class="fas fa-trash text-xs"></i></button>
                                </div>
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
    const tableData = egoState.cache.xpTable.niveis || {};
    const levels = Object.entries(tableData).sort((a,b)=>Number(a[0])-Number(b[0]));

    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl mx-auto animate-fade-in h-[75vh]">
            
            <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl flex flex-col h-full">
                <h3 class="text-2xl font-cinzel font-bold text-amber-400 mb-6 pb-4 border-b border-slate-600">Fórmula de Crescimento</h3>
                <p class="text-sm text-slate-400 mb-8">Defina os parâmetros matemáticos para que a forja calcule automaticamente a experiência necessária do nível 1 ao 100.</p>
                
                <form onsubmit="window.egoTools.generateXP(event)" class="space-y-6 flex-grow">
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">XP Base (Para Nível 2)</label>
                        <input type="number" id="xp-base" value="100" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-amber-500 font-mono text-xl text-center">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">Incremento Fixo Acumulativo (+)</label>
                        <input type="number" id="xp-inc" value="50" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-amber-500 font-mono text-xl text-center">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-2 font-bold uppercase tracking-wider">Multiplicador de Dificuldade (*)</label>
                        <input type="number" step="0.01" id="xp-mult" value="1.1" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-red-400 outline-none focus:border-red-500 font-mono text-xl text-center">
                    </div>
                    <button type="submit" id="btn-save-xp" class="w-full py-5 mt-auto bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-colors uppercase tracking-widest text-lg">
                        <i class="fas fa-calculator mr-2"></i> Calcular e Selar Matriz
                    </button>
                </form>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-inner flex flex-col h-full overflow-hidden relative">
                <h3 class="text-lg font-cinzel font-bold text-amber-400 p-6 border-b border-slate-800 bg-slate-950 z-10 shadow-md">Tabela Resultante Vigente</h3>
                
                <div class="flex-grow overflow-y-auto custom-scroll p-4">
                    ${levels.length === 0 ? '<p class="text-center text-slate-500 italic mt-10">Tabela Vazia.</p>' : `
                        <table class="w-full text-sm text-left">
                            <thead class="text-[10px] text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-900 shadow-md">
                                <tr><th class="py-3 px-4 border-b border-slate-800">Nível do EGO</th><th class="py-3 px-4 border-b border-slate-800 text-right">XP Acumulada Necessária</th></tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800">
                                ${levels.map(([lvl, xp]) => `
                                    <tr class="hover:bg-slate-800/50 transition-colors">
                                        <td class="py-3 px-4 font-bold text-amber-500 text-lg">${lvl}</td>
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
// AÇÕES EXPOSTAS NO WINDOW (EGO_TOOLS)
// ============================================================================
window.egoTools = {
    // ---- ESPÍRITOS ----
    newEspirito: () => {
        egoState.editingEspiritoId = null;
        egoState.activeTabState = 'new';
        egoState.selectedSkills = [];
        egoState.diet = [];
        egoState.dietFilter = '';
        renderActiveView();
    },

    editEspirito: (id) => {
        egoState.editingEspiritoId = id;
        egoState.activeTabState = 'edit';
        const e = egoState.cache.espiritos.find(x => x.id === id);
        egoState.selectedSkills = e.habilidadesConhecidas || [];
        egoState.diet = e.itensConsumiveis || [];
        egoState.dietFilter = '';
        renderActiveView();
    },

    closeEspiritoForm: () => {
        egoState.editingEspiritoId = null;
        egoState.activeTabState = null;
        renderActiveView();
    },

    deleteEspirito: async (id, nome) => {
        if(!confirm(`Fraturar e destruir a alma de ${nome} permanentemente?`)) return;
        try {
            await deleteDoc(doc(db, 'rpg_armasEspirituais', id));
            alert("Alma dissipada.");
            await loadAllData();
        } catch(e) { alert("Erro: " + e.message); }
    },

    previewImage: (input) => {
        if(input.files && input.files[0]) {
            egoState.pendingImage = input.files[0];
            document.getElementById('ego-img-preview').src = URL.createObjectURL(input.files[0]);
        }
    },

    filterDiet: (val) => { egoState.dietFilter = val; renderActiveView(); },
    
    addDietItem: () => {
        const select = document.getElementById('diet-select');
        const xp = parseInt(document.getElementById('diet-xp').value) || 10;
        const itemId = select.value;
        
        if(!itemId) return;
        const itemObj = egoState.cache.itensDieta.find(i => i.id === itemId);
        
        if(itemObj) {
            egoState.diet.push({ itemId: itemObj.id, nome: itemObj.nome, xp: xp });
            renderActiveView();
        }
    },

    removeDietItem: (idx) => {
        egoState.diet.splice(idx, 1);
        renderActiveView();
    },

    toggleSkill: (id) => {
        const idx = egoState.selectedSkills.indexOf(id);
        if(idx > -1) egoState.selectedSkills.splice(idx, 1);
        else egoState.selectedSkills.push(id);
        renderActiveView();
    },

    saveEspirito: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-ego');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> Reforjando Matéria...';
        btn.disabled = true;

        const docId = egoState.editingEspiritoId || doc(collection(db, 'rpg_armasEspirituais')).id;
        const oldImg = document.getElementById('f-oldImg').value;

        const payload = {
            nome: document.getElementById('f-nome').value.trim(),
            classe: document.getElementById('f-classe').value,
            level: Number(document.getElementById('f-lvl').value) || 1,
            taxaXpJogador: Number(document.getElementById('f-taxa').value) || 20,
            danoBase: Number(document.getElementById('f-danoBase').value) || 0,
            danoEspecial: 0, // Obsoleto no novo layout, mas mantido por segurança do DB antigo
            experienciaAtual: 0,
            habilidadesConhecidas: egoState.selectedSkills,
            itensConsumiveis: egoState.diet
        };

        let finalUrl = oldImg;
        if(egoState.pendingImage) {
            try {
                if(oldImg && oldImg.includes('firebasestorage')) {
                    try { await deleteObject(ref(storage, oldImg)); } catch(err){}
                }
                const blob = await compressImage(egoState.pendingImage, 400, 400, 0.7);
                const r = ref(storage, `imagens_rpg/espiritos/${docId}_${Date.now()}.jpg`);
                await uploadBytes(r, blob);
                finalUrl = await getDownloadURL(r);
            } catch(e) { console.error(e); }
        }
        if(finalUrl) payload.imagemUrl = finalUrl;

        try {
            await setDoc(doc(db, 'rpg_armasEspirituais', docId), payload, { merge: true });
            btn.innerHTML = '<i class="fas fa-check mr-3"></i> Encarnado!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                egoState.editingEspiritoId = null;
                egoState.activeTabState = null;
                loadAllData();
            }, 1000);
        } catch(err) {
            alert("Erro na forja: " + err.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    },

    // ---- HABILIDADES ----
    editSkill: (id) => { egoState.editingSkillId = id; renderActiveView(); },
    cancelSkill: () => { egoState.editingSkillId = null; renderActiveView(); },
    deleteSkill: async (id, nome) => {
        if(!confirm(`Deletar técnica: ${nome}?`)) return;
        await deleteDoc(doc(db, 'rpg_habilidadesEspirito', id));
        loadAllData();
    },
    saveSkill: async (e) => {
        e.preventDefault();
        const id = document.getElementById('s-id').value;
        const payload = {
            nome: document.getElementById('s-nome').value.trim(),
            levelRequerido: Number(document.getElementById('s-lvl').value)||1,
            custoEgo: Number(document.getElementById('s-custo').value)||0,
            descricao: document.getElementById('s-desc').value,
            efeito: document.getElementById('s-efeito').value
        };

        const btn = document.getElementById('btn-save-skill');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            if(id) await updateDoc(doc(db, 'rpg_habilidadesEspirito', id), payload);
            else await setDoc(doc(collection(db, 'rpg_habilidadesEspirito')), payload);
            egoState.editingSkillId = null;
            loadAllData();
        } catch(err) { alert(err.message); btn.disabled=false; btn.innerHTML='Salvar'; }
    },

    // ---- TABELA XP ----
    generateXP: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-xp');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Calculando Universo...';
        btn.disabled = true;

        const base = Number(document.getElementById('xp-base').value)||100;
        const inc = Number(document.getElementById('xp-inc').value)||50;
        const mult = Number(document.getElementById('xp-mult').value)||1.1;

        const table = {};
        let currentReq = base;
        for(let i=1; i<=100; i++) {
            if (i > 1) currentReq = Math.floor((currentReq + inc) * mult);
            table[i] = currentReq;
        }

        try {
            await setDoc(doc(db, 'rpg_tabelaXpEspirito', 'padrao'), { niveis: table });
            loadAllData();
        } catch(err) {
            alert(err.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-calculator mr-2"></i> Calcular e Selar Matriz';
        }
    }
};