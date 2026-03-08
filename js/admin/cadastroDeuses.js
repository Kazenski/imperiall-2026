import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';

const COLLECTION_ENTIDADES = 'rpg_entidadesPoderosas';
const TIPOS_DE_SER = ["Entidades Cósmicas", "Deuses Maiores", "Deuses Menores", "Titãs", "Semi Deuses"];

let deusesState = {
    list: [],
    editingId: null,
    filter: '',
    currentImages: {} // Para gerenciar a galeria temporária no editor
};

export async function renderCadastroDeusesTab() {
    const container = document.getElementById('cadastro-deuses-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left">
                    <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-sky-500 tracking-widest drop-shadow-md"><i class="fas fa-om mr-3"></i> Panteão Divino</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Onde deuses e entidades cósmicas são forjados</p>
                </div>
                <button onclick="window.deusesTools.openEditor(null)" class="btn bg-sky-700 hover:bg-sky-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i> Adicionar Divindade
                </button>
            </header>

            <div id="deuses-list-view" class="w-full flex flex-col gap-4">
                <div class="flex justify-center p-12" id="deuses-loading"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-sky-500"></div></div>
                <div class="mb-4">
                    <input type="text" id="deuses-filter" placeholder="Buscar entidade pelo nome..." onkeyup="window.deusesTools.filterList(this.value)" class="w-full md:w-1/2 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white outline-none focus:border-sky-500">
                </div>
                <div id="deuses-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 hidden"></div>
            </div>

            <div id="deuses-editor-view" class="w-full hidden flex-col gap-6 animate-fade-in bg-slate-800/60 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div class="flex justify-between items-center border-b border-slate-600 pb-4 mb-4">
                    <h2 id="deuses-editor-title" class="text-2xl font-cinzel font-bold text-sky-400">Criar Nova Entidade</h2>
                    <button onclick="window.deusesTools.closeEditor()" class="text-slate-400 hover:text-red-500 text-2xl transition-colors"><i class="fas fa-times"></i></button>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-2 sm:col-span-1">
                                <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Nome</label>
                                <input type="text" id="deus-nome" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-sky-500 outline-none">
                            </div>
                            <div class="col-span-2 sm:col-span-1">
                                <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Hierarquia (Tipo)</label>
                                <select id="deus-tipo" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-sky-300 focus:border-sky-500 outline-none">
                                    <option value="">Selecione...</option>
                                    ${TIPOS_DE_SER.map(t => `<option value="${t}">${t}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Mitologia / História</label>
                            <textarea id="deus-historia" rows="6" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-sky-500 outline-none custom-scroll"></textarea>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Manifestação Física (Aparência)</label>
                            <textarea id="deus-fisico" rows="4" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-sky-500 outline-none custom-scroll"></textarea>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Curiosidades e Rumores</label>
                            <textarea id="deus-curiosidades" rows="3" class="w-full px-4 py-3 bg-slate-950 border border-slate-600 rounded-lg text-white focus:border-sky-500 outline-none custom-scroll"></textarea>
                        </div>
                    </div>

                    <div class="space-y-6">
                        
                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-sm font-bold font-cinzel text-sky-400 border-b border-slate-600 pb-2 mb-4 tracking-widest">Poder Base (Avatar Físico)</h3>
                            <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                <div><label class="text-[10px] text-slate-400 block mb-1">HP</label><input type="number" id="deus-hp" class="w-full px-2 py-2 bg-slate-950 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">MP</label><input type="number" id="deus-mp" class="w-full px-2 py-2 bg-slate-950 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">ATK</label><input type="number" id="deus-atk" class="w-full px-2 py-2 bg-slate-950 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">DEF</label><input type="number" id="deus-def" class="w-full px-2 py-2 bg-slate-950 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">EVA</label><input type="number" id="deus-eva" class="w-full px-2 py-2 bg-slate-950 border border-slate-600 rounded text-white text-center font-mono"></div>
                            </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-sm font-bold font-cinzel text-sky-400 border-b border-slate-600 pb-2 mb-4 tracking-widest">Devoção (Dogmas e Bênçãos)</h3>
                            <div class="space-y-4">
                                <div><label class="text-xs text-slate-400 block mb-1 font-bold">Restrições aos Seguidores</label><input type="text" id="deus-sup-res" class="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-sm"></div>
                                <div><label class="text-xs text-slate-400 block mb-1 font-bold">Deveres e Obrigações</label><input type="text" id="deus-sup-obr" class="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-sm"></div>
                                <div><label class="text-xs text-slate-400 block mb-1 font-bold">Graças Concedidas</label><input type="text" id="deus-sup-bon" class="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded text-white text-sm"></div>
                            </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-sm font-bold font-cinzel text-sky-400 border-b border-slate-600 pb-2 mb-4 tracking-widest">Galeria de Aparições</h3>
                            <div class="grid grid-cols-5 gap-2" id="deuses-image-slots">
                                </div>
                        </div>

                    </div>
                </div>

                <div class="flex gap-4 mt-6 pt-6 border-t border-slate-600">
                    <button id="btn-save-deus" onclick="window.deusesTools.saveEntity()" class="flex-grow py-4 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-[0_0_15px_rgba(14,165,233,0.3)] flex items-center justify-center">
                        <i class="fas fa-save mr-2"></i> Consagrar ao Panteão
                    </button>
                </div>
            </div>

        </div>
    `;

    await loadDeuses();
}

async function loadDeuses() {
    const loading = document.getElementById('deuses-loading');
    const grid = document.getElementById('deuses-grid');
    if (!loading || !grid) return;

    try {
        const snap = await getDocs(query(collection(db, COLLECTION_ENTIDADES), orderBy('nome')));
        deusesState.list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGrid();
        loading.classList.add('hidden');
        grid.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        loading.innerHTML = '<p class="text-red-500">O Panteão não respondeu (Erro de Conexão).</p>';
    }
}

function renderGrid() {
    const grid = document.getElementById('deuses-grid');
    if (!grid) return;

    const term = deusesState.filter.toLowerCase();
    const filtered = deusesState.list.filter(e => (e.nome||'').toLowerCase().includes(term));

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center p-10 text-slate-500 italic bg-slate-800/50 rounded-xl border border-slate-700">O vazio absoluto reina aqui.</div>';
        return;
    }

    grid.innerHTML = filtered.map(ent => {
        const img = ent.imageUrls?.imagem1 || 'https://placehold.co/150x150/1e293b/a1a1aa?text=DEUS';
        return `
            <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-lg flex items-center gap-4 hover:border-sky-500 transition-colors group">
                <img src="${img}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600 group-hover:border-sky-400">
                <div class="flex-grow overflow-hidden">
                    <h3 class="font-bold text-lg text-white truncate font-cinzel tracking-wider">${escapeHTML(ent.nome)}</h3>
                    <p class="text-[10px] text-sky-400 uppercase tracking-widest font-bold">${escapeHTML(ent.tipoDeSer || 'Entidade Divina')}</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="window.deusesTools.openEditor('${ent.id}')" class="w-8 h-8 rounded bg-sky-900/50 text-sky-400 hover:bg-sky-600 hover:text-white flex items-center justify-center transition-colors" title="Editar">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="window.deusesTools.deleteEntity('${ent.id}')" class="w-8 h-8 rounded bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Apagar">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderImageSlots() {
    const container = document.getElementById('deuses-image-slots');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `imagem${i}`;
        const currentUrl = deusesState.currentImages[key] || '';
        const hasImg = !!currentUrl;

        const slot = document.createElement('div');
        slot.className = `aspect-square rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden bg-slate-950 transition-colors group ${hasImg ? 'border-sky-500' : 'border-slate-700 hover:border-slate-500'}`;
        
        slot.innerHTML = `
            <img id="preview-d-${key}" src="${currentUrl}" class="w-full h-full object-cover ${hasImg ? '' : 'hidden'}">
            <div id="icon-d-${key}" class="absolute inset-0 flex items-center justify-center text-slate-600 text-xl group-hover:text-white ${hasImg ? 'hidden' : ''}">
                <i class="fas fa-plus"></i>
            </div>
            <input type="file" id="upload-d-${key}" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Upload Arte Divina">
            <input type="hidden" id="existing-d-${key}" value="${currentUrl}">
        `;

        const input = slot.querySelector('input[type="file"]');
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                slot.querySelector('img').src = url;
                slot.querySelector('img').classList.remove('hidden');
                slot.querySelector('div').classList.add('hidden');
                slot.classList.replace('border-slate-700', 'border-sky-500');
                slot.classList.replace('border-dashed', 'border-solid');
            }
        });

        container.appendChild(slot);
    }
}

// ----------------------------------------------------------------------------------
// AÇÕES GLOBAIS EXPOSTAS
// ----------------------------------------------------------------------------------
window.deusesTools = {
    filterList: function(val) {
        deusesState.filter = val;
        renderGrid();
    },

    openEditor: function(id) {
        deusesState.editingId = id;
        const ent = id ? deusesState.list.find(n => n.id === id) : null;

        document.getElementById('deuses-list-view').classList.add('hidden');
        document.getElementById('deuses-editor-view').classList.remove('hidden');
        document.getElementById('deuses-editor-view').classList.add('flex');

        document.getElementById('deuses-editor-title').textContent = ent ? 'Registros Akáshicos' : 'Criação Espontânea';

        // Preenche Formulário
        const setVal = (domId, val) => document.getElementById(domId).value = val || '';
        setVal('deus-nome', ent?.nome);
        setVal('deus-tipo', ent?.tipoDeSer);
        setVal('deus-historia', ent?.historia);
        setVal('deus-fisico', ent?.caracteristicasFisicas);
        setVal('deus-curiosidades', ent?.curiosidades);

        // Stats
        setVal('deus-hp', ent?.hpMaxPersonagemBase || 0);
        setVal('deus-mp', ent?.mpMaxPersonagemBase || 0);
        setVal('deus-atk', ent?.atk_base || 0);
        setVal('deus-def', ent?.def_base || 0);
        setVal('deus-eva', ent?.eva_base || 0);

        // Supremacia
        setVal('deus-sup-res', ent?.supremacia?.restricoes);
        setVal('deus-sup-obr', ent?.supremacia?.obrigacoes);
        setVal('deus-sup-bon', ent?.supremacia?.bonusEspeciais);

        // Imagens
        deusesState.currentImages = ent?.imageUrls || {};
        renderImageSlots();
    },

    closeEditor: function() {
        document.getElementById('deuses-list-view').classList.remove('hidden');
        document.getElementById('deuses-editor-view').classList.add('hidden');
        document.getElementById('deuses-editor-view').classList.remove('flex');
        deusesState.editingId = null;
    },

    deleteEntity: async function(id) {
        if (!confirm("Isso apagará o deus do panteão permanentemente. Continuar?")) return;
        try {
            await deleteDoc(doc(db, COLLECTION_ENTIDADES, id));
            deusesState.list = deusesState.list.filter(e => e.id !== id);
            renderGrid();
        } catch(e) {
            alert("Erro no deicídio: " + e.message);
        }
    },

    saveEntity: async function() {
        const nome = document.getElementById('deus-nome').value.trim();
        if (!nome) return alert("O deus precisa de uma alcunha!");

        const btn = document.getElementById('btn-save-deus');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Elevando aos Céus...';
        btn.disabled = true;

        const docId = deusesState.editingId || doc(collection(db, COLLECTION_ENTIDADES)).id;
        
        const getVal = id => document.getElementById(id).value;
        const getNum = id => Number(document.getElementById(id).value) || 0;

        const dataToSave = {
            nome: nome,
            tipoDeSer: getVal('deus-tipo') || "Deuses Menores",
            historia: getVal('deus-historia'),
            caracteristicasFisicas: getVal('deus-fisico'),
            curiosidades: getVal('deus-curiosidades'),
            
            hpMaxPersonagemBase: getNum('deus-hp'),
            mpMaxPersonagemBase: getNum('deus-mp'),
            atk_base: getNum('deus-atk'),
            def_base: getNum('deus-def'),
            eva_base: getNum('deus-eva'),
            
            supremacia: {
                restricoes: getVal('deus-sup-res'),
                obrigacoes: getVal('deus-sup-obr'),
                bonusEspeciais: getVal('deus-sup-bon')
            },
            atualizadoEm: serverTimestamp()
        };

        if (!deusesState.editingId) dataToSave.criadoEm = serverTimestamp();

        // Processamento Mágico de Imagens 
        const imageUrls = {};
        const uploadPromises = [];

        for (let i = 1; i <= 5; i++) {
            const key = `imagem${i}`;
            const fileInput = document.getElementById(`upload-d-${key}`);
            const existingUrl = document.getElementById(`existing-d-${key}`).value;

            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                const uploadTask = async () => {
                    try {
                        // Limpeza
                        if (existingUrl && existingUrl.includes('firebasestorage')) {
                            try { await deleteObject(ref(storage, existingUrl)); } catch(e){}
                        }
                        // Compressão Global 400x400
                        const compressedBlob = await compressImage(file, 400, 400, 0.7);
                        // Compartilha a mesma pasta de Imagens de NPCs por compatibilidade com banco legado
                        const storageRef = ref(storage, `imagens_npcs/${docId}/${key}_${Date.now()}.jpg`);
                        await uploadBytes(storageRef, compressedBlob);
                        imageUrls[key] = await getDownloadURL(storageRef);
                    } catch (err) {
                        console.error(`Falha na Relíquia (Img ${i}):`, err);
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
            await setDoc(doc(db, COLLECTION_ENTIDADES, docId), dataToSave, { merge: true });
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Ascensão Concluída!';
            btn.classList.replace('bg-sky-700', 'bg-sky-500');
            
            setTimeout(() => {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
                btn.classList.replace('bg-sky-500', 'bg-sky-700');
                window.deusesTools.closeEditor();
                loadDeuses(); 
            }, 1000);

        } catch (e) {
            console.error(e);
            alert("A magia falhou: " + e.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};