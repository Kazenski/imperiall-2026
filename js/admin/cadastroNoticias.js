import { db, storage } from '../core/firebase.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML } from '../core/utils.js';

const COLLECTION_NOTICIAS = 'rpg_noticias';
const STORAGE_PATH = 'rpg_noticias_imagens/';

let newsState = {
    list: [],
    editingId: null,
    pendingImage: null,
    unsubscribe: null // Para desligar o listener se mudarmos de aba
};

export async function renderCadastroNoticiasTab() {
    const container = document.getElementById('cadastro-noticias-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col lg:flex-row gap-8 p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <div class="w-full lg:w-1/3 flex flex-col gap-6">
                <header class="mb-2 border-b border-slate-700 pb-4">
                    <h1 class="text-3xl font-bold font-cinzel text-sky-500 tracking-widest"><i class="fas fa-newspaper mr-2"></i> Diário de Imperiall</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Publicar anúncios e atualizações do sistema em Alta Qualidade.</p>
                </header>

                <form id="news-form" onsubmit="window.newsTools.save(event)" class="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-2xl flex flex-col gap-4 relative">
                    <h2 id="form-title" class="text-xl font-bold text-amber-400 mb-2 border-b border-slate-600 pb-2">Nova Publicação</h2>
                    <input type="hidden" id="f-id">
                    <input type="hidden" id="f-oldImg">

                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Título da Notícia</label>
                        <input type="text" id="f-titulo" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white outline-none focus:border-sky-500 transition-colors">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Resumo / Subtítulo</label>
                        <textarea id="f-subtitulo" rows="4" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-slate-300 outline-none focus:border-sky-500 custom-scroll transition-colors"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Ordem</label>
                            <input type="number" id="f-ordem" value="1" min="1" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white text-center font-mono outline-none focus:border-sky-500 transition-colors">
                        </div>
                        <div class="flex flex-col justify-end pb-2">
                            <label class="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" id="f-ativa" checked class="w-5 h-5 rounded bg-slate-950 border-slate-500 text-sky-500 focus:ring-sky-500">
                                <span class="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Notícia Visível</span>
                            </label>
                        </div>
                    </div>

                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-2">
                        <label class="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 block">Botão de Ação (Link Opcional)</label>
                        <div class="space-y-3">
                            <input type="text" id="f-textoBotao" placeholder="Texto. Ex: Ler Mais" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-sm text-white outline-none focus:border-amber-500">
                            <input type="url" id="f-linkBotao" placeholder="https://..." class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-sm text-sky-300 outline-none focus:border-amber-500">
                        </div>
                    </div>

                    <div class="mt-2">
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Imagem Destaque (Alta Resolução)</label>
                        <div id="img-container" class="w-full aspect-video bg-black rounded-xl border-2 border-dashed border-slate-600 relative overflow-hidden mb-3 group flex items-center justify-center shadow-inner">
                            <img id="f-preview" src="" class="w-full h-full object-cover hidden z-10">
                            <i id="f-placeholder" class="fas fa-image text-4xl text-slate-600 group-hover:text-sky-500 transition-colors"></i>
                        </div>
                        <input type="file" id="f-img" accept="image/*" onchange="window.newsTools.previewImage(this)" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-sky-700 file:text-white hover:file:bg-sky-600 cursor-pointer transition-colors">
                    </div>

                    <div class="flex gap-2 pt-4 mt-2 border-t border-slate-700">
                        <button type="submit" id="btn-save-news" class="flex-grow py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg uppercase tracking-widest transition-colors">
                            <i class="fas fa-paper-plane mr-2"></i> Publicar
                        </button>
                        <button type="button" id="btn-cancel" onclick="window.newsTools.resetForm()" class="px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors hidden" title="Cancelar Edição">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </form>
            </div>

            <div class="w-full lg:w-2/3 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col h-full overflow-hidden">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-3 shrink-0">
                    <h2 class="text-xl font-bold text-slate-300 font-cinzel">Publicações Recentes</h2>
                    <span id="news-count" class="text-xs bg-sky-900 text-sky-300 font-bold px-3 py-1 rounded-full">0 Registros</span>
                </div>
                
                <div class="flex-grow overflow-y-auto custom-scroll pr-2">
                    <div id="news-list" class="flex flex-col gap-4">
                        <div class="text-center p-10"><i class="fas fa-spinner fa-spin text-3xl text-sky-500"></i></div>
                    </div>
                </div>
            </div>

        </div>
    `;

    startListener();
}

function startListener() {
    if (newsState.unsubscribe) newsState.unsubscribe();

    const q = query(collection(db, COLLECTION_NOTICIAS), orderBy('ordem'));
    
    // O onSnapshot mantem a lista sincronizada em tempo real sem F5!
    newsState.unsubscribe = onSnapshot(q, (snapshot) => {
        newsState.list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderList();
    }, (error) => {
        console.error("Erro ao ler notícias:", error);
        document.getElementById('news-list').innerHTML = `<div class="p-4 bg-red-900/20 border border-red-500 rounded text-red-400 text-center">Falha de conexão com a gráfica.</div>`;
    });
}

function renderList() {
    const listEl = document.getElementById('news-list');
    const countEl = document.getElementById('news-count');
    if (!listEl || !countEl) return;

    countEl.textContent = `${newsState.list.length} Registros`;

    if (newsState.list.length === 0) {
        listEl.innerHTML = `<div class="text-center p-10 text-slate-500 italic">Nenhuma notícia publicada ainda.</div>`;
        return;
    }

    listEl.innerHTML = newsState.list.map(n => {
        const statusClass = n.ativa ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-red-500';
        const statusText = n.ativa ? 'Online' : 'Oculta';
        const img = n.imagemURL || 'https://placehold.co/150x100/1e293b/a1a1aa?text=Sem+Foto';

        return `
            <div class="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4 items-center sm:items-start group hover:border-sky-500 transition-colors shadow-md">
                <div class="w-full sm:w-48 aspect-video bg-black rounded-lg overflow-hidden shrink-0 border border-slate-600 relative">
                    <img src="${img}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="absolute top-2 left-2 flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-slate-700 backdrop-blur-sm">
                        <div class="w-2 h-2 rounded-full ${statusClass}"></div>
                        <span class="text-[8px] font-bold text-white uppercase tracking-wider">${statusText}</span>
                    </div>
                </div>
                
                <div class="flex-grow w-full">
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="font-bold text-lg text-sky-400 leading-tight">${escapeHTML(n.titulo)}</h3>
                        <span class="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 shrink-0 ml-2">Ordem: ${n.ordem}</span>
                    </div>
                    <p class="text-xs text-slate-400 line-clamp-3 mb-3">${escapeHTML(n.subtitulo || 'Sem descrição')}</p>
                    
                    ${n.textoBotao ? `<div class="text-[10px] text-amber-500 font-mono truncate max-w-[250px]"><i class="fas fa-link mr-1"></i> [${escapeHTML(n.textoBotao)}]</div>` : ''}
                </div>

                <div class="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 justify-end sm:justify-start mt-2 sm:mt-0">
                    <button onclick="window.newsTools.edit('${n.id}')" class="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-sky-700 text-sky-400 hover:text-white rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center justify-center gap-2"><i class="fas fa-pen"></i> Editar</button>
                    <button onclick="window.newsTools.toggleStatus('${n.id}', ${n.ativa})" class="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-amber-600 text-amber-500 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center justify-center"><i class="fas fa-power-off"></i></button>
                    <button onclick="window.newsTools.delete('${n.id}')" class="flex-1 sm:flex-none px-4 py-2 bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white rounded-lg text-xs font-bold transition-colors border border-red-900/50 flex items-center justify-center"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// ------------------------------------------------------------------------------------
// AÇÕES EXPOSTAS (WINDOW)
// ------------------------------------------------------------------------------------
window.newsTools = {
    previewImage: function(input) {
        const preview = document.getElementById('f-preview');
        const placeholder = document.getElementById('f-placeholder');
        
        if (input.files && input.files[0]) {
            newsState.pendingImage = input.files[0];
            preview.src = URL.createObjectURL(input.files[0]);
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
            document.getElementById('img-container').classList.replace('border-dashed', 'border-solid');
            document.getElementById('img-container').classList.replace('border-slate-600', 'border-sky-500');
        }
    },

    resetForm: function() {
        document.getElementById('news-form').reset();
        document.getElementById('f-id').value = '';
        document.getElementById('f-oldImg').value = '';
        
        document.getElementById('f-preview').src = '';
        document.getElementById('f-preview').classList.add('hidden');
        document.getElementById('f-placeholder').classList.remove('hidden');
        
        const cont = document.getElementById('img-container');
        cont.classList.replace('border-solid', 'border-dashed');
        cont.classList.replace('border-sky-500', 'border-slate-600');

        document.getElementById('form-title').textContent = 'Nova Publicação';
        document.getElementById('btn-save-news').innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Publicar';
        document.getElementById('btn-cancel').classList.add('hidden');
        
        newsState.editingId = null;
        newsState.pendingImage = null;
    },

    edit: function(id) {
        const n = newsState.list.find(x => x.id === id);
        if (!n) return;

        window.newsTools.resetForm();

        newsState.editingId = id;
        document.getElementById('f-id').value = n.id;
        document.getElementById('f-oldImg').value = n.imagemURL || '';
        document.getElementById('f-titulo').value = n.titulo || '';
        document.getElementById('f-subtitulo').value = n.subtitulo || '';
        document.getElementById('f-ordem').value = n.ordem || 1;
        document.getElementById('f-ativa').checked = n.ativa;
        document.getElementById('f-textoBotao').value = n.textoBotao || '';
        document.getElementById('f-linkBotao').value = n.linkBotao || '';

        if (n.imagemURL) {
            const preview = document.getElementById('f-preview');
            preview.src = n.imagemURL;
            preview.classList.remove('hidden');
            document.getElementById('f-placeholder').classList.add('hidden');
            document.getElementById('img-container').classList.replace('border-dashed', 'border-solid');
            document.getElementById('img-container').classList.replace('border-slate-600', 'border-sky-500');
        }

        document.getElementById('form-title').textContent = 'Editando Publicação';
        document.getElementById('btn-save-news').innerHTML = '<i class="fas fa-save mr-2"></i> Atualizar Notícia';
        document.getElementById('btn-cancel').classList.remove('hidden');
    },

    toggleStatus: async function(id, currentState) {
        try {
            await updateDoc(doc(db, COLLECTION_NOTICIAS, id), { ativa: !currentState });
        } catch(e) { alert("Erro ao mudar status: " + e.message); }
    },

    delete: async function(id) {
        if (!confirm("Deseja apagar esta notícia permanentemente?")) return;
        try {
            const n = newsState.list.find(x => x.id === id);
            // Lixeira Inteligente (Apaga do Storage se existir)
            if (n && n.imagemURL && n.imagemURL.includes('firebasestorage')) {
                try { await deleteObject(ref(storage, n.imagemURL)); } catch(e){}
            }
            await deleteDoc(doc(db, COLLECTION_NOTICIAS, id));
            if(newsState.editingId === id) window.newsTools.resetForm();
        } catch(e) { alert("Erro ao excluir: " + e.message); }
    },

    save: async function(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-news');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
        btn.disabled = true;

        const id = document.getElementById('f-id').value;
        const oldImg = document.getElementById('f-oldImg').value;

        const payload = {
            titulo: document.getElementById('f-titulo').value.trim(),
            subtitulo: document.getElementById('f-subtitulo').value.trim(),
            ordem: parseInt(document.getElementById('f-ordem').value) || 1,
            ativa: document.getElementById('f-ativa').checked,
            textoBotao: document.getElementById('f-textoBotao').value.trim() || null,
            linkBotao: document.getElementById('f-linkBotao').value.trim() || null,
            atualizadoEm: serverTimestamp()
        };

        if(!id) payload.criadoEm = serverTimestamp();

        // UPLOAD DE IMAGEM (QUALIDADE ORIGINAL)
        let finalUrl = oldImg || null;
        if (newsState.pendingImage) {
            try {
                // Lixeira Inteligente: Remove imagem antiga para não entupir a Firebase
                if (oldImg && oldImg.includes('firebasestorage')) {
                    try { await deleteObject(ref(storage, oldImg)); } catch(err){}
                }
                
                // MANDA O ARQUIVO ORIGINAL (Sem passar pelo Canvas de Compressão)
                const storageRef = ref(storage, `${STORAGE_PATH}${Date.now()}_${newsState.pendingImage.name}`);
                await uploadBytes(storageRef, newsState.pendingImage);
                finalUrl = await getDownloadURL(storageRef);
                
            } catch(imgErr) {
                console.error(imgErr);
                alert("Falha no upload da imagem (Verifique o tamanho ou a conexão). O texto será salvo sem alteração na foto.");
            }
        }
        payload.imagemURL = finalUrl;

        try {
            if (id) await updateDoc(doc(db, COLLECTION_NOTICIAS, id), payload);
            else await setDoc(doc(collection(db, COLLECTION_NOTICIAS)), payload);

            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Publicado!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                window.newsTools.resetForm();
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Publicar';
                btn.classList.replace('bg-green-500', 'bg-emerald-600');
                btn.disabled = false;
            }, 1000);

        } catch(err) {
            console.error(err);
            alert("Erro ao publicar: " + err.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};