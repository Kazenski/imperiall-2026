import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, orderBy, query, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';
import { COINS, BONUS_LIST, POWER_RANGES } from '../core/state.js'; // IMPORTAÇÃO DIRETA DO CORE


// --- CONFIGURAÇÕES DE BANCO DE DADOS ---
const COLLECTION_EQUIPAMENTOS = 'rpg_itensCadastrados';
const COLLECTION_EQUIPAMENTOS_BACKUP = 'rpg_itensCadastrados_backup';
const COLLECTION_MOCHILA = 'rpg_itensMochila';
const COLLECTION_MOCHILA_BACKUP = 'rpg_itensMochila_backup';

const STORAGE_PATH_EQUIP = 'imagens/itens/';
const STORAGE_PATH_MOCHILA = 'imagens/itensMochila/';

// --- ESTADO GLOBAL DA PÁGINA ---
let gmState = {
    activeTab: 'cadastrar-equip',
    allEquipamentos: [],
    allMochilaItems: [],
    allSlots: [],
    allEfeitos: [],
    allRaridades: [],
    allTiposMochila: [],
    allCharacters: [],
    selectedItem: null,
    selectedItemsList: new Set(),
    selectedConcedeCharId: ''
};

export async function renderCadastroItensTab() {
    const container = document.getElementById('cadastro-itens-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left">
                    <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md"><i class="fas fa-hammer mr-3"></i> Oficina de Criação</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Forje o destino material de Imperiall</p>
                </div>
            </header>

            <nav class="flex flex-wrap gap-2 mb-8 border-b-2 border-slate-800" id="item-tabs-nav">
                <button class="item-tab-btn active" data-tab="cadastrar-equip">Equipamentos</button>
                <button class="item-tab-btn" data-tab="gerar-equip">Gerador Aleatório</button>
                <button class="item-tab-btn" data-tab="cadastrar-mochila">Itens Mochila</button>
                <button class="item-tab-btn" data-tab="liberar-equip">Liberar Equip.</button>
                <button class="item-tab-btn" data-tab="conceder-items">Conceder Físico</button>
            </nav>

            <div id="item-content-wrapper" class="relative min-h-[500px] w-full">
                <div id="item-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-50 rounded-2xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 mb-4"></div>
                    <p class="text-amber-500 font-cinzel tracking-widest">Aquecendo fornalhas...</p>
                </div>
                
                <div id="item-dynamic-content" class="w-full hidden">
                    </div>
            </div>

        </div>
    `;

    setupTabs();
    await loadInitialData();
}

function setupTabs() {
    const nav = document.getElementById('item-tabs-nav');
    if (!nav) return;

    const baseClasses = ['bg-slate-900', 'text-slate-400', 'border-t-2', 'border-l-2', 'border-r-2', 'border-transparent', 'hover:bg-slate-800', 'rounded-t-lg', 'px-6', 'py-3', 'font-bold', 'text-sm', 'uppercase', 'tracking-widest', 'transition-colors'];
    const activeClasses = ['bg-slate-800', 'text-amber-500', 'border-amber-500/50'];

    nav.querySelectorAll('.item-tab-btn').forEach(btn => {
        btn.classList.add(...baseClasses);
        if (btn.classList.contains('active')) {
            btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-transparent');
            btn.classList.add(...activeClasses);
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.item-tab-btn');
        if (btn) {
            nav.querySelectorAll('.item-tab-btn').forEach(b => {
                b.classList.remove('active', ...activeClasses);
                b.classList.add('bg-slate-900', 'text-slate-400', 'border-transparent');
            });
            
            btn.classList.add('active');
            btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-transparent');
            btn.classList.add(...activeClasses);

            gmState.activeTab = btn.dataset.tab;
            gmState.selectedItem = null;
            gmState.selectedItemsList.clear();
            renderActiveTab();
        }
    });
}

async function loadInitialData() {
    try {
        const [equipSnap, mochilaSnap, slotsSnap, efeitosSnap, raridadeSnap, tiposMochilaSnap, charsSnap] = await Promise.all([
            getDocs(query(collection(db, COLLECTION_EQUIPAMENTOS), orderBy("nome"))),
            getDocs(query(collection(db, COLLECTION_MOCHILA), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_itemTipos'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_efeitosGerais'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_raridadesItens'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_tiposItensMochila'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_fichas'), orderBy("nome")))
        ]);

        gmState.allEquipamentos = equipSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allMochilaItems = mochilaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allSlots = slotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allEfeitos = efeitosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allRaridades = raridadeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allTiposMochila = tiposMochilaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        gmState.allCharacters = charsSnap.docs.map(d => ({ id: d.id, nome: d.data().nome }));

        document.getElementById('item-loading').classList.add('hidden');
        document.getElementById('item-dynamic-content').classList.remove('hidden');
        
        renderActiveTab();
    } catch (e) {
        console.error("Erro ao carregar arquivos da oficina:", e);
        document.getElementById('item-loading').innerHTML = '<p class="text-red-500">Erro crítico ao carregar banco de dados.</p>';
    }
}

// ------------------------------------------------------------------------------------
// RENDERIZADOR CENTRAL
// ------------------------------------------------------------------------------------
function renderActiveTab() {
    const container = document.getElementById('item-dynamic-content');
    if (!container) return;

    if (gmState.activeTab === 'cadastrar-equip') {
        container.innerHTML = renderSplitView(
            renderItemEditorForm('equipamento'), 
            renderItemList(gmState.allEquipamentos, 'equipamento')
        );
        attachFormListeners('equipamento');
    } 
    else if (gmState.activeTab === 'cadastrar-mochila') {
        container.innerHTML = renderSplitView(
            renderItemEditorForm('mochila'), 
            renderItemList(gmState.allMochilaItems, 'mochila')
        );
        attachFormListeners('mochila');
    }
    else if (gmState.activeTab === 'gerar-equip') {
        container.innerHTML = renderGeneratorForm();
    }
    else if (gmState.activeTab === 'liberar-equip') {
        const usados = gmState.allEquipamentos.filter(i => i.itemUsadoAtualmente === true);
        container.innerHTML = renderActionPanel('Liberar Equipamentos Presos', 'Estes equipamentos constam como "em uso" no sistema.', usados, 'liberar');
    }
    else if (gmState.activeTab === 'conceder-items') {
        const livres = gmState.allEquipamentos.filter(i => i.itemUsadoAtualmente !== true);
        const tudo = [...livres, ...gmState.allMochilaItems].sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        container.innerHTML = renderActionPanel('Conceder Fisicamente a um Personagem', 'Selecione o alvo e os itens a enviar.', tudo, 'conceder');
    }
}

function renderSplitView(formHtml, listHtml) {
    return `
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div class="xl:col-span-2">${formHtml}</div>
            <div class="xl:col-span-1 bg-slate-800/40 p-6 rounded-2xl border border-slate-700 shadow-lg">${listHtml}</div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// 1. O EDITOR COMPLEXO (FORMS)
// ------------------------------------------------------------------------------------
function renderItemEditorForm(type) {
    const isEquip = type === 'equipamento';
    const item = gmState.selectedItem || {};
    const title = item.id ? `Editando: ${escapeHTML(item.nome)}` : (isEquip ? 'Forjar Novo Equipamento' : 'Criar Item de Mochila');

    // Render Bônus Dinâmicos usando BONUS_LIST do state
    let bonusHtml = '';
    if (isEquip) {
        Object.entries(BONUS_LIST).forEach(([categoria, tipos]) => {
            bonusHtml += `
                <div class="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-inner">
                    <h4 class="text-sm font-bold text-amber-500 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">${categoria}</h4>
                    <div class="space-y-3">
            `;
            tipos.forEach(tipo => {
                const key = `bonus${categoria}${tipo}ItemBase`;
                const val = item[key] || 0;
                const isChecked = val > 0 ? 'checked' : '';
                const isDisabled = val > 0 ? '' : 'disabled';
                bonusHtml += `
                    <div class="grid grid-cols-[auto_1fr_80px] gap-3 items-center">
                        <input type="checkbox" id="chk-${key}" class="w-4 h-4 rounded bg-slate-900 border-slate-500 text-amber-500" ${isChecked} onchange="document.getElementById('${key}').disabled = !this.checked; if(!this.checked) document.getElementById('${key}').value=0;">
                        <label for="chk-${key}" class="text-xs text-slate-300 font-semibold uppercase">${tipo}</label>
                        <input type="number" id="${key}" value="${val}" ${isDisabled} class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-center font-mono text-sm disabled:opacity-30 outline-none focus:border-amber-500">
                    </div>
                `;
            });
            bonusHtml += `</div></div>`;
        });
    }

    // Render Efeitos Especiais
    let efeitosHtml = '';
    if (isEquip) {
        efeitosHtml = `
            <div class="col-span-full bg-slate-800/50 p-5 rounded-xl border border-slate-700 mt-4">
                <h4 class="text-sm font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center"><i class="fas fa-magic mr-2"></i> Efeitos Especiais Vinculados</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto custom-scroll pr-2">
        `;
        gmState.allEfeitos.forEach(efeito => {
            const val = item.efeitos_especiais?.[efeito.id] || 0;
            const isChecked = val > 0 ? 'checked' : '';
            const isDisabled = val > 0 ? '' : 'disabled';
            efeitosHtml += `
                <div class="bg-slate-900 p-3 rounded border border-slate-700 flex items-center gap-3">
                    <input type="checkbox" id="chk-ef-${efeito.id}" class="w-4 h-4 rounded bg-slate-800 border-slate-500 text-sky-500" ${isChecked} onchange="document.getElementById('ef-${efeito.id}').disabled = !this.checked; if(!this.checked) document.getElementById('ef-${efeito.id}').value=0;">
                    <label for="chk-ef-${efeito.id}" class="text-xs text-slate-300 truncate flex-grow cursor-pointer" title="${efeito.nome}">${escapeHTML(efeito.nome)}</label>
                    <input type="number" id="ef-${efeito.id}" value="${val}" ${isDisabled} class="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white text-center font-mono text-xs disabled:opacity-30 outline-none">
                </div>
            `;
        });
        efeitosHtml += `</div></div>`;
    }

    return `
        <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl animate-fade-in relative">
            <h2 class="text-2xl md:text-3xl font-bold font-cinzel text-amber-400 mb-6 border-b border-slate-600 pb-4">${title}</h2>
            
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nome</label>
                        <input type="text" id="item-nome" value="${escapeHTML(item.nome || '')}" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-white outline-none focus:border-amber-500">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ícone</label>
                        <input type="file" id="item-imagem" accept="image/*" class="w-full bg-slate-900 border border-slate-600 p-2 rounded text-slate-400 text-sm">
                    </div>
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                    <textarea id="item-descricao" rows="3" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-white outline-none focus:border-amber-500 custom-scroll">${escapeHTML(item.descricao || '')}</textarea>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    ${isEquip ? `
                        <div><label class="block text-[10px] text-slate-400 uppercase mb-1">ATK Base</label><input type="number" id="item-atk" value="${item.atk_base || 0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                        <div><label class="block text-[10px] text-slate-400 uppercase mb-1">DEF Base</label><input type="number" id="item-def" value="${item.def_base || 0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                        <div><label class="block text-[10px] text-slate-400 uppercase mb-1">EVA Base</label><input type="number" id="item-eva" value="${item.eva_base || 0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                        <div><label class="block text-[10px] text-slate-400 uppercase mb-1">Durabilidade</label><input type="number" id="item-dur" value="${item.durabilidade || 100}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                    ` : `
                        <div class="col-span-2"><label class="block text-[10px] text-slate-400 uppercase mb-1">Qtd. Usos</label><input type="number" id="item-usos" value="${item.usos || 1}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                    `}
                    <div><label class="block text-[10px] text-slate-400 uppercase mb-1">Peso</label><input type="number" step="0.1" id="item-peso" value="${item.peso || 1.0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                    <div><label class="block text-[10px] text-slate-400 uppercase mb-1">Valor Moedas</label><input type="number" id="item-gold" value="${item.valorVenda || 0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                    <div><label class="block text-[10px] text-slate-400 uppercase mb-1">Valor Essências</label><input type="number" id="item-ess" value="${item.valorEssencias || 0}" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-white font-mono text-center"></div>
                    
                    <div class="col-span-full mt-2">
                        <label class="block text-[10px] text-slate-400 uppercase mb-1">Tipo de Encaixe</label>
                        <select id="item-tipo" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-slate-200 outline-none focus:border-amber-500">
                            <option value="" class="bg-slate-900 text-slate-500">-- Selecione --</option>
                            ${isEquip 
                                ? gmState.allSlots.map(s => `<option value="${s.id}" class="bg-slate-900 text-slate-200" ${item.slot_equipavel_id === s.id ? 'selected' : ''}>${escapeHTML(s.nome)}</option>`).join('')
                                : gmState.allTiposMochila.map(t => `<option value="${t.id}" class="bg-slate-900 text-slate-200" ${item.tipoId === t.id ? 'selected' : ''}>${escapeHTML(t.nome)}</option>`).join('')
                            }
                        </select>
                    </div>
                    ${!isEquip ? `
                    <div class="col-span-full mt-2">
                        <label class="block text-[10px] text-slate-400 uppercase mb-1">Raridade</label>
                        <select id="item-raridade" class="w-full bg-slate-800 border border-slate-600 p-2 rounded text-slate-200 outline-none focus:border-amber-500">
                            <option value="" class="bg-slate-900 text-slate-500">-- Selecione --</option>
                            ${gmState.allRaridades.map(r => `<option value="${r.id}" class="bg-slate-900 text-slate-200" ${item.raridadeId === r.id ? 'selected' : ''}>${escapeHTML(r.nome)}</option>`).join('')}
                        </select>
                    </div>
                    `: ''}
                </div>

                ${isEquip ? `
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                        ${bonusHtml}
                    </div>
                    ${efeitosHtml}
                ` : ''}

                <div class="flex gap-4 pt-6 mt-6 border-t border-slate-700">
                    <button id="btn-save-item" class="flex-grow py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-lg">
                        <i class="fas fa-hammer mr-2"></i> ${item.id ? 'Salvar Modificações' : 'Forjar Item'}
                    </button>
                    ${item.id ? `
                        <button onclick="window.itemTools.cancelEdit()" class="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors uppercase tracking-widest">
                            Cancelar
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderItemList(items, type) {
    const header = type === 'equipamento' ? 'Equipamentos Criados' : 'Itens de Mochila';
    return `
        <h3 class="text-xl font-cinzel font-bold text-slate-300 mb-4 uppercase tracking-widest text-center">${header}</h3>
        <input type="text" id="side-item-search" placeholder="Procurar..." class="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white text-sm mb-4 outline-none focus:border-amber-500" onkeyup="window.itemTools.filterSidebar()">
        
        <div id="side-item-grid" class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-4 gap-2 max-h-[600px] overflow-y-auto custom-scroll p-2">
            ${generateMiniGrid(items, type)}
        </div>
    `;
}

function generateMiniGrid(items, type) {
    if (items.length === 0) return '<div class="col-span-full text-center text-xs text-slate-500 italic">Nada encontrado.</div>';
    
    return items.map(item => {
        const isSel = gmState.selectedItem?.id === item.id;
        const img = item.imagemUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media";
        return `
            <div onclick="window.itemTools.editItem('${item.id}', '${type}')" class="aspect-square bg-slate-900 rounded border cursor-pointer relative overflow-hidden group transition-all transform hover:scale-110 ${isSel ? 'border-amber-500 scale-105 shadow-[0_0_10px_rgba(245,158,11,0.6)] z-10' : 'border-slate-700 hover:border-slate-400'}">
                <img src="${img}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" class="w-full h-full object-cover opacity-80 group-hover:opacity-100">
                <div class="absolute inset-0 flex items-center justify-center text-slate-600" style="display:none"><i class="fas fa-cube"></i></div>
                <div class="absolute bottom-0 left-0 w-full bg-black/90 text-white text-[8px] text-center px-0.5 py-1 truncate leading-none">${escapeHTML(item.nome)}</div>
            </div>
        `;
    }).join('');
}

// ------------------------------------------------------------------------------------
// 2. GERADOR ALEATÓRIO E AÇÕES EM LOTE
// ------------------------------------------------------------------------------------
function renderGeneratorForm() {
    return `
        <div class="max-w-3xl mx-auto bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl animate-fade-in mt-10">
            <h2 class="text-3xl font-bold font-cinzel text-amber-400 mb-6 text-center border-b border-slate-700 pb-4"><i class="fas fa-dice mr-3"></i> Matriz de Geração Procedural</h2>
            <p class="text-slate-400 text-center mb-8 text-sm">Gera atributos base e efeitos sorteados dentro de escalas de poder seguras definidas no Core.</p>
            
            <form id="gen-form" onsubmit="window.itemTools.generateItem(event)" class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Escala de Poder</label>
                    <select id="gen-power" class="w-full bg-slate-900 border border-slate-600 p-4 rounded-xl text-amber-400 font-bold outline-none focus:border-amber-500 cursor-pointer">
                        ${Object.keys(POWER_RANGES).map(r => `<option value="${r}" class="bg-slate-900 text-slate-200 capitalize">${r}</option>`).join('')}
                    </select>
                </div>
                
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Qtd. Máxima de Bônus Adicionais</label>
                        <input type="number" id="gen-qtd-bonus" value="1" min="0" class="w-full bg-slate-900 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-amber-500 text-center font-mono text-xl">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Qtd. Efeitos Mágicos</label>
                        <input type="number" id="gen-qtd-efeitos" value="1" min="0" class="w-full bg-slate-900 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-amber-500 text-center font-mono text-xl">
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-700">
                    <button type="submit" class="w-full py-4 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-[0_0_15px_rgba(126,34,206,0.5)]">
                        <i class="fas fa-bolt mr-2"></i> Rolar Dados e Pré-Visualizar
                    </button>
                </div>
            </form>
        </div>
    `;
}

function renderActionPanel(title, desc, itemsArray, type) {
    const isConceder = type === 'conceder';

    return `
        <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl animate-fade-in max-w-5xl mx-auto mt-6 flex flex-col h-full">
            <header class="mb-6 border-b border-slate-700 pb-4">
                <h2 class="text-2xl font-bold font-cinzel text-${isConceder ? 'sky' : 'red'}-500">${title}</h2>
                <p class="text-slate-400 text-sm mt-1">${desc}</p>
            </header>

            ${isConceder ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-6 bg-slate-900/50 rounded-xl border border-slate-700">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Destinatário</label>
                        <select id="action-target-char" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-sky-400 font-bold outline-none focus:border-sky-500">
                            <option value="" class="bg-slate-900 text-slate-500">-- Selecione um Personagem --</option>
                            ${gmState.allCharacters.map(c => `<option value="${c.id}" class="bg-slate-900 text-slate-200">${c.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unidades (Por Item)</label>
                        <input type="number" id="action-qtd" value="1" min="1" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white text-center font-mono outline-none focus:border-sky-500">
                    </div>
                </div>
            ` : ''}

            <div class="mb-4">
                <input type="text" id="action-search" placeholder="Filtrar galeria abaixo..." class="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white outline-none focus:border-amber-500" onkeyup="window.itemTools.filterActionGrid('${type}')">
            </div>

            <div class="flex-grow bg-slate-950 border border-slate-700 rounded-xl p-4 overflow-y-auto max-h-[400px] custom-scroll">
                <div id="action-grid" class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                    ${generateActionGrid(itemsArray)}
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-slate-700">
                <button onclick="window.itemTools.executeAction('${type}')" class="w-full py-4 bg-${isConceder ? 'sky' : 'red'}-700 hover:bg-${isConceder ? 'sky' : 'red'}-600 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-lg">
                    ${isConceder ? '<i class="fas fa-dolly mr-2"></i> Enviar para Mochila' : '<i class="fas fa-unlock mr-2"></i> Desvincular Itens Selecionados'}
                </button>
            </div>
        </div>
    `;
}

function generateActionGrid(items) {
    if (items.length === 0) return '<div class="col-span-full text-center text-xs text-slate-500 italic p-4">Nenhum item se enquadra nesta categoria.</div>';
    
    return items.map(item => {
        const isSel = gmState.selectedItemsList.has(item.id);
        const img = item.imagemUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media";
        return `
            <div onclick="window.itemTools.toggleActionSelect('${item.id}')" class="aspect-square bg-slate-900 rounded border cursor-pointer relative overflow-hidden group transition-all transform hover:scale-110 ${isSel ? 'border-amber-500 scale-105 shadow-[0_0_10px_rgba(245,158,11,0.6)] z-10' : 'border-slate-700 hover:border-slate-400'}">
                <img src="${img}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" class="w-full h-full object-cover opacity-80 group-hover:opacity-100">
                <div class="absolute inset-0 flex items-center justify-center text-slate-600" style="display:none"><i class="fas fa-cube"></i></div>
                <div class="absolute bottom-0 left-0 w-full bg-black/90 text-white text-[8px] text-center px-0.5 py-1 truncate leading-none">${escapeHTML(item.nome)}</div>
                ${isSel ? `<div class="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-black rounded-full flex items-center justify-center text-[10px] font-bold"><i class="fas fa-check"></i></div>` : ''}
            </div>
        `;
    }).join('');
}


// ------------------------------------------------------------------------------------
// LISTENERS & GRAVAÇÃO NO BANDO DE DADOS
// ------------------------------------------------------------------------------------
function attachFormListeners(type) {
    const btn = document.getElementById('btn-save-item');
    if(btn) {
        btn.onclick = async () => {
            const isEquip = type === 'equipamento';
            const nome = document.getElementById('item-nome').value.trim();
            if (!nome) return alert("Dê um nome ao artefato!");

            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Forjando...';
            btn.disabled = true;

            const getNum = id => Number(document.getElementById(id)?.value) || 0;
            const getVal = id => document.getElementById(id)?.value || '';

            const data = {
                nome: nome,
                descricao: getVal('item-descricao'),
                peso: Number(document.getElementById('item-peso')?.value) || 0.1,
                valorVenda: getNum('item-gold'),
                valorEssencias: getNum('item-ess'),
                atualizadoEm: serverTimestamp()
            };

            if (isEquip) {
                data.atk_base = getNum('item-atk');
                data.def_base = getNum('item-def');
                data.eva_base = getNum('item-eva');
                data.durabilidade = getNum('item-dur');
                data.slot_equipavel_id = getVal('item-tipo');
                
                Object.entries(BONUS_LIST).forEach(([cat, tipos]) => {
                    tipos.forEach(tipo => {
                        const key = `bonus${cat}${tipo}ItemBase`;
                        const el = document.getElementById(key);
                        if(el && !el.disabled && Number(el.value) > 0) {
                            data[key] = Number(el.value);
                        }
                    });
                });

                data.efeitos_especiais = {};
                gmState.allEfeitos.forEach(ef => {
                    const el = document.getElementById(`ef-${ef.id}`);
                    if(el && !el.disabled && Number(el.value) > 0) {
                        data.efeitos_especiais[ef.id] = Number(el.value);
                    }
                });
            } else {
                data.usos = getNum('item-usos');
                data.tipoId = getVal('item-tipo');
                data.raridadeId = getVal('item-raridade');
            }

            // Tratamento da Imagem
            let finalUrl = gmState.selectedItem?.imagemUrl || null;
            const fileInput = document.getElementById('item-imagem');
            
            if (fileInput && fileInput.files[0]) {
                try {
                    if (finalUrl && finalUrl.includes('firebasestorage')) {
                        try { await deleteObject(ref(storage, finalUrl)); } catch(e){}
                    }
                    const file = fileInput.files[0];
                    // USO DA FUNÇÃO IMPORTADA (Como é um ícone, 150x150, qualidade 0.6 é o ideal)
                    const blob = await compressImage(file, 150, 150, 0.6);
                    const path = isEquip ? STORAGE_PATH_EQUIP : STORAGE_PATH_MOCHILA;
                    const docId = gmState.selectedItem?.id || Date.now().toString(); 
                    const storageRef = ref(storage, `${path}${docId}_${Date.now()}.jpg`);
                    await uploadBytes(storageRef, blob);
                    finalUrl = await getDownloadURL(storageRef);
                } catch(e) {
                    console.error(e);
                    alert("Erro na imagem, prosseguindo sem ela.");
                }
            }
            if (finalUrl) data.imagemUrl = finalUrl;

            const collectionName = isEquip ? COLLECTION_EQUIPAMENTOS : COLLECTION_MOCHILA;
            const backupColName = isEquip ? COLLECTION_EQUIPAMENTOS_BACKUP : COLLECTION_MOCHILA_BACKUP;
            const editId = gmState.selectedItem?.id;

            try {
                let docRef;
                if (editId) {
                    docRef = doc(db, collectionName, editId);
                    await updateDoc(docRef, data);
                } else {
                    data.criadoEm = serverTimestamp();
                    if(isEquip) data.itemUsadoAtualmente = false;
                    const newDoc = doc(collection(db, collectionName));
                    await setDoc(newDoc, data);
                    docRef = newDoc;
                }

                await setDoc(doc(db, backupColName, docRef.id), { ...data, idOriginal: docRef.id }, { merge: true });

                btn.innerHTML = '<i class="fas fa-check mr-2"></i> Salvo!';
                btn.classList.replace('bg-emerald-600', 'bg-green-500');
                
                setTimeout(() => {
                    gmState.selectedItem = null;
                    loadInitialData(); 
                }, 1000);

            } catch(e) {
                console.error(e);
                alert("Falha: " + e.message);
                btn.innerHTML = '<i class="fas fa-hammer mr-2"></i> Tentar Novamente';
                btn.disabled = false;
            }
        };
    }
}

// ------------------------------------------------------------------------------------
// FUNÇÕES EXPOSTAS PARA O HTML (window)
// ------------------------------------------------------------------------------------
window.itemTools = {
    editItem: function(id, type) {
        const list = type === 'equipamento' ? gmState.allEquipamentos : gmState.allMochilaItems;
        gmState.selectedItem = list.find(i => i.id === id);
        renderActiveTab();
    },
    
    cancelEdit: function() {
        gmState.selectedItem = null;
        renderActiveTab();
    },

    filterSidebar: function() {
        const term = document.getElementById('side-item-search').value.toLowerCase();
        const type = gmState.activeTab.includes('equip') ? 'equipamento' : 'mochila';
        const list = type === 'equipamento' ? gmState.allEquipamentos : gmState.allMochilaItems;
        
        const filtered = list.filter(i => (i.nome||'').toLowerCase().includes(term));
        document.getElementById('side-item-grid').innerHTML = generateMiniGrid(filtered, type);
    },

    generateItem: function(e) {
        e.preventDefault();
        const power = document.getElementById('gen-power').value;
        const config = POWER_RANGES[power];
        const qtdBonus = parseInt(document.getElementById('gen-qtd-bonus').value) || 0;
        const qtdEfeitos = parseInt(document.getElementById('gen-qtd-efeitos').value) || 0;

        const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const shuffle = arr => [...arr].sort(() => 0.5 - Math.random());

        const data = {
            nome: `Sorteado (${power})`,
            atk_base: getRandomInt(config.base[0], config.base[1]),
            def_base: getRandomInt(config.base[0], config.base[1]),
            eva_base: getRandomInt(config.base[0], config.base[1]),
            durabilidade: getRandomInt(config.durabilidade[0], config.durabilidade[1]),
            peso: getRandomInt(config.peso[0], config.peso[1]),
            efeitos_especiais: {},
        };

        const allBonusKeys = [];
        Object.entries(BONUS_LIST).forEach(([cat, tipos]) => {
            tipos.forEach(t => allBonusKeys.push(`bonus${cat}${t}ItemBase`));
        });

        shuffle(allBonusKeys).slice(0, qtdBonus).forEach(k => {
            data[k] = getRandomInt(config.bonus[0], config.bonus[1]);
        });

        shuffle(gmState.allEfeitos).slice(0, qtdEfeitos).forEach(ef => {
            data.efeitos_especiais[ef.id] = getRandomInt(config.efeito[0], config.efeito[1]);
        });

        gmState.selectedItem = data;
        gmState.activeTab = 'cadastrar-equip'; // Transfere para a aba de criação com os dados preenchidos
        renderActiveTab();
    },

    filterActionGrid: function(type) {
        const term = document.getElementById('action-search').value.toLowerCase();
        let baseList = [];
        if (type === 'liberar') {
            baseList = gmState.allEquipamentos.filter(i => i.itemUsadoAtualmente === true);
        } else {
            const livres = gmState.allEquipamentos.filter(i => i.itemUsadoAtualmente !== true);
            baseList = [...livres, ...gmState.allMochilaItems].sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        }

        const filtered = baseList.filter(i => (i.nome||'').toLowerCase().includes(term));
        document.getElementById('action-grid').innerHTML = generateActionGrid(filtered);
    },

    toggleActionSelect: function(id) {
        if (gmState.selectedItemsList.has(id)) gmState.selectedItemsList.delete(id);
        else gmState.selectedItemsList.add(id);
        
        const type = gmState.activeTab === 'liberar-equip' ? 'liberar' : 'conceder';
        window.itemTools.filterActionGrid(type); 
    },

    executeAction: async function(type) {
        if (gmState.selectedItemsList.size === 0) return alert("Selecione pelo menos um item da galeria.");

        if (type === 'liberar') {
            if (!confirm(`Deseja forçar a liberação de ${gmState.selectedItemsList.size} equipamento(s)?\nIsso pode causar bugs nas fichas dos jogadores que o possuem equipado.`)) return;
            
            try {
                const batch = writeBatch(db);
                gmState.selectedItemsList.forEach(id => {
                    batch.update(doc(db, COLLECTION_EQUIPAMENTOS, id), { itemUsadoAtualmente: false });
                });
                await batch.commit();
                alert("Itens liberados com sucesso!");
                loadInitialData();
            } catch(e) { alert("Erro ao liberar: " + e.message); }
        } 
        else if (type === 'conceder') {
            const charId = document.getElementById('action-target-char').value;
            const qtd = parseInt(document.getElementById('action-qtd').value) || 1;

            if (!charId) return alert("Selecione um personagem alvo!");

            try {
                const updates = {};
                gmState.selectedItemsList.forEach(id => {
                    updates[`mochila.${id}`] = increment(qtd);
                });
                await updateDoc(doc(db, 'rpg_fichas', charId), updates);
                alert("Itens transportados magicamente para a mochila!");
                gmState.selectedItemsList.clear();
                renderActiveTab();
            } catch(e) { alert("Erro no teleporte: " + e.message); }
        }
    }
};

// Exposição do compressor de ícones (que agora pode até ser usado globalmente noutros scripts se precisar)
window.compressIcon = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.6); 
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};