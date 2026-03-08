import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';

const COLLECTION_NPCS = 'rpg_Npcs';
let npcList = [];
let editingNpcId = null;

export async function renderCadastroNpcsTab() {
    const container = document.getElementById('cadastro-npcs-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left">
                    <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-red-500 tracking-widest drop-shadow-md"><i class="fas fa-users-cog mr-3"></i> Cadastro de NPCs</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Gerencie as entidades e criaturas não-jogáveis do mundo</p>
                </div>
                <button onclick="window.cadastroNpcs.openEditor(null)" class="btn bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i> Criar Novo NPC
                </button>
            </header>

            <div id="npc-list-view" class="w-full flex flex-col gap-4">
                <div class="flex justify-center p-12" id="npc-loading"><div class="animate-spin rounded-full h-12 w-12 border-t-4 border-red-500"></div></div>
                <div id="npc-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 hidden"></div>
            </div>

            <div id="npc-editor-view" class="w-full hidden flex-col gap-6 animate-fade-in bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div class="flex justify-between items-center border-b border-slate-600 pb-4 mb-4">
                    <h2 id="editor-title" class="text-2xl font-cinzel font-bold text-amber-400">Criar Novo NPC</h2>
                    <button onclick="window.cadastroNpcs.closeEditor()" class="text-slate-400 hover:text-red-500 text-2xl transition-colors"><i class="fas fa-times"></i></button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="space-y-5">
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Nome do NPC</label>
                            <input type="text" id="npc-nome" class="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none">
                        </div>
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">História / Background</label>
                            <textarea id="npc-historia" rows="6" class="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none custom-scroll"></textarea>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Características Físicas</label>
                            <textarea id="npc-fisico" rows="4" class="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none custom-scroll"></textarea>
                        </div>
                        <div>
                            <label class="font-semibold text-slate-300 text-xs uppercase tracking-widest block mb-2">Curiosidades</label>
                            <textarea id="npc-curiosidades" rows="4" class="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 outline-none custom-scroll"></textarea>
                        </div>
                    </div>

                    <div class="space-y-6">
                        
                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Atributos Base</h3>
                            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div><label class="text-[10px] text-slate-400 block mb-1">HP</label><input type="number" id="npc-hp" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">MP</label><input type="number" id="npc-mp" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">ATK</label><input type="number" id="npc-atk" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">DEF</label><input type="number" id="npc-def" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                                <div><label class="text-[10px] text-slate-400 block mb-1">EVA</label><input type="number" id="npc-eva" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center font-mono"></div>
                            </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Galeria de Imagens (Avatares)</h3>
                            <div class="grid grid-cols-3 sm:grid-cols-5 gap-3" id="npc-image-slots">
                                </div>
                        </div>

                        <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                            <h3 class="text-lg font-bold font-cinzel text-amber-400 border-b border-slate-600 pb-2 mb-4">Supremacia (Interação)</h3>
                            <div class="space-y-3">
                                <div><label class="text-xs text-slate-400 block mb-1">Restrições</label><input type="text" id="npc-sup-res" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                                <div><label class="text-xs text-slate-400 block mb-1">Obrigações</label><input type="text" id="npc-sup-obr" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                                <div><label class="text-xs text-slate-400 block mb-1">Bônus Especiais</label><input type="text" id="npc-sup-bon" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"></div>
                            </div>
                        </div>
                        
                    </div>
                </div>

                <div class="flex gap-4 mt-4 pt-6 border-t border-slate-600">
                    <button id="btn-save-npc" onclick="window.cadastroNpcs.saveNpc()" class="flex-grow py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-lg flex items-center justify-center">
                        <i class="fas fa-save mr-2"></i> Salvar Registros
                    </button>
                </div>
            </div>

        </div>
    `;

    await loadNpcs();
}

async function loadNpcs() {
    const loading = document.getElementById('npc-loading');
    const grid = document.getElementById('npc-grid');
    if (!loading || !grid) return;

    try {
        const snap = await getDocs(query(collection(db, COLLECTION_NPCS), orderBy('nome')));
        npcList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGrid();
        loading.classList.add('hidden');
        grid.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        loading.innerHTML = '<p class="text-red-500">Erro ao carregar NPCs.</p>';
    }
}

function renderGrid() {
    const grid = document.getElementById('npc-grid');
    if (!grid) return;

    if (npcList.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center p-10 text-slate-500 italic bg-slate-800/50 rounded-xl border border-slate-700">Nenhum NPC cadastrado no sistema.</div>';
        return;
    }

    grid.innerHTML = npcList.map(npc => {
        const img = npc.imageUrls?.imagem1 || 'https://placehold.co/150x150/1e293b/a1a1aa?text=NPC';
        return `
            <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-lg flex items-center gap-4 hover:border-amber-500 transition-colors group">
                <img src="${img}" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600 group-hover:border-amber-400">
                <div class="flex-grow overflow-hidden">
                    <h3 class="font-bold text-lg text-white truncate">${escapeHTML(npc.nome)}</h3>
                    <p class="text-xs text-slate-400">${escapeHTML(npc.tipoDeSer || 'NPC')}</p>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button onclick="window.cadastroNpcs.openEditor('${npc.id}')" class="w-8 h-8 rounded bg-sky-900/50 text-sky-400 hover:bg-sky-600 hover:text-white flex items-center justify-center transition-colors" title="Editar">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button onclick="window.cadastroNpcs.deleteNpc('${npc.id}')" class="w-8 h-8 rounded bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors" title="Excluir">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderImageSlots(existingUrls = {}) {
    const container = document.getElementById('npc-image-slots');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const key = `imagem${i}`;
        const currentUrl = existingUrls[key] || '';
        const hasImg = !!currentUrl;

        const slot = document.createElement('div');
        slot.className = `aspect-square rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden bg-slate-800 transition-colors group ${hasImg ? 'border-amber-500' : 'border-slate-600 hover:border-slate-400'}`;
        
        slot.innerHTML = `
            <img id="preview-${key}" src="${currentUrl}" class="w-full h-full object-cover ${hasImg ? '' : 'hidden'}">
            <div id="icon-${key}" class="absolute inset-0 flex items-center justify-center text-slate-500 text-2xl group-hover:text-white ${hasImg ? 'hidden' : ''}">
                <i class="fas fa-plus"></i>
            </div>
            <input type="file" id="upload-${key}" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Fazer upload de imagem">
            <input type="hidden" id="existing-${key}" value="${currentUrl}">
        `;

        // Lida com a pré-visualização em tempo real
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

// ----------------------------------------------------------------------------------
// AÇÕES GLOBAIS
// ----------------------------------------------------------------------------------
window.cadastroNpcs = {
    openEditor: function(id) {
        editingNpcId = id;
        const npc = id ? npcList.find(n => n.id === id) : null;

        document.getElementById('npc-list-view').classList.add('hidden');
        document.getElementById('npc-editor-view').classList.remove('hidden');
        document.getElementById('npc-editor-view').classList.add('flex');

        document.getElementById('editor-title').textContent = npc ? 'Editar Arquivo do NPC' : 'Forjar Novo NPC';

        // Textos
        const setVal = (domId, val) => document.getElementById(domId).value = val || '';
        setVal('npc-nome', npc?.nome);
        setVal('npc-historia', npc?.historia);
        setVal('npc-fisico', npc?.caracteristicasFisicas);
        setVal('npc-curiosidades', npc?.curiosidades);

        // Stats
        setVal('npc-hp', npc?.hpMaxPersonagemBase || 0);
        setVal('npc-mp', npc?.mpMaxPersonagemBase || 0);
        setVal('npc-atk', npc?.atk_base || 0);
        setVal('npc-def', npc?.def_base || 0);
        setVal('npc-eva', npc?.eva_base || 0);

        // Sup
        setVal('npc-sup-res', npc?.supremacia?.restricoes);
        setVal('npc-sup-obr', npc?.supremacia?.obrigacoes);
        setVal('npc-sup-bon', npc?.supremacia?.bonusEspeciais);

        // Imagens
        renderImageSlots(npc?.imageUrls || {});
    },

    closeEditor: function() {
        document.getElementById('npc-list-view').classList.remove('hidden');
        document.getElementById('npc-editor-view').classList.add('hidden');
        document.getElementById('npc-editor-view').classList.remove('flex');
        editingNpcId = null;
    },

    deleteNpc: async function(id) {
        if (!confirm("Tem certeza que deseja apagar este NPC permanentemente?")) return;
        try {
            await deleteDoc(doc(db, COLLECTION_NPCS, id));
            alert("NPC Apagado.");
            loadNpcs(); // Recarrega a lista
        } catch(e) {
            alert("Erro ao apagar: " + e.message);
        }
    },

    saveNpc: async function() {
        const nome = document.getElementById('npc-nome').value.trim();
        if (!nome) return alert("O NPC precisa ter um nome!");

        const btn = document.getElementById('btn-save-npc');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
        btn.disabled = true;

        const docId = editingNpcId || doc(collection(db, COLLECTION_NPCS)).id;
        
        const getVal = id => document.getElementById(id).value;
        const getNum = id => Number(document.getElementById(id).value) || 0;

        const dataToSave = {
            nome: nome,
            tipoDeSer: "NPCs",
            historia: getVal('npc-historia'),
            caracteristicasFisicas: getVal('npc-fisico'),
            curiosidades: getVal('npc-curiosidades'),
            
            hpMaxPersonagemBase: getNum('npc-hp'),
            mpMaxPersonagemBase: getNum('npc-mp'),
            atk_base: getNum('npc-atk'),
            def_base: getNum('npc-def'),
            eva_base: getNum('npc-eva'),
            
            supremacia: {
                restricoes: getVal('npc-sup-res'),
                obrigacoes: getVal('npc-sup-obr'),
                bonusEspeciais: getVal('npc-sup-bon')
            },
            
            atualizadoEm: serverTimestamp()
        };

        if (!editingNpcId) dataToSave.criadoEm = serverTimestamp();

        const imageUrls = {};
        const uploadPromises = [];

        for (let i = 1; i <= 5; i++) {
            const key = `imagem${i}`;
            const fileInput = document.getElementById(`upload-${key}`);
            const existingUrl = document.getElementById(`existing-${key}`).value;

            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                const uploadTask = async () => {
                    try {
                        if (existingUrl && existingUrl.includes('firebasestorage')) {
                            try { await deleteObject(ref(storage, existingUrl)); } catch(e){}
                        }
                        // USO DA FUNÇÃO IMPORTADA (Sem window.)
                        const compressedBlob = await compressImage(file, 400, 400, 0.7);
                        const storageRef = ref(storage, `imagens_npcs/${docId}/${key}_${Date.now()}.jpg`);
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
            await setDoc(doc(db, COLLECTION_NPCS, docId), dataToSave, { merge: true });
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Sucesso!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
                btn.classList.replace('bg-green-500', 'bg-emerald-600');
                window.cadastroNpcs.closeEditor();
                loadNpcs(); 
            }, 1000);

        } catch (e) {
            console.error(e);
            alert("Falha na gravação: " + e.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};