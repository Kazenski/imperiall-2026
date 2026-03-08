import { db, storage, collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, ref, uploadBytes, getDownloadURL, serverTimestamp } from '../core/firebase.js';
import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// Imagem fixa decorativa
const FIXED_OVERLAY_PATH = "atualizacoes_sistema/adobe_express_2024-09-09_19.09.39-AE04la0EqVu9QQ8m (1).avif";
let overlayUrlCache = null;
let currentUpdates = [];
let unsubUpdates = null;

// Estados de Paginação e Busca
let currentPage = 1;
const itemsPerPage = 10;
let currentSearchTerm = '';

// Inicia a renderização da aba
export function renderAtualizacoesTab() {
    const container = document.getElementById('atualizacoes-novidades-content');
    if (!container) return;

    // Constrói o esqueleto base da página
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col">
            <header class="mb-4 w-full flex items-center justify-between border-b border-slate-700 pb-2">
                <div>
                    <h1 class="text-3xl text-amber-500 font-bold drop-shadow-md font-cinzel text-left leading-none">
                        Novidades do Sistema
                    </h1>
                    <p class="text-slate-400 text-xs mt-1 text-left">
                        Acompanhe todas as melhorias, correções e novos conteúdos implementados.
                    </p>
                </div>
                <div id="btn-container-admin">
                    </div>
            </header>

            <div id="atualizacoes-form-container" class="hidden mb-6 w-full shrink-0"></div>

            <div class="mb-4 relative w-full shrink-0">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="fas fa-search text-slate-500"></i>
                </div>
                <input 
                    type="text" 
                    id="atualizacoes-search-input"
                    class="w-full bg-slate-800 text-white pl-10 h-10 text-sm border border-slate-700 focus:border-amber-500 rounded shadow-sm outline-none transition" 
                    placeholder="Pesquisar atualizações..."
                >
            </div>

            <div id="atualizacoes-list" class="space-y-4 w-full">
                </div>

            <div id="atualizacoes-pagination" class="flex justify-center gap-2 mt-6 pb-10 shrink-0">
                </div>
        </div>
    `;

    // Botão de Novo (Apenas Admin)
    const btnContainer = document.getElementById('btn-container-admin');
    if (globalState.isAdmin) {
        btnContainer.innerHTML = `
            <button onclick="window.atualizacoes.openForm(null)" class="btn btn-primary shadow-lg text-sm bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded border border-purple-500 transition">
                <i class="fas fa-plus-circle mr-1"></i> Nova Atualização
            </button>
        `;
    }

    // Listener de Busca
    const searchInput = document.getElementById('atualizacoes-search-input');
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        currentPage = 1;
        renderList();
    });

    // Puxa a Imagem Overlay apenas uma vez
    if (!overlayUrlCache) {
        getDownloadURL(ref(storage, FIXED_OVERLAY_PATH)).then(url => {
            overlayUrlCache = url;
            renderList();
        }).catch(err => console.warn("Badge Imperial não encontrada", err));
    }

    // Escutador em tempo real das atualizações
    if (unsubUpdates) unsubUpdates();
    unsubUpdates = onSnapshot(collection(db, 'rpg_atualizacoes_sistema'), (snapshot) => {
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ordenação: Implantação (se existir) > Criação (fallback) > Mais antigo pro fim
        docs.sort((a, b) => {
            const getDate = (item) => {
                 if (item.dataImplantacao) return new Date(item.dataImplantacao).getTime();
                 if (item.createdAt && typeof item.createdAt.toDate === 'function') return item.createdAt.toDate().getTime();
                 return 0;
            };
            return getDate(b) - getDate(a); 
        });

        currentUpdates = docs;
        renderList();
    });
}

// Filtra, Pagina e Renderiza os Cards
function renderList() {
    const listContainer = document.getElementById('atualizacoes-list');
    const pageContainer = document.getElementById('atualizacoes-pagination');
    if (!listContainer || !pageContainer) return;

    let filtered = currentUpdates.filter(update => {
        // Se não for admin, não vê Ocultos nem Rascunhos
        if (!globalState.isAdmin) {
            if (update.isHidden || update.isDraft) return false;
        }

        if (!currentSearchTerm) return true;
        
        const term = currentSearchTerm;
        const matchTitulo = update.tituloPrincipal?.toLowerCase().includes(term);
        const matchCodigo = update.codigoVersao?.toLowerCase().includes(term);
        const matchLateral = update.tituloLateral?.toLowerCase().includes(term);
        const matchStatus = update.status?.toLowerCase().includes(term);
        const matchMudancas = update.mudancas?.some(m => m.toLowerCase().includes(term));

        return matchTitulo || matchCodigo || matchLateral || matchStatus || matchMudancas;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-20 bg-slate-800/50 rounded border border-slate-700 border-dashed">
                <i class="fas fa-search text-4xl text-slate-600 mb-4"></i>
                <p class="text-slate-500">Nenhum resultado encontrado.</p>
            </div>
        `;
        pageContainer.innerHTML = '';
        return;
    }

    // Paginação Matemática
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirst, indexOfLast);

    // Renderiza Itens
    listContainer.innerHTML = currentItems.map(upd => renderCardHTML(upd)).join('');

    // Renderiza Botões de Paginação
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (totalPages > 1) {
        let pagesHTML = `<button onclick="window.atualizacoes.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-4 py-2 bg-slate-800 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"><i class="fas fa-chevron-left"></i></button>`;
        for(let i=1; i<=totalPages; i++) {
            pagesHTML += `<button onclick="window.atualizacoes.goToPage(${i})" class="px-4 py-2 border rounded ${currentPage === i ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-500'}">${i}</button>`;
        }
        pagesHTML += `<button onclick="window.atualizacoes.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-4 py-2 bg-slate-800 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"><i class="fas fa-chevron-right"></i></button>`;
        pageContainer.innerHTML = pagesHTML;
    } else {
        pageContainer.innerHTML = '';
    }
}

// Gera o HTML de um Único Card
function renderCardHTML(data) {
    const isAdmin = globalState.isAdmin;
    
    let statusColor = 'text-blue-400 border-blue-500 bg-blue-900/20';
    let statusIcon = '';
    if (data.status === 'Em Manutenção') { statusColor = 'text-amber-500 border-amber-500 bg-amber-900/20'; statusIcon = '<i class="fas fa-tools mr-2 animate-pulse"></i>'; }
    if (data.status === 'Manutenção Completa') { statusColor = 'text-emerald-400 border-emerald-500 bg-emerald-900/20'; statusIcon = '<i class="fas fa-check-circle mr-2"></i>'; }
    if (data.status === 'Manutenção Estendida') { statusColor = 'text-red-400 border-red-500 bg-red-900/20'; }
    if (data.status === 'Manutenção Cancelada') { statusColor = 'text-slate-400 border-slate-500 bg-slate-900/20'; }
    if (data.status === 'Manutenção Prevista') { statusColor = 'text-sky-300 border-sky-400 bg-sky-900/20'; }

    let dataFmt = 'Data Desconhecida';
    if (data.dataImplantacao) {
        const d = new Date(data.dataImplantacao + 'T12:00:00');
        dataFmt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        dataFmt = data.createdAt.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const bgPosY = data.bgPositionY !== undefined ? `${data.bgPositionY}%` : '50%';
    const opacityClass = (data.isDraft || data.isHidden) ? "opacity-75 border-dashed" : "opacity-100";
    const borderColor = data.isDraft ? "border-amber-500/50" : (data.isHidden ? "border-slate-500/50" : "border-slate-700");

    let adminBtns = '';
    if (isAdmin) {
        let toggleVisHtml = '';
        if (data.isDraft) {
            toggleVisHtml = `<button onclick="window.atualizacoes.publish('${data.id}')" class="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-emerald-500 shadow-lg"><i class="fas fa-upload mr-1"></i> Publicar</button>`;
        } else {
            toggleVisHtml = `<button onclick="window.atualizacoes.toggleHidden('${data.id}', ${data.isHidden})" class="px-3 py-1 rounded text-xs font-bold shadow-lg ${data.isHidden ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-slate-300'}"><i class="fas ${data.isHidden ? 'fa-eye' : 'fa-eye-slash'} mr-1"></i> ${data.isHidden ? 'Exibir' : 'Ocultar'}</button>`;
        }

        adminBtns = `
            <div class="absolute top-4 right-4 z-30 flex gap-2">
                ${toggleVisHtml}
                <button onclick="window.atualizacoes.openForm('${data.id}')" class="bg-amber-500 text-black px-3 py-1 rounded text-xs font-bold hover:bg-amber-400 shadow-lg"><i class="fas fa-edit mr-1"></i> Editar</button>
                <button onclick="window.atualizacoes.delete('${data.id}')" class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-500 shadow-lg"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }

    const mudancasHTML = (data.mudancas || []).map(m => `
        <li class="flex items-start text-sm text-slate-300 bg-slate-900/40 p-2 rounded">
            <span class="text-amber-500 mr-3 mt-0.5">•</span><span>${escapeHTML(m)}</span>
        </li>
    `).join('');

    const bgHtml = data.imagemBackground 
        ? `<div class="absolute inset-0 bg-cover opacity-60 group-hover:scale-105 transition-transform duration-700" style="background-image: url('${data.imagemBackground}'); background-position: center ${bgPosY}"></div>`
        : `<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900"></div>`;

    const overlayImgHtml = overlayUrlCache ? `<div class="absolute bottom-[-10px] right-0 w-32 md:w-48 z-20 pointer-events-none"><img src="${overlayUrlCache}" class="w-full drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"></div>` : '';

    return `
        <div class="bg-slate-800 rounded-lg border ${borderColor} shadow-xl overflow-hidden mb-8 transition-all duration-300 relative group ${opacityClass}">
            ${data.isDraft ? `<div class="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black border border-amber-300 px-4 py-1 rounded-full text-xs font-bold uppercase z-40 shadow-lg"><i class="fas fa-pencil-alt mr-1"></i> Rascunho</div>` : ''}
            ${(!data.isDraft && data.isHidden) ? `<div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-600 text-white border border-slate-400 px-4 py-1 rounded-full text-xs font-bold uppercase z-40 shadow-lg"><i class="fas fa-eye-slash mr-1"></i> Oculto</div>` : ''}
            
            ${adminBtns}

            <div class="relative w-full h-48 md:h-64 overflow-hidden shrink-0">
                ${bgHtml}
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
                <div class="absolute bottom-4 left-4 md:left-8 z-10 pr-32 md:pr-40">
                    <div class="inline-flex items-center px-3 py-1 rounded border text-xs font-bold uppercase tracking-wider mb-2 ${statusColor}">
                        ${statusIcon}${escapeHTML(data.status)}
                    </div>
                    <h2 class="text-3xl md:text-4xl text-white font-cinzel font-bold drop-shadow-lg leading-tight">
                        ${escapeHTML(data.tituloPrincipal)}
                    </h2>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-xs text-slate-300 bg-black/80 px-2 py-0.5 rounded border border-slate-600 font-mono">${escapeHTML(data.codigoVersao)}</span>
                        <span class="text-xs text-slate-300"><i class="far fa-calendar-alt text-amber-500 mr-1"></i> ${dataFmt}</span>
                    </div>
                </div>
                ${overlayImgHtml}
            </div>

            <div class="p-6 md:p-8 flex flex-col bg-slate-900">
                
                <div class="w-full flex flex-col gap-2">
                    <h3 class="text-xl text-amber-500 font-bold font-cinzel">${escapeHTML(data.tituloLateral)}</h3>
                    <p class="intro-text text-slate-400 text-sm italic leading-relaxed line-clamp-3">"${escapeHTML(data.paragrafoIntro)}"</p>
                    
                    ${data.status === 'Em Manutenção' ? `
                    <div class="bg-red-900/20 border border-red-500/30 p-4 rounded relative overflow-hidden mt-4 shrink-0">
                        <i class="fas fa-exclamation-triangle absolute -top-2 -right-2 text-6xl text-red-500 opacity-10"></i>
                        <h4 class="text-red-400 font-bold text-xs uppercase mb-1">Aviso do Sistema</h4>
                        <p class="text-slate-300 text-xs">Os servidores podem sofrer instabilidade. Salve seu progresso.</p>
                    </div>` : ''}
                </div>

                <div class="expandable-content hidden flex-col gap-8 mt-6 border-t border-slate-700 pt-6 w-full animate-fade-in shrink-0">
                    
                    <div class="flex flex-col w-full">
                        <h4 class="text-lg font-bold text-slate-200 mb-4 flex items-center"><i class="fas fa-clipboard-list text-amber-500 mr-2"></i> Notas da Versão</h4>
                        <ul class="space-y-2">${mudancasHTML}</ul>
                    </div>
                    
                    ${data.detalhes ? `
                    <div class="flex flex-col w-full">
                        <h4 class="text-lg font-bold text-slate-200 mb-4 flex items-center"><i class="fas fa-microchip text-amber-500 mr-2"></i> Detalhes Técnicos</h4>
                        <div class="p-4 bg-black/40 rounded border border-slate-700 text-slate-300 text-sm whitespace-pre-wrap">${escapeHTML(data.detalhes)}</div>
                    </div>` : ''}

                </div>

                <button onclick="
                    const content = this.previousElementSibling; 
                    const intro = this.parentElement.querySelector('.intro-text'); 
                    if(content.classList.contains('hidden')){ 
                        content.classList.remove('hidden'); 
                        content.classList.add('flex'); 
                        if(intro) intro.classList.remove('line-clamp-3'); 
                        this.innerHTML = '<i class=&quot;fas fa-chevron-up&quot;></i> Mostrar menos'; 
                    } else { 
                        content.classList.add('hidden'); 
                        content.classList.remove('flex'); 
                        if(intro) intro.classList.add('line-clamp-3'); 
                        this.innerHTML = '<i class=&quot;fas fa-chevron-down&quot;></i> Ler mais'; 
                        this.parentElement.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                " class="text-amber-500 hover:text-amber-400 text-sm font-bold flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-800 transition-colors outline-none w-full shrink-0">
                    <i class="fas fa-chevron-down"></i> Ler mais
                </button>

            </div>
        </div>
    `;
}

// ==========================================
// FUNÇÕES GLOBAIS DE MANIPULAÇÃO (ADMIN)
// ==========================================

window.atualizacoes = {
    goToPage: function(page) {
        currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderList();
    },

    delete: async function(id) {
        if(confirm("Excluir permanentemente esta atualização?")) {
            await deleteDoc(doc(db, "rpg_atualizacoes_sistema", id));
        }
    },

    toggleHidden: async function(id, currentState) {
        await updateDoc(doc(db, "rpg_atualizacoes_sistema", id), { isHidden: !currentState });
    },

    publish: async function(id) {
        if(confirm("Publicar este rascunho agora? Ficará visível para todos os jogadores.")) {
            await updateDoc(doc(db, "rpg_atualizacoes_sistema", id), {
                isDraft: false,
                isHidden: false,
                createdAt: serverTimestamp()
            });
        }
    },

    openForm: function(editId) {
        const formContainer = document.getElementById('atualizacoes-form-container');
        if(!formContainer) return;
        
        let data = null;
        if (editId) data = currentUpdates.find(u => u.id === editId);

        const today = new Date().toISOString().split('T')[0];

        formContainer.innerHTML = `
            <div class="bg-slate-800 rounded-lg border border-amber-500/50 shadow-2xl p-6 relative animate-fade-in">
                <div class="flex justify-between items-center mb-6 border-l-4 border-amber-500 pl-4">
                    <h2 class="text-2xl text-slate-100 font-bold">${data ? 'Editar Atualização' : 'Nova Atualização'}</h2>
                    <button onclick="document.getElementById('atualizacoes-form-container').classList.add('hidden')" class="text-slate-400 hover:text-white bg-slate-700 p-2 rounded-full w-8 h-8 flex items-center justify-center"><i class="fas fa-times"></i></button>
                </div>

                <form id="form-update-admin" onsubmit="event.preventDefault(); window.atualizacoes.submitForm('${data ? data.id : ''}', false)" class="space-y-5">
                    <input type="hidden" id="upd-imagemBackground" value="${data?.imagemBackground || ''}">
                    
                    <div class="bg-slate-900/50 p-4 rounded border border-slate-700 border-dashed">
                        <label class="block text-amber-500 mb-1 text-sm font-bold uppercase"><i class="far fa-calendar-alt mr-1"></i> Data de Implantação (Ordenação)</label>
                        <input required id="upd-data" type="date" class="w-full md:w-1/3 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded focus:border-amber-500 outline-none" value="${data?.dataImplantacao || today}">
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Título Principal</label>
                            <input required id="upd-titulo" type="text" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded focus:border-amber-500 outline-none" value="${data?.tituloPrincipal || ''}" placeholder="Ex: Era dos Dragões">
                        </div>
                        <div>
                            <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Versão</label>
                            <input required id="upd-codigo" type="text" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded focus:border-amber-500 outline-none" value="${data?.codigoVersao || ''}" placeholder="Ex: v2.4.0">
                        </div>
                    </div>

                    <div>
                        <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Status</label>
                        <select id="upd-status" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded focus:border-amber-500 outline-none">
                            <option ${data?.status === 'Notas de Atualização' ? 'selected' : ''}>Notas de Atualização</option>
                            <option ${data?.status === 'Manutenção Prevista' ? 'selected' : ''}>Manutenção Prevista</option>
                            <option ${data?.status === 'Em Manutenção' ? 'selected' : ''}>Em Manutenção</option>
                            <option ${data?.status === 'Manutenção Completa' ? 'selected' : ''}>Manutenção Completa</option>
                            <option ${data?.status === 'Manutenção Estendida' ? 'selected' : ''}>Manutenção Estendida</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Título Lateral</label>
                        <input required id="upd-lateral" type="text" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded focus:border-amber-500 outline-none" value="${data?.tituloLateral || ''}" placeholder="Destaque secundário">
                    </div>

                    <div>
                        <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Introdução</label>
                        <textarea required id="upd-intro" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded h-20 focus:border-amber-500 outline-none">${data?.paragrafoIntro || ''}</textarea>
                    </div>

                    <div>
                        <label class="block text-slate-400 mb-1 text-sm font-bold uppercase">Mudanças (Uma por linha)</label>
                        <textarea required id="upd-mudancas" class="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded h-32 focus:border-amber-500 outline-none">${data?.mudancas ? data.mudancas.join('\n') : ''}</textarea>
                    </div>

                    <div>
                        <label class="block text-amber-500 mb-1 text-sm font-bold uppercase">Detalhamento Técnico</label>
                        <textarea id="upd-detalhes" class="w-full bg-slate-900 border border-amber-500/50 text-white px-3 py-2 rounded h-32 focus:border-amber-500 outline-none">${data?.detalhes || ''}</textarea>
                    </div>

                    <div class="bg-slate-900/50 p-4 rounded border border-slate-700">
                        <label class="block text-slate-400 mb-2 text-sm font-bold uppercase">Upload Background (Opcional)</label>
                        <input type="file" id="upd-file" accept="image/*" class="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:bg-slate-700 file:text-amber-500 file:border-0 hover:file:bg-slate-600 mb-4">
                        
                        <label class="block text-slate-400 mb-1 text-xs uppercase">Alinhamento Vertical: <span id="posy-val" class="text-amber-500">${data?.bgPositionY || 50}%</span></label>
                        <input type="range" id="upd-posy" min="0" max="100" value="${data?.bgPositionY || 50}" class="w-full" oninput="document.getElementById('posy-val').innerText = this.value + '%'">
                    </div>

                    <div class="flex justify-end gap-3 border-t border-slate-700 pt-4">
                        <button type="button" onclick="document.getElementById('atualizacoes-form-container').classList.add('hidden')" class="btn bg-slate-700 text-white hover:bg-slate-600 px-6 py-2 rounded">Cancelar</button>
                        <button type="button" id="btn-save-draft" onclick="window.atualizacoes.submitForm('${data ? data.id : ''}', true)" class="btn bg-amber-600 text-black font-bold hover:bg-amber-500 px-6 py-2 rounded"><i class="fas fa-pencil-alt mr-1"></i> Salvar Rascunho</button>
                        <button type="submit" id="btn-save-pub" class="btn bg-emerald-600 text-white font-bold hover:bg-emerald-500 px-6 py-2 rounded"><i class="fas fa-upload mr-1"></i> ${data && !data.isDraft ? 'Atualizar Publicação' : 'Publicar Agora'}</button>
                    </div>
                </form>
            </div>
        `;
        formContainer.classList.remove('hidden');
    },

    submitForm: async function(docId, isDraft) {
        const btnDraft = document.getElementById('btn-save-draft');
        const btnPub = document.getElementById('btn-save-pub');
        btnDraft.disabled = true; btnPub.disabled = true;
        btnDraft.innerHTML = 'Salvando...'; btnPub.innerHTML = 'Salvando...';

        try {
            let downloadUrl = document.getElementById('upd-imagemBackground').value;
            const fileInput = document.getElementById('upd-file');
            
            if (fileInput.files.length > 0) {
                let file = fileInput.files[0];
                if (typeof window.compressImage === 'function') {
                    file = await window.compressImage(file, 1200, 800, 0.8);
                }
                const snapshot = await uploadBytes(ref(storage, `atualizacoes_sistema/${Date.now()}_${file.name}`), file);
                downloadUrl = await getDownloadURL(snapshot.ref);
            }

            const payload = {
                tituloPrincipal: document.getElementById('upd-titulo').value,
                codigoVersao: document.getElementById('upd-codigo').value,
                dataImplantacao: document.getElementById('upd-data').value,
                status: document.getElementById('upd-status').value,
                tituloLateral: document.getElementById('upd-lateral').value,
                paragrafoIntro: document.getElementById('upd-intro').value,
                mudancas: document.getElementById('upd-mudancas').value.split('\n').filter(l => l.trim() !== ''),
                detalhes: document.getElementById('upd-detalhes').value,
                imagemBackground: downloadUrl,
                bgPositionY: document.getElementById('upd-posy').value,
                isDraft: isDraft
            };

            if (docId) {
                await updateDoc(doc(db, "rpg_atualizacoes_sistema", docId), payload);
            } else {
                payload.isHidden = false;
                payload.createdAt = serverTimestamp();
                await setDoc(doc(collection(db, 'rpg_atualizacoes_sistema')), payload);
            }

            document.getElementById('atualizacoes-form-container').classList.add('hidden');
        } catch(e) {
            console.error(e);
            alert("Erro ao salvar atualização.");
        } finally {
            btnDraft.disabled = false; btnPub.disabled = false;
            btnDraft.innerHTML = 'Salvar Rascunho'; btnPub.innerHTML = 'Publicar Agora';
        }
    }
};