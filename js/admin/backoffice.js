import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';
import { BONUS_LIST } from '../core/state.js';

// --- ESTADO GLOBAL DO BACKOFFICE ---
let boState = {
    activeTab: 'habilidades',
    cache: {},
    selectedItem: null,
    pendingImage: null,
    filter: '',
    
    // Estados do Balanceamento
    balTab: 'habilidades', // 'habilidades' ou 'atributos'
    balHabEdits: {},
    balHabFilterClass: '',
    balHabFilterSub: '',
    balHabSearch: '',
    
    balAttrMode: 'definicao', // 'definicao' ou 'matriz'
    balAttrEixo: 'classes',
    balAttrEdits: {}
};

// Mapeamento das coleções
const COLL_MAP = {
    habilidades: { c: 'rpg_habilidades', name: 'Habilidades' },
    racas: { c: 'rpg_racas', name: 'Raças' },
    classes: { c: 'rpg_classes', name: 'Classes' },
    subclasses: { c: 'rpg_subclasses', name: 'Subclasses' },
    profissoes: { c: 'rpg_profissoes', name: 'Profissões' },
    terrenos: { c: 'rpg_terrenosBonus', name: 'Terrenos' },
    efeitos: { c: 'rpg_efeitosGerais', name: 'Efeitos' },
    tiposEfeito: { c: 'rpg_efeitoTipos', name: 'Tipos Efeito' },
    vantagens: { c: 'rpg_vantagensHabilidadesNaturais', name: 'Vantagens' },
    sessoes: { c: 'rpg_sessoes', name: 'Sessões', sort: 'desc', sortKey: 'dataRegistro' },
    atributos: { c: 'rpg_atributos', name: 'Atributos' },
    personagens: { c: 'rpg_fichas', name: 'Personagens' }
};

export async function renderBackofficeTab() {
    const container = document.getElementById('backoffice-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-purple-500 tracking-widest drop-shadow-md"><i class="fas fa-database mr-3"></i> Backoffice Mestre</h1>
                <p class="text-slate-400 mt-2 text-sm italic">Gestão absoluta dos pilares de Imperiall</p>
            </header>

            <nav class="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4" id="bo-tabs-nav">
                ${Object.keys(COLL_MAP).filter(k => !['atributos','tiposEfeito','personagens'].includes(k)).map(k => `
                    <button class="bo-tab-btn ${boState.activeTab === k ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'} px-3 py-2 rounded font-bold text-xs uppercase tracking-wider transition-colors" data-tab="${k}">${COLL_MAP[k].name}</button>
                `).join('')}
                <button class="bo-tab-btn ${boState.activeTab === 'balanceamento' ? 'bg-purple-600 text-white' : 'bg-purple-900/50 text-purple-300 hover:bg-purple-700 hover:text-white'} px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-colors ml-auto" data-tab="balanceamento"><i class="fas fa-balance-scale mr-1"></i> Balanceamento</button>
            </nav>

            <div id="bo-dynamic-content" class="w-full relative min-h-[500px]">
                <div id="bo-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-500 mb-4"></div>
                    <p class="text-purple-400 font-cinzel tracking-widest">Carregando Matrizes...</p>
                </div>
                <div id="bo-view" class="w-full hidden"></div>
            </div>
        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('bo-tabs-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.bo-tab-btn');
        if (btn) {
            boState.activeTab = btn.dataset.tab;
            boState.selectedItem = null;
            boState.pendingImage = null;
            boState.filter = '';
            renderBackofficeTab(); 
        }
    });
}

async function loadAllData() {
    try {
        const newCache = {};
        const promises = Object.entries(COLL_MAP).map(async ([key, info]) => {
            const q = query(collection(db, info.c), orderBy(info.sortKey || 'nome', info.sort || 'asc'));
            const snap = await getDocs(q);
            newCache[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
        
        await Promise.all(promises);
        boState.cache = newCache;
        
        document.getElementById('bo-loading').classList.add('hidden');
        document.getElementById('bo-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('bo-loading').innerHTML = '<p class="text-red-500">Erro crítico ao carregar Banco de Dados.</p>';
    }
}

function renderActiveView() {
    const view = document.getElementById('bo-view');
    if (!view) return;

    if (boState.activeTab === 'balanceamento') {
        view.innerHTML = renderBalanceamento();
        return;
    }

    if (boState.selectedItem !== null || boState.activeTab === 'new') {
        view.innerHTML = renderForm();
    } else {
        view.innerHTML = renderList();
    }
}

// ------------------------------------------------------------------------------------
// 1. UI DE LISTAGEM
// ------------------------------------------------------------------------------------
function renderList() {
    const tab = boState.activeTab;
    const data = boState.cache[tab] || [];
    const term = boState.filter.toLowerCase();
    const filtered = data.filter(i => (i.nome||i.id||'').toLowerCase().includes(term));
    const showImages = ['habilidades', 'racas', 'classes', 'subclasses', 'profissoes'].includes(tab);

    let listHtml = '';
    if (showImages) {
        listHtml = `
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-[600px] overflow-y-auto custom-scroll p-2">
                ${filtered.map(i => `
                    <div class="aspect-square bg-slate-900 ${tab === 'habilidades' ? 'rounded-full' : 'rounded-xl'} border border-slate-700 relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-colors" onclick="window.boTools.editItem('${i.id}')">
                        <img src="${i.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=X'}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100">
                        <div class="absolute bottom-0 w-full bg-black/80 text-white text-[9px] text-center p-1 truncate font-bold">${escapeHTML(i.nome)}</div>
                        <button onclick="event.stopPropagation(); window.boTools.deleteItem('${tab}', '${i.id}', '${escapeHTML(i.nome)}')"" class="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        listHtml = `
            <div class="space-y-2 max-h-[600px] overflow-y-auto custom-scroll pr-2">
                ${filtered.map(i => `
                    <div class="flex justify-between items-center bg-slate-800 p-3 rounded-lg border-l-4 border-amber-500 hover:bg-slate-700 transition-colors">
                        <span class="font-bold text-slate-200">${escapeHTML(i.nome || i.id)}</span>
                        <div class="flex gap-2">
                            <button onclick="window.boTools.editItem('${i.id}')" class="w-8 h-8 rounded bg-sky-700 hover:bg-sky-600 text-white flex items-center justify-center"><i class="fas fa-pen text-xs"></i></button>
                            <button onclick="window.boTools.deleteItem('${tab}', '${i.id}', '${escapeHTML(i.nome || i.id)}')"" class="w-8 h-8 rounded bg-red-700 hover:bg-red-600 text-white flex items-center justify-center"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 animate-fade-in">
            <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <input type="text" placeholder="Filtrar nesta categoria..." value="${boState.filter}" onkeyup="window.boTools.setFilter(this.value)" class="w-full sm:w-1/2 bg-slate-900 border border-slate-600 px-4 py-2 rounded-lg text-white outline-none focus:border-amber-500">
                <button onclick="window.boTools.newItem()" class="btn bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg whitespace-nowrap"><i class="fas fa-plus mr-2"></i> Criar Novo</button>
            </div>
            ${filtered.length === 0 ? '<p class="text-slate-500 text-center py-10 italic">Nenhum registro encontrado.</p>' : listHtml}
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// 2. UI DE FORMULÁRIOS (CRUD)
// ------------------------------------------------------------------------------------
function renderForm() {
    const tab = boState.activeTab;
    const item = boState.selectedItem || {};
    const isEdit = !!item.id;
    const title = isEdit ? `Editando: ${escapeHTML(item.nome)}` : `Novo Registro: ${COLL_MAP[tab].name}`;
    const hasImage = ['habilidades', 'racas', 'classes', 'subclasses', 'profissoes'].includes(tab);

    let fieldsHtml = '';

    if (tab === 'habilidades') {
        fieldsHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field"><label class="text-xs text-slate-400">Tipo Efeito</label><select id="f-tipoEf" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"><option ${item.tipoEfeitoHabildiade==='Ofensivo'?'selected':''}>Ofensivo</option><option ${item.tipoEfeitoHabildiade==='Defensivo'?'selected':''}>Defensivo</option><option ${item.tipoEfeitoHabildiade==='BUFF'?'selected':''}>BUFF</option><option ${item.tipoEfeitoHabildiade==='DEBUFF'?'selected':''}>DEBUFF</option><option ${item.tipoEfeitoHabildiade==='Utilidade'?'selected':''}>Utilidade</option><option ${item.tipoEfeitoHabildiade==='Neutro'?'selected':''}>Neutro</option></select></div>
                <div class="form-field"><label class="text-xs text-slate-400">Tipo Ação</label><select id="f-tipoAc" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"><option ${item.tipoAcaoHabildiade==='Ação'?'selected':''}>Ação</option><option ${item.tipoAcaoHabildiade==='Reação'?'selected':''}>Reação</option><option ${item.tipoAcaoHabildiade==='Livre'?'selected':''}>Livre</option></select></div>
                <div class="form-field"><label class="text-xs text-slate-400">Duração</label><input type="text" id="f-dur" value="${escapeHTML(item.duracaoHabilidade||'Instantâneo')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                
                <div class="form-field md:col-span-2"><label class="text-xs text-slate-400">Descrição</label><textarea id="f-desc" rows="3" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item.descricaoEfeito||'')}</textarea></div>
                
                <div class="form-field"><label class="text-xs text-slate-400">Custo MP</label><input type="number" id="f-mp" value="${item.gastoMpUso||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                <div class="form-field"><label class="text-xs text-slate-400">Dano Base</label><input type="number" id="f-dano" value="${item.efeitoDanoBaseUsoHabilidade||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                <div class="form-field"><label class="text-xs text-slate-400">Qtd Alvos</label><input type="number" id="f-alvos" value="${item.quantidadeAlvos||1}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                <div class="form-field"><label class="text-xs text-slate-400">Custo Aprender (AP)</label><input type="number" id="f-ap" value="${item.custoAprendizado||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                
                <div class="md:col-span-2 mt-4">${renderCheckboxList('Restrição de Classes', 'cb_classes', boState.cache.classes, item.restricaoClasses||[])}</div>
                <div class="md:col-span-2">${renderCheckboxList('Restrição de Subclasses', 'cb_subs', boState.cache.subclasses, item.restricaoSubclasses||[])}</div>
            </div>
        `;
    } 
    else if (['racas', 'classes', 'subclasses'].includes(tab)) {
        const isRaca = tab === 'racas';
        const prefix = isRaca ? 'Raca' : (tab === 'classes' ? 'Classe' : 'Subclasse');
        fieldsHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <h4 class="text-amber-500 font-bold text-sm mt-4 border-b border-slate-700 pb-1">Bônus Base</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">HP</label><input type="number" id="f-hp" value="${item[`bonusHp${prefix}Base`]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">MP</label><input type="number" id="f-mp" value="${item[`bonusMp${prefix}Base`]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">ATK</label><input type="number" id="f-atk" value="${item[`bonusAtk${prefix==='Classe'?'AtaqueClasse':(prefix==='Subclasse'?'AtaqueSubclasse':'AtkRaca')}Base`]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">DEF</label><input type="number" id="f-def" value="${item[`bonusDef${prefix==='Classe'?'esaClasse':(prefix==='Subclasse'?'esaSubclasse':'Raca')}Base`]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">EVA</label><input type="number" id="f-eva" value="${item[`bonusEva${prefix==='Classe'?'saoClasse':(prefix==='Subclasse'?'saoSubclasse':'Raca')}Base`]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                </div>
                ${!isRaca ? renderCheckboxList('Habilidades Iniciais', 'cb_habs', boState.cache.habilidades, item.habilidadesDisponiveis||[]) : ''}
            </div>
        `;
    }
    else if (tab === 'profissoes') {
        fieldsHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field"><label class="text-xs text-slate-400">Descrição</label><textarea id="f-desc" rows="3" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item.descricao||'')}</textarea></div>
                <div class="form-field"><label class="text-xs text-slate-400">Level Requerido</label><input type="number" id="f-lvl" value="${item.levelRequerido||1}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
            </div>
        `;
    }
    else if (tab === 'efeitos') {
        fieldsHtml = `
            <div class="grid grid-cols-2 gap-4">
                <div class="form-field col-span-2"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field col-span-2"><label class="text-xs text-slate-400">Descrição</label><textarea id="f-desc" rows="2" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item.descricao||'')}</textarea></div>
                <div class="form-field"><label class="text-xs text-slate-400">Aplicação</label><select id="f-apl" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"><option ${item.aplicacao==='Positivo'?'selected':''}>Positivo</option><option ${item.aplicacao==='Negativo'?'selected':''}>Negativo</option><option ${item.aplicacao==='Neutro'?'selected':''}>Neutro</option></select></div>
                <div class="form-field"><label class="text-xs text-slate-400">Valor Numérico</label><input type="number" id="f-val" value="${Math.abs(item.valor||0)}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
            </div>
        `;
    }
    else if (tab === 'sessoes') {
        fieldsHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-field"><label class="text-xs text-slate-400">Nome da Sessão</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||item.name||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                    <div class="form-field"><label class="text-xs text-slate-400">Data/Ano</label><input type="text" id="f-ano" value="${escapeHTML(item.ano||new Date().getFullYear())}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                </div>
                ${renderCheckboxList('Personagens Presentes', 'cb_chars', boState.cache.personagens, item.playerIds||item.personagensPresentes||[])}
            </div>
        `;
    }
    else {
        // Genérico (Terrenos, Vantagens)
        fieldsHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field"><label class="text-xs text-slate-400">Descrição / Notas</label><textarea id="f-desc" rows="4" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item.descricao||item.efeito||item.anotacoesMestre||'')}</textarea></div>
            </div>
        `;
    }

    return `
        <div class="bg-slate-800/90 p-8 rounded-2xl border border-amber-500/50 shadow-2xl max-w-3xl mx-auto animate-fade-in relative">
            <h2 class="text-2xl font-bold font-cinzel text-amber-400 mb-6 border-b border-slate-600 pb-4">${title}</h2>
            <form id="bo-form" class="space-y-6" onsubmit="window.boTools.saveItem(event)">
                <input type="hidden" id="f-id" value="${item.id || ''}">
                <input type="hidden" id="f-oldImg" value="${item.imagemUrl || ''}">

                ${hasImage ? `
                    <div class="flex items-center gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                        <img id="bo-img-preview" src="${item.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=Img'}" class="w-20 h-20 rounded-lg object-cover border border-slate-600">
                        <div class="flex-grow">
                            <label class="text-xs text-slate-400 block mb-2">Ícone da Entidade</label>
                            <input type="file" id="f-img" accept="image/*" onchange="window.boTools.previewImage(this)" class="text-sm text-slate-400 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700">
                        </div>
                    </div>
                ` : ''}

                ${fieldsHtml}

                <div class="flex gap-4 pt-6 mt-6 border-t border-slate-700">
                    <button type="submit" id="btn-save-bo" class="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors shadow-lg"><i class="fas fa-save mr-2"></i> Gravar</button>
                    <button type="button" onclick="window.boTools.cancelEdit()" class="px-8 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors">Cancelar</button>
                </div>
            </form>
        </div>
    `;
}

function renderCheckboxList(title, name, cacheList, selectedIds) {
    if (!cacheList || cacheList.length === 0) return '';
    return `
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <h4 class="text-sm font-bold text-amber-500 mb-3">${title}</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto custom-scroll pr-2">
                ${cacheList.map(c => `
                    <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white bg-slate-800 p-1.5 rounded border border-slate-600 hover:border-slate-400">
                        <input type="checkbox" name="${name}" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''} class="rounded bg-slate-900 border-slate-500 text-amber-500">
                        <span class="truncate">${escapeHTML(c.nome || c.id)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// 3. UI DE BALANCEAMENTO (MATRIZES)
// ------------------------------------------------------------------------------------
function renderBalanceamento() {
    const isHab = boState.balTab === 'habilidades';
    
    return `
        <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 animate-fade-in flex flex-col h-[75vh]">
            <header class="flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-bold font-cinzel text-purple-400"><i class="fas fa-balance-scale mr-2"></i> Central de Balanceamento</h2>
                    <p class="text-xs text-slate-400 mt-1">Edição em lote. Modificações são salvas instantaneamente em cache e enviadas juntas.</p>
                </div>
                <div class="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                    <button onclick="window.boTools.switchBalTab('habilidades')" class="px-6 py-2 rounded-md font-bold text-sm transition-colors ${isHab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}">Magias & Habilidades</button>
                    <button onclick="window.boTools.switchBalTab('atributos')" class="px-6 py-2 rounded-md font-bold text-sm transition-colors ${!isHab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}">Atributos Base</button>
                </div>
            </header>

            ${isHab ? renderBalHabilidades() : renderBalAtributos()}
        </div>
    `;
}

function renderBalHabilidades() {
    let items = boState.cache.habilidades;
    
    // Filtros
    if (boState.balHabFilterClass) items = items.filter(i => i.restricaoClasses?.includes(boState.balHabFilterClass));
    if (boState.balHabFilterSub) items = items.filter(i => i.restricaoSubclasses?.includes(boState.balHabFilterSub));
    if (boState.balHabSearch) items = items.filter(i => i.nome.toLowerCase().includes(boState.balHabSearch.toLowerCase()));

    const pendingCount = Object.keys(boState.balHabEdits).length;

    return `
        <div class="flex flex-col h-full overflow-hidden">
            <div class="flex flex-wrap gap-4 items-center mb-4 bg-slate-900 p-4 rounded-xl border border-slate-700">
                <input type="text" placeholder="Procurar magia..." value="${boState.balHabSearch}" onkeyup="window.boTools.filterBalHab('search', this.value)" class="flex-grow bg-slate-800 border border-slate-600 px-3 py-2 rounded text-sm text-white outline-none focus:border-purple-500">
                
                <select onchange="window.boTools.filterBalHab('class', this.value)" class="bg-slate-800 border border-slate-600 px-3 py-2 rounded text-sm text-slate-300 outline-none focus:border-purple-500">
                    <option value="">Todas Classes</option>
                    ${boState.cache.classes.map(c => `<option value="${c.id}" ${boState.balHabFilterClass===c.id?'selected':''}>${escapeHTML(c.nome)}</option>`).join('')}
                </select>

                <select onchange="window.boTools.filterBalHab('sub', this.value)" class="bg-slate-800 border border-slate-600 px-3 py-2 rounded text-sm text-slate-300 outline-none focus:border-purple-500">
                    <option value="">Todas Subclasses</option>
                    ${boState.cache.subclasses.map(c => `<option value="${c.id}" ${boState.balHabFilterSub===c.id?'selected':''}>${escapeHTML(c.nome)}</option>`).join('')}
                </select>

                <button onclick="window.boTools.saveBalHab()" class="btn bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-colors ${pendingCount===0?'opacity-50 cursor-not-allowed':''}" ${pendingCount===0?'disabled':''}>
                    💾 Salvar Lote (${pendingCount})
                </button>
            </div>

            <div class="flex-grow overflow-auto custom-scroll border border-slate-700 rounded-xl bg-slate-900">
                <table class="w-full text-left text-xs border-collapse relative">
                    <thead class="sticky top-0 bg-slate-950 text-purple-400 z-10 shadow-md">
                        <tr>
                            <th class="p-3 border-b border-r border-slate-700 min-w-[200px]">Nome da Habilidade</th>
                            <th class="p-3 border-b border-r border-slate-700 text-center w-24">Custo MP</th>
                            <th class="p-3 border-b border-r border-slate-700 text-center w-24">Custo AP</th>
                            <th class="p-3 border-b border-r border-slate-700 text-center w-24">Dano Base</th>
                            <th class="p-3 border-b border-r border-slate-700 text-center w-24">Alvos</th>
                            <th class="p-3 border-b border-slate-700 text-center w-24">Alcance (m)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${items.length === 0 ? '<tr><td colSpan="6" class="text-center p-8 text-slate-500">Nenhuma habilidade encontrada.</td></tr>' : ''}
                        ${items.map(h => {
                            const e = boState.balHabEdits[h.id] || {};
                            const isEdited = Object.keys(e).length > 0;
                            const getVal = (field) => e[field] !== undefined ? e[field] : (h[field]||0);
                            return `
                                <tr class="hover:bg-slate-800/50 transition-colors ${isEdited ? 'bg-purple-900/20' : ''}">
                                    <td class="p-2 border-r border-slate-700 font-bold text-slate-300">${escapeHTML(h.nome)}</td>
                                    <td class="p-0 border-r border-slate-700"><input type="number" onchange="window.boTools.editBalHab('${h.id}','gastoMpUso',this.value)" value="${getVal('gastoMpUso')}" class="w-full bg-transparent border-0 text-center py-2 focus:bg-slate-800 outline-none ${e.gastoMpUso!==undefined?'text-purple-400 font-bold':'text-white'}"></td>
                                    <td class="p-0 border-r border-slate-700"><input type="number" onchange="window.boTools.editBalHab('${h.id}','custoAprendizado',this.value)" value="${getVal('custoAprendizado')}" class="w-full bg-transparent border-0 text-center py-2 focus:bg-slate-800 outline-none ${e.custoAprendizado!==undefined?'text-purple-400 font-bold':'text-white'}"></td>
                                    <td class="p-0 border-r border-slate-700"><input type="number" onchange="window.boTools.editBalHab('${h.id}','efeitoDanoBaseUsoHabilidade',this.value)" value="${getVal('efeitoDanoBaseUsoHabilidade')}" class="w-full bg-transparent border-0 text-center py-2 focus:bg-slate-800 outline-none ${e.efeitoDanoBaseUsoHabilidade!==undefined?'text-purple-400 font-bold':'text-white'}"></td>
                                    <td class="p-0 border-r border-slate-700"><input type="number" onchange="window.boTools.editBalHab('${h.id}','quantidadeAlvos',this.value)" value="${getVal('quantidadeAlvos')}" class="w-full bg-transparent border-0 text-center py-2 focus:bg-slate-800 outline-none ${e.quantidadeAlvos!==undefined?'text-purple-400 font-bold':'text-white'}"></td>
                                    <td class="p-0"><input type="number" onchange="window.boTools.editBalHab('${h.id}','movimentacaoHabilidade',this.value)" value="${getVal('movimentacaoHabilidade')}" class="w-full bg-transparent border-0 text-center py-2 focus:bg-slate-800 outline-none ${e.movimentacaoHabilidade!==undefined?'text-purple-400 font-bold':'text-white'}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderBalAtributos() {
    const isDef = boState.balAttrMode === 'definicao';
    const attrs = boState.cache.atributos || [];
    
    let contentHtml = '';
    
    if (isDef) {
        contentHtml = `
            <div class="flex flex-col gap-6">
                <form class="flex gap-4 items-end bg-slate-900 p-4 rounded-xl border border-slate-700" onsubmit="window.boTools.saveAttrBase(event)">
                    <div class="flex-1"><label class="text-xs text-amber-500">ID Fixo (Ex: atr_forca)</label><input type="text" id="attr-id" required class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                    <div class="flex-1"><label class="text-xs text-amber-500">Nome de Exibição</label><input type="text" id="attr-nome" required class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                    <div class="flex-1"><label class="text-xs text-amber-500">Efeito</label><input type="text" id="attr-efeito" class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                    <button type="submit" class="btn bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-6 rounded"><i class="fas fa-plus"></i></button>
                </form>
                
                <div class="overflow-auto border border-slate-700 rounded-xl bg-slate-900 max-h-[50vh] custom-scroll">
                    <table class="w-full text-left text-sm border-collapse">
                        <thead class="bg-slate-950 text-amber-500 sticky top-0 shadow-md"><tr><th class="p-3">ID Base</th><th class="p-3">Nome</th><th class="p-3">Efeito Base</th><th class="p-3">Ações</th></tr></thead>
                        <tbody class="divide-y divide-slate-800">
                            ${attrs.map(a => `
                                <tr class="hover:bg-slate-800/50">
                                    <td class="p-3 font-mono text-slate-400 text-xs">${a.id}</td>
                                    <td class="p-3 font-bold text-white">${escapeHTML(a.nome)}</td>
                                    <td class="p-3 text-slate-300 text-xs">${escapeHTML(a.efeito||'')}</td>
                                    <td class="p-3"><button onclick="window.boTools.deleteAttr('${a.id}')" class="text-red-500 hover:text-red-400"><i class="fas fa-trash"></i></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        // MATRIZ DE INTERSECÇÃO
        const eixoList = boState.cache[boState.balAttrEixo] || [];
        const pendingCount = Object.keys(boState.balAttrEdits).length;
        
        contentHtml = `
            <div class="flex flex-col h-full overflow-hidden">
                <div class="flex justify-between items-center mb-4 bg-slate-900 p-4 rounded-xl border border-slate-700">
                    <div class="flex items-center gap-4">
                        <label class="text-sm font-bold text-slate-300 uppercase">Eixo Alvo:</label>
                        <select onchange="window.boTools.switchBalAttrEixo(this.value)" class="bg-slate-800 border border-slate-600 px-4 py-2 rounded text-amber-400 font-bold outline-none focus:border-purple-500">
                            <option value="classes" ${boState.balAttrEixo==='classes'?'selected':''}>Classes</option>
                            <option value="subclasses" ${boState.balAttrEixo==='subclasses'?'selected':''}>Subclasses</option>
                            <option value="racas" ${boState.balAttrEixo==='racas'?'selected':''}>Raças</option>
                        </select>
                    </div>
                    <button onclick="window.boTools.saveBalAttr()" class="btn bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded shadow-lg transition-colors ${pendingCount===0?'opacity-50 cursor-not-allowed':''}" ${pendingCount===0?'disabled':''}>
                        💾 Salvar Lote Matriz (${pendingCount})
                    </button>
                </div>
                
                <div class="flex-grow overflow-auto custom-scroll border border-slate-700 rounded-xl bg-slate-900 relative">
                    <table class="text-left text-xs border-collapse">
                        <thead class="sticky top-0 bg-slate-950 text-amber-500 z-20 shadow-md">
                            <tr>
                                <th class="p-3 border-b border-r border-slate-700 min-w-[150px] sticky left-0 bg-slate-950 z-30">Atributo Base</th>
                                ${eixoList.map(e => `<th class="p-2 border-b border-r border-slate-700 text-center min-w-[100px] truncate" title="${e.nome}">${escapeHTML(e.nome)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800">
                            ${attrs.length === 0 ? '<tr><td class="p-8 text-center text-slate-500">Crie atributos no Dicionário Base primeiro.</td></tr>' : ''}
                            ${attrs.map(attr => `
                                <tr class="hover:bg-slate-800/50 transition-colors">
                                    <td class="p-3 border-r border-slate-700 font-bold text-slate-300 sticky left-0 bg-slate-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">${escapeHTML(attr.nome)}<br><span class="text-[9px] font-normal text-slate-500 font-mono">${attr.id}</span></td>
                                    ${eixoList.map(item => {
                                        const e = boState.balAttrEdits[item.id] || {};
                                        const isEdited = e[attr.id] !== undefined;
                                        const val = isEdited ? e[attr.id] : (item.modificadoresAtributos?.[attr.id] || 0);
                                        return `
                                            <td class="p-0 border-r border-slate-700 ${isEdited ? 'bg-amber-900/20' : ''}">
                                                <input type="number" onchange="window.boTools.editBalAttr('${item.id}','${attr.id}',this.value)" value="${val}" class="w-full bg-transparent border-0 text-center py-3 focus:bg-slate-800 outline-none ${isEdited?'text-amber-400 font-bold':'text-white'}">
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return `
        <div class="flex flex-col h-full">
            <div class="flex gap-2 mb-4">
                <button onclick="window.boTools.switchBalAttrMode('definicao')" class="px-4 py-2 rounded-t-lg font-bold text-xs uppercase tracking-widest transition-colors ${isDef ? 'bg-slate-800 text-amber-500 border-t-2 border-amber-500' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}">1. Dicionário Base</button>
                <button onclick="window.boTools.switchBalAttrMode('matriz')" class="px-4 py-2 rounded-t-lg font-bold text-xs uppercase tracking-widest transition-colors ${!isDef ? 'bg-slate-800 text-amber-500 border-t-2 border-amber-500' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}">2. Matriz de Modificadores</button>
            </div>
            ${contentHtml}
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// AÇÕES EXPOSTAS NO WINDOW (BO_TOOLS)
// ------------------------------------------------------------------------------------
window.boTools = {
    // Ações Gerais
    setFilter: (val) => { boState.filter = val; renderActiveView(); },
    newItem: () => { boState.selectedItem = null; boState.activeTab = 'new'; renderActiveView(); },
    editItem: (id) => { boState.selectedItem = boState.cache[boState.activeTab].find(i => i.id === id); renderActiveView(); },
    cancelEdit: () => { boState.selectedItem = null; boState.pendingImage = null; boState.activeTab = document.querySelector('.bo-tab-btn.active').dataset.tab; renderActiveView(); },
    
    previewImage: (input) => {
        if (input.files && input.files[0]) {
            boState.pendingImage = input.files[0];
            document.getElementById('bo-img-preview').src = URL.createObjectURL(input.files[0]);
        }
    },

    deleteItem: async (tab, id, nome) => {
        if (!confirm(`APAGAR PERMANENTEMENTE: ${nome}?\nIsto pode quebrar fichas vinculadas.`)) return;
        try {
            await deleteDoc(doc(db, COLL_MAP[tab].c, id));
            alert("Registro apagado.");
            await loadAllData();
        } catch(e) { alert("Erro ao apagar: " + e.message); }
    },

    saveItem: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-bo');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
        btn.disabled = true;

        const tab = document.querySelector('.bo-tab-btn.active').dataset.tab;
        const collectionName = COLL_MAP[tab].c;
        const id = document.getElementById('f-id').value;
        const oldImg = document.getElementById('f-oldImg').value;

        const getVal = elId => document.getElementById(elId)?.value || '';
        const getNum = elId => Number(document.getElementById(elId)?.value) || 0;

        let payload = { nome: getVal('f-nome'), atualizadoEm: serverTimestamp() };

        // Preenchimento Específico
        if (tab === 'habilidades') {
            payload.tipoEfeitoHabildiade = getVal('f-tipoEf'); payload.tipoAcaoHabildiade = getVal('f-tipoAc');
            payload.descricaoEfeito = getVal('f-desc'); payload.duracaoHabilidade = getVal('f-dur');
            payload.gastoMpUso = getNum('f-mp'); payload.efeitoDanoBaseUsoHabilidade = getNum('f-dano');
            payload.movimentacaoHabilidade = getNum('f-mov'); payload.quantidadeAlvos = getNum('f-alvos');
            payload.custoAprendizado = getNum('f-ap');
            payload.restricaoClasses = Array.from(document.querySelectorAll('input[name="cb_classes"]:checked')).map(c => c.value);
            payload.restricaoSubclasses = Array.from(document.querySelectorAll('input[name="cb_subs"]:checked')).map(c => c.value);
        } else if (['racas', 'classes', 'subclasses'].includes(tab)) {
            const pre = tab === 'racas' ? 'Raca' : (tab === 'classes' ? 'Classe' : 'Subclasse');
            payload[`bonusHp${pre}Base`] = getNum('f-hp'); payload[`bonusMp${pre}Base`] = getNum('f-mp');
            payload[`bonusAtk${pre==='Classe'?'AtaqueClasse':(pre==='Subclasse'?'AtaqueSubclasse':'AtkRaca')}Base`] = getNum('f-atk');
            payload[`bonusDef${pre==='Classe'?'esaClasse':(pre==='Subclasse'?'esaSubclasse':'Raca')}Base`] = getNum('f-def');
            payload[`bonusEva${pre==='Classe'?'saoClasse':(pre==='Subclasse'?'saoSubclasse':'Raca')}Base`] = getNum('f-eva');
            if(tab !== 'racas') payload.habilidadesDisponiveis = Array.from(document.querySelectorAll('input[name="cb_habs"]:checked')).map(c => c.value);
        } else if (tab === 'profissoes') {
            payload.descricao = getVal('f-desc'); payload.levelRequerido = getNum('f-lvl');
        } else if (tab === 'efeitos') {
            payload.descricao = getVal('f-desc'); payload.aplicacao = getVal('f-apl');
            payload.valor = payload.aplicacao === 'Negativo' ? -Math.abs(getNum('f-val')) : Math.abs(getNum('f-val'));
        } else if (tab === 'sessoes') {
            payload.nome = getVal('f-nome'); payload.ano = getVal('f-ano');
            payload.playerIds = Array.from(document.querySelectorAll('input[name="cb_chars"]:checked')).map(c => c.value);
        } else {
            payload.descricao = getVal('f-desc');
        }

        // Upload de Imagem Seguro e Comprimido
        let finalUrl = oldImg;
        if (boState.pendingImage) {
            try {
                if (oldImg && oldImg.includes('firebasestorage')) { try { await deleteObject(ref(storage, oldImg)); } catch(e){} }
                const blob = await compressImage(boState.pendingImage, 200, 200, 0.7);
                const refName = `imagens_rpg/${tab}/${Date.now()}_icone.jpg`;
                const storageRef = ref(storage, refName);
                await uploadBytes(storageRef, blob);
                finalUrl = await getDownloadURL(storageRef);
            } catch(e) { console.error(e); }
        }
        if (finalUrl) payload.imagemUrl = finalUrl;

        // Salvar
        try {
            if (id) { await updateDoc(doc(db, collectionName, id), payload); } 
            else { payload.criadoEm = serverTimestamp(); await setDoc(doc(collection(db, collectionName)), payload); }
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Salvo!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            setTimeout(() => { boState.selectedItem = null; boState.pendingImage = null; boState.activeTab = tab; loadAllData(); }, 1000);
        } catch (e) {
            alert("Erro: " + e.message); btn.innerHTML = oldHtml; btn.disabled = false;
        }
    },

    // --- Ações do Balanceamento ---
    switchBalTab: (tab) => { boState.balTab = tab; renderActiveView(); },
    
    // Hab
    filterBalHab: (type, val) => {
        if(type==='search') boState.balHabSearch = val;
        if(type==='class') boState.balHabFilterClass = val;
        if(type==='sub') boState.balHabFilterSub = val;
        renderActiveView();
    },
    editBalHab: (id, field, val) => {
        if(!boState.balHabEdits[id]) boState.balHabEdits[id] = {};
        boState.balHabEdits[id][field] = Number(val) || 0;
        renderActiveView();
    },
    saveBalHab: async () => {
        if(!confirm("Salvar todas as alterações da matriz de habilidades?")) return;
        try {
            const batch = writeBatch(db);
            Object.entries(boState.balHabEdits).forEach(([id, fields]) => {
                batch.update(doc(db, 'rpg_habilidades', id), { ...fields, atualizadoEm: serverTimestamp() });
            });
            await batch.commit();
            alert("Balanceamento de Habilidades concluído!");
            boState.balHabEdits = {};
            loadAllData();
        } catch(e) { alert("Erro no lote: "+e.message); }
    },

    // Attr
    switchBalAttrMode: (mode) => { boState.balAttrMode = mode; renderActiveView(); },
    switchBalAttrEixo: (eixo) => { boState.balAttrEixo = eixo; boState.balAttrEdits = {}; renderActiveView(); },
    
    saveAttrBase: async (e) => {
        e.preventDefault();
        const id = document.getElementById('attr-id').value.trim();
        const nome = document.getElementById('attr-nome').value.trim();
        const efeito = document.getElementById('attr-efeito').value.trim();
        if(!id || !nome) return;
        try {
            await setDoc(doc(db, 'rpg_atributos', id), { nome, efeito, criadoEm: serverTimestamp() });
            loadAllData();
        } catch(err) { alert("Erro: "+err.message); }
    },
    deleteAttr: async (id) => {
        if(!confirm("Cuidado! Apagar atributo base?")) return;
        await deleteDoc(doc(db, 'rpg_atributos', id));
        loadAllData();
    },
    editBalAttr: (itemId, attrId, val) => {
        if(!boState.balAttrEdits[itemId]) boState.balAttrEdits[itemId] = {};
        boState.balAttrEdits[itemId][attrId] = Number(val) || 0;
        renderActiveView();
    },
    saveBalAttr: async () => {
        if(!confirm("Salvar modificadores de atributos cruzados?")) return;
        try {
            const batch = writeBatch(db);
            const collName = COLL_MAP[boState.balAttrEixo].c;
            Object.entries(boState.balAttrEdits).forEach(([itemId, mods]) => {
                const updates = { atualizadoEm: serverTimestamp() };
                Object.entries(mods).forEach(([attrId, v]) => updates[`modificadoresAtributos.${attrId}`] = v);
                batch.update(doc(db, collName, itemId), updates);
            });
            await batch.commit();
            alert("Matriz de atributos atualizada com sucesso!");
            boState.balAttrEdits = {};
            loadAllData();
        } catch(e) { alert("Erro no lote: "+e.message); }
    }
};