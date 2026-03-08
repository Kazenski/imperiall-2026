import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';

const COLLECTION_FICHAS = 'rpg_fichasNPCMonstros';
const COLLECTION_RACAS_MONSTROS = 'rpg_racasMonstros';
const COLLECTION_AMBIENTES = 'rpg_terrenosBonus';

let entityList = [];
let editingEntityId = null;
let allRaces = [];
let allClasses = [];
let allAmbientes = [];
let allItems = [];

// Estado local do editor
let currentDrops = {}; // { itemId: quantity }
let currentImageUrls = {};

export async function renderCadastroMonstrosTab() {
    const container = document.getElementById('cadastro-monstros-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left">
                    <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-red-500 tracking-widest drop-shadow-md"><i class="fas fa-dragon mr-3"></i> Cadastro de Seres & Monstros</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">O bestiário mestre de Imperiall</p>
                </div>
                <button onclick="window.cadastroMonstros.openEditor(null)" class="btn bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i> Criar Nova Ficha Base
                </button>
            </header>

            <div id="monstro-list-view" class="w-full flex flex-col gap-4">
                <div class="flex justify-center p-12" id="monstro-loading"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-red-500"></div></div>
                <div id="monstro-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 hidden"></div>
            </div>

            <div id="monstro-editor-view" class="w-full hidden flex-col gap-6 animate-fade-in bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div class="flex justify-between items-center border-b border-slate-600 pb-4 mb-4">
                    <h2 id="monstro-editor-title" class="text-2xl font-cinzel font-bold text-amber-400">Criar Novo Registro</h2>
                    <button onclick="window.cadastroMonstros.closeEditor()" class="text-slate-400 hover:text-red-500 text-2xl transition-colors"><i class="fas fa-times"></i></button>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div class="space-y-6">
                        
                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700 space-y-4">
                            <div>
                                <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Nome do Ser</label>
                                <input type="text" id="monstro-nome" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none">
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Raça</label>
                                    <select id="monstro-raca" class="w-full px-3 py-3 bg-slate-950 border border-slate-600 rounded-lg text-slate-300 focus:border-amber-500 outline-none"></select>
                                </div>
                                <div>
                                    <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Classe</label>
                                    <select id="monstro-classe" class="w-full px-3 py-3 bg-slate-950 border border-slate-600 rounded-lg text-slate-300 focus:border-amber-500 outline-none"></select>
                                </div>
                            </div>
                            <div>
                                <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Ambiente Principal</label>
                                <select id="monstro-ambiente" class="w-full px-3 py-3 bg-slate-950 border border-slate-600 rounded-lg text-slate-300 focus:border-amber-500 outline-none"></select>
                            </div>
                            <div>
                                <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Descrição e Lore</label>
                                <textarea id="monstro-descricao" rows="5" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none custom-scroll"></textarea>
                            </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Galeria de Imagens</h3>
                            <div class="grid grid-cols-3 sm:grid-cols-5 gap-3" id="monstro-image-slots">
                                </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Possíveis Drops</h3>
                            <div>
                                <label class="text-xs text-slate-400 block mb-2">Buscar Item na Central</label>
                                <input type="text" id="monstro-item-filter" placeholder="Procurar item..." class="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-sm mb-3" onkeyup="window.cadastroMonstros.renderItemGrids()">
                            </div>
                            
                            <label class="text-xs text-sky-400 font-bold block mb-2 uppercase tracking-widest">Itens Disponíveis (Clique para Inserir)</label>
                            <div id="monstro-available-items" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 p-2 bg-slate-950 rounded-lg border border-slate-700 max-h-[160px] overflow-y-auto custom-scroll mb-4"></div>

                            <label class="text-xs text-emerald-400 font-bold block mb-2 uppercase tracking-widest">Drops Selecionados (Qtd Máxima)</label>
                            <div id="monstro-selected-items" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-2 bg-emerald-950/20 rounded-lg border border-emerald-900/50 min-h-[100px] overflow-y-auto custom-scroll"></div>
                        </div>

                    </div>

                    <div class="space-y-6">
                        
                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Atributos Primários Base</h3>
                            <div class="grid grid-cols-3 md:grid-cols-5 gap-3">
                                <div><label class="text-[10px] text-slate-400 block mb-1">HP Máx</label><input type="number" id="monstro-hp" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">MP Máx</label><input type="number" id="monstro-mp" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">ATK</label><input type="number" id="monstro-atk" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">DEF</label><input type="number" id="monstro-def" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">EVA</label><input type="number" id="monstro-eva" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                            </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Modificadores Específicos</h3>
                            
                            <div class="space-y-4">
                                <div class="bg-slate-800 p-3 rounded-lg border border-slate-600">
                                    <h4 class="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Ataque</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        ${['Fisico','Magico','Elemental','Espiritual','Divino','Imunidade','Hibrido','Definitivo'].map(t => 
                                            `<div><label class="text-[9px] text-slate-400">${t}</label><input type="number" id="bonusAtaque${t}ItemBase" class="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-center text-xs"></div>`
                                        ).join('')}
                                    </div>
                                </div>
                                <div class="bg-slate-800 p-3 rounded-lg border border-slate-600">
                                    <h4 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Defesa</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        ${['Fisica','Magica','Elemental','Espiritual','Divina','Imunidade','Hibrida','Definitiva'].map(t => 
                                            `<div><label class="text-[9px] text-slate-400">${t}</label><input type="number" id="bonusDefesa${t}ItemBase" class="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-center text-xs"></div>`
                                        ).join('')}
                                    </div>
                                </div>
                                <div class="bg-slate-800 p-3 rounded-lg border border-slate-600">
                                    <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Evasão</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        ${['Fisica','Magica','Elemental','Espiritual','Divina','Imunidade','Hibrida','Definitiva'].map(t => 
                                            `<div><label class="text-[9px] text-slate-400">${t}</label><input type="number" id="bonusEvasao${t}ItemBase" class="w-full bg-slate-900 border border-slate-700 p-1 rounded text-white text-center text-xs"></div>`
                                        ).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                </div>

                <div class="flex gap-4 mt-4 pt-6 border-t border-slate-600">
                    <button id="monstro-btn-save" onclick="window.cadastroMonstros.saveEntity()" class="flex-grow py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-lg flex items-center justify-center">
                        <i class="fas fa-save mr-2"></i> Gravar no Bestiário
                    </button>
                </div>
            </div>

        </div>
    `;

    await loadInitialData();
}

async function loadInitialData() {
    const loading = document.getElementById('monstro-loading');
    const grid = document.getElementById('monstro-grid');
    if (!loading || !grid) return;

    try {
        const [rcSnap, clSnap, amSnap, item1Snap, item2Snap, bestiarioSnap] = await Promise.all([
            getDocs(query(collection(db, COLLECTION_RACAS_MONSTROS), orderBy("nome"))),
            getDocs(query(collection(db, "rpg_classes"), orderBy("nome"))),
            getDocs(query(collection(db, COLLECTION_AMBIENTES), orderBy("nome"))),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila')),
            getDocs(query(collection(db, COLLECTION_FICHAS), orderBy("nome")))
        ]);

        allRaces = rcSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allClasses = clSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allAmbientes = amSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const itemMap = new Map();
        item1Snap.forEach(d => itemMap.set(d.id, { id: d.id, ...d.data() }));
        item2Snap.forEach(d => itemMap.set(d.id, { id: d.id, ...d.data() }));
        allItems = Array.from(itemMap.values()).sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));

        entityList = bestiarioSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const fillSelect = (id, list) => {
            const el = document.getElementById(id);
            if(!el) return;
            el.innerHTML = '<option value="" class="bg-slate-900 text-slate-500">-- Indefinido --</option>';
            list.forEach(i => {
                const opt = new Option(i.nome, i.id);
                opt.className = "bg-slate-900 text-slate-200";
                el.add(opt);
            });
        };

        fillSelect('monstro-raca', allRaces);
        fillSelect('monstro-classe', allClasses);
        fillSelect('monstro-ambiente', allAmbientes);

        renderEntityGrid();
        
        loading.classList.add('hidden');
        grid.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        loading.innerHTML = '<p class="text-red-500">Falha ao buscar os arquivos do bestiário.</p>';
    }
}

function renderEntityGrid() {
    const grid = document.getElementById('monstro-grid');
    if (!grid) return;

    if (entityList.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center p-10 text-slate-500 italic bg-slate-800/50 rounded-xl border border-slate-700">Nenhuma criatura catalogada.</div>';
        return;
    }

    grid.innerHTML = entityList.map(ent => {
        const img = ent.imageUrls?.imagem1 || 'https://placehold.co/150x150/1e293b/a1a1aa?text=MONSTRO';
        const racaNome = allRaces.find(r => r.id === ent.racaId)?.nome || 'Raça Oculta';
        
        return `
            <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-lg flex items-center gap-4 hover:border-amber-500 transition-colors group">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 group-hover:border-amber-400 bg-black shrink-0 relative">
                    <img src="${img}" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow overflow-hidden">
                    <h3 class="font-bold text-lg text-white truncate">${escapeHTML(ent.nome)}</h3>
                    <p class="text-[10px] text-amber-500 uppercase tracking-widest truncate">${escapeHTML(racaNome)}</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="window.cadastroMonstros.openEditor('${ent.id}')" class="w-8 h-8 rounded bg-sky-900/50 text-sky-400 hover:bg-sky-600 hover:text-white flex items-center justify-center transition-colors" title="Editar Ser">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="window.cadastroMonstros.deleteEntity('${ent.id}')" class="w-8 h-8 rounded bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Excluir Ser">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderImageSlots() {
    const container = document.getElementById('monstro-image-slots');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `imagem${i}`;
        const currentUrl = currentImageUrls[key] || '';
        const hasImg = !!currentUrl;

        const slot = document.createElement('div');
        slot.className = `aspect-square rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden bg-slate-800 transition-colors group ${hasImg ? 'border-amber-500 border-solid' : 'border-slate-600 hover:border-slate-400'}`;
        
        slot.innerHTML = `
            <img id="preview-m-${key}" src="${currentUrl}" class="w-full h-full object-cover ${hasImg ? '' : 'hidden'}">
            <div id="icon-m-${key}" class="absolute inset-0 flex items-center justify-center text-slate-500 text-2xl group-hover:text-white pointer-events-none ${hasImg ? 'hidden' : ''}">
                <i class="fas fa-plus"></i>
            </div>
            <input type="file" id="upload-m-${key}" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Upload Imagem">
            <input type="hidden" id="existing-m-${key}" value="${currentUrl}">
        `;

        const input = slot.querySelector('input[type="file"]');
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                slot.querySelector('img').src = url;
                slot.querySelector('img').classList.remove('hidden');
                slot.querySelector('div').classList.add('hidden');
                slot.classList.replace('border-slate-600', 'border-amber-500');
                slot.classList.replace('border-dashed', 'border-solid');
            }
        });

        container.appendChild(slot);
    }
}

function renderItemGrids() {
    const availableDiv = document.getElementById('monstro-available-items');
    const selectedDiv = document.getElementById('monstro-selected-items');
    const searchEl = document.getElementById('monstro-item-filter');
    if (!availableDiv || !selectedDiv || !searchEl) return;

    // RENDERIZAR DISPONÍVEIS
    const search = searchEl.value.toLowerCase();
    const availableItems = allItems.filter(i => (i.nome||'').toLowerCase().includes(search));

    if (availableItems.length === 0) {
        availableDiv.innerHTML = '<span class="text-slate-500 col-span-full text-center text-xs">Nenhum item achado.</span>';
    } else {
        availableDiv.innerHTML = availableItems.map(item => {
            const isSelected = currentDrops.hasOwnProperty(item.id);
            const img = item.imagemUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media";
            return `
                <div onclick="window.cadastroMonstros.toggleDrop('${item.id}')" class="aspect-square bg-slate-900 rounded border cursor-pointer relative overflow-hidden group transition-all transform hover:scale-105 ${isSelected ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10 scale-105' : 'border-slate-700'}">
                    <img src="${img}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 left-0 w-full bg-black/90 text-white text-[8px] text-center p-0.5 truncate leading-none">${escapeHTML(item.nome)}</div>
                </div>
            `;
        }).join('');
    }

    // RENDERIZAR SELECIONADOS
    const selectedIds = Object.keys(currentDrops);
    if (selectedIds.length === 0) {
        selectedDiv.innerHTML = '<span class="text-emerald-700/50 col-span-full text-center text-xs italic">Nenhum drop configurado.</span>';
    } else {
        selectedDiv.innerHTML = selectedIds.map(id => {
            const item = allItems.find(i => i.id === id);
            if (!item) return '';
            const img = item.imagemUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media";
            const qty = currentDrops[id];
            
            return `
                <div class="aspect-square bg-slate-900 rounded border border-emerald-600 relative overflow-hidden">
                    <img src="${img}" class="w-full h-full object-cover opacity-60">
                    <button onclick="window.cadastroMonstros.removeDrop('${id}')" class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[8px] z-10 shadow-lg border border-white hover:bg-red-500"><i class="fas fa-times"></i></button>
                    <div class="absolute bottom-0 w-full flex justify-center">
                        <input type="number" min="1" value="${qty}" onchange="window.cadastroMonstros.updateDropQtd('${id}', this.value)" class="w-full text-center text-xs font-bold text-black bg-white/90 outline-none border-t border-slate-700" title="Quantidade Máxima do Drop">
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ----------------------------------------------------------------------------------
// AÇÕES GLOBAIS EXPOSTAS
// ----------------------------------------------------------------------------------
window.cadastroMonstros = {
    renderItemGrids: renderItemGrids,

    toggleDrop: function(id) {
        if (currentDrops.hasOwnProperty(id)) {
            delete currentDrops[id];
        } else {
            currentDrops[id] = 1;
        }
        renderItemGrids();
    },

    removeDrop: function(id) {
        delete currentDrops[id];
        renderItemGrids();
    },

    updateDropQtd: function(id, val) {
        currentDrops[id] = parseInt(val, 10) || 1;
    },

    openEditor: function(id) {
        editingEntityId = id;
        const ent = id ? entityList.find(n => n.id === id) : null;

        document.getElementById('monstro-list-view').classList.add('hidden');
        document.getElementById('monstro-editor-view').classList.remove('hidden');
        document.getElementById('monstro-editor-view').classList.add('flex');

        document.getElementById('monstro-editor-title').textContent = ent ? 'Editar Bestiário' : 'Novo Registro de Ser';

        // Preenche Textos Base
        const setVal = (domId, val) => document.getElementById(domId).value = val || '';
        setVal('monstro-nome', ent?.nome);
        setVal('monstro-raca', ent?.racaId);
        setVal('monstro-classe', ent?.classeId);
        setVal('monstro-ambiente', ent?.ambienteId);
        setVal('monstro-descricao', ent?.descricao);

        // Preenche Stats
        setVal('monstro-hp', ent?.hpMaxPersonagemBase || 0);
        setVal('monstro-mp', ent?.mpMaxPersonagemBase || 0);
        setVal('monstro-atk', ent?.atk_base || 0);
        setVal('monstro-def', ent?.def_base || 0);
        setVal('monstro-eva', ent?.eva_base || 0);

        // Preenche Arrays Complexos de Bônus (Se não existir, zera)
        const advTypes = ['Fisico','Magico','Elemental','Espiritual','Divino','Imunidade','Hibrido','Definitivo'];
        
        advTypes.forEach(t => {
            setVal(`bonusAtaque${t}ItemBase`, ent?.[`bonusAtaque${t}ItemBase`] || 0);
        });

        ['Fisica','Magica','Elemental','Espiritual','Divina','Imunidade','Hibrida','Definitiva'].forEach(t => {
            setVal(`bonusDefesa${t}ItemBase`, ent?.[`bonusDefesa${t}ItemBase`] || 0);
            setVal(`bonusEvasao${t}ItemBase`, ent?.[`bonusEvasao${t}ItemBase`] || 0);
        });

        // Configura Imagens e Drops
        currentImageUrls = ent?.imageUrls || {};
        renderImageSlots();

        currentDrops = ent?.drops || {};
        document.getElementById('monstro-item-filter').value = '';
        renderItemGrids();
    },

    closeEditor: function() {
        document.getElementById('monstro-list-view').classList.remove('hidden');
        document.getElementById('monstro-editor-view').classList.add('hidden');
        document.getElementById('monstro-editor-view').classList.remove('flex');
        editingEntityId = null;
    },

    deleteEntity: async function(id) {
        if (!confirm("Esta ação apagará a criatura permanentemente do servidor. Continuar?")) return;
        try {
            await deleteDoc(doc(db, COLLECTION_FICHAS, id));
            alert("Criatura exterminada com sucesso.");
            
            // Remove da lista local e renderiza, para não ter que baixar tudo de novo
            entityList = entityList.filter(e => e.id !== id);
            renderEntityGrid();
        } catch(e) {
            alert("Erro ao excluir: " + e.message);
        }
    },

    saveEntity: async function() {
        const nome = document.getElementById('monstro-nome').value.trim();
        if (!nome) return alert("O ser precisa de um nome!");

        const btn = document.getElementById('monstro-btn-save');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Adicionando ao Bestiário...';
        btn.disabled = true;

        const docId = editingEntityId || doc(collection(db, COLLECTION_FICHAS)).id;
        
        const getVal = id => document.getElementById(id).value;
        const getNum = id => Number(document.getElementById(id).value) || 0;

        const dataToSave = {
            nome: nome,
            racaId: getVal('monstro-raca'),
            classeId: getVal('monstro-classe'),
            ambienteId: getVal('monstro-ambiente'),
            descricao: getVal('monstro-descricao'),
            
            hpMaxPersonagemBase: getNum('monstro-hp'),
            mpMaxPersonagemBase: getNum('monstro-mp'),
            atk_base: getNum('monstro-atk'),
            def_base: getNum('monstro-def'),
            eva_base: getNum('monstro-eva'),

            drops: currentDrops,
            atualizadoEm: serverTimestamp()
        };

        const advTypesAtk = ['Fisico','Magico','Elemental','Espiritual','Divino','Imunidade','Hibrido','Definitivo'];
        const advTypesDefEva = ['Fisica','Magica','Elemental','Espiritual','Divina','Imunidade','Hibrida','Definitiva'];
        
        advTypesAtk.forEach(t => {
            const v = getNum(`bonusAtaque${t}ItemBase`);
            if (v !== 0) dataToSave[`bonusAtaque${t}ItemBase`] = v;
        });

        advTypesDefEva.forEach(t => {
            const vDef = getNum(`bonusDefesa${t}ItemBase`);
            if (vDef !== 0) dataToSave[`bonusDefesa${t}ItemBase`] = vDef;

            const vEva = getNum(`bonusEvasao${t}ItemBase`);
            if (vEva !== 0) dataToSave[`bonusEvasao${t}ItemBase`] = vEva;
        });

        if (!editingEntityId) dataToSave.criadoEm = serverTimestamp();

        const imageUrls = {};
        const uploadPromises = [];

        for (let i = 1; i <= 5; i++) {
            const key = `imagem${i}`;
            const fileInput = document.getElementById(`upload-m-${key}`);
            const existingUrl = document.getElementById(`existing-m-${key}`).value;

            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                const uploadTask = async () => {
                    try {
                        if (existingUrl && existingUrl.includes('firebasestorage')) {
                            try { await deleteObject(ref(storage, existingUrl)); } catch(e){}
                        }
                        // USO DA FUNÇÃO IMPORTADA (Sem window.)
                        const compressedBlob = await compressImage(file, 400, 400, 0.7);
                        const storageRef = ref(storage, `imagens_monstros/${docId}/${key}_${Date.now()}.jpg`);
                        await uploadBytes(storageRef, compressedBlob);
                        imageUrls[key] = await getDownloadURL(storageRef);
                    } catch (err) {
                        console.error(`Erro na imagem ${i}:`, err);
                    }
                };
                uploadPromises.push(uploadTask());
            } else if (existingUrl) {
                imageUrls[key] = existingUrl;
            }
        }

        await Promise.all(uploadPromises);
        dataToSave.imageUrls = imageUrls;

        try {
            await setDoc(doc(db, COLLECTION_FICHAS, docId), dataToSave, { merge: true });
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Criatura Registada!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
                btn.classList.replace('bg-green-500', 'bg-emerald-600');
                window.cadastroMonstros.closeEditor();
                loadInitialData(); 
            }, 1000);

        } catch (e) {
            console.error(e);
            alert("Falha na invocação: " + e.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};