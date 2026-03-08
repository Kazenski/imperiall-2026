import { db, doc, updateDoc, setDoc, deleteDoc, runTransaction, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, deleteObject } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { calculateMainStats, calculateDynamicAttributes, calculateWeightStats, getFomeDebuffMultiplier } from '../core/calculos.js';

// ============================================================================
// --- TELA 1: LISTAGEM DE PERSONAGENS (COMPÊNDIO) ---
// ============================================================================
export function renderPainelFichas() {
    const container = document.getElementById('painel-fichas-content');
    if (!container) return;

    const adminHTML = globalState.isAdmin ? `
        <div class="bg-slate-800/80 p-4 rounded-xl border border-slate-700 mb-6 flex gap-4 items-center shadow-sm shrink-0">
            <div class="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center border border-indigo-500/30 shrink-0">
                <i class="fas fa-crown text-indigo-400 text-lg"></i>
            </div>
            <div class="flex-grow">
                <input type="text" id="admin-busca" placeholder="Mestre: Buscar ficha de qualquer jogador..." class="w-full bg-slate-900 border border-slate-600 rounded text-slate-200 px-4 py-2 text-sm focus:border-amber-500 outline-none transition-colors">
            </div>
        </div>` : '';
    
    container.innerHTML = `
        <div class="w-full h-full flex flex-col animate-fade-in">
            <div class="flex flex-wrap justify-between items-end mb-6 border-b border-slate-700 pb-4 shrink-0 gap-4">
                <div>
                    <h2 class="font-cinzel text-3xl text-amber-500 m-0">Compêndio de Aventureiros</h2>
                    <p class="text-sm text-slate-400 mt-1">Gerencie seus personagens e acesse suas fichas detalhadas.</p>
                </div>
                <button id="btn-create-new" class="btn btn-green shadow-lg shadow-emerald-900/20 py-2 px-6 font-bold uppercase tracking-wider flex items-center gap-2 transition hover:-translate-y-1">
                    <i class="fas fa-plus-circle text-lg"></i> Nova Ficha
                </button>
            </div>
            
            ${adminHTML}
            
            <div id="character-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 overflow-y-auto custom-scroll pr-2 pb-10 flex-grow content-start">
                <div class="col-span-full flex justify-center py-10"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>
            </div>
        </div>`;
    
    container.querySelector('#btn-create-new').addEventListener('click', () => renderFichaEditor(null));
    
    if(globalState.isAdmin) {
        container.querySelector('#admin-busca').addEventListener('input', (e) => {
            renderListaPersonagens(container, e.target.value);
        });
    }

    renderListaPersonagens(container, '');
}

function renderListaPersonagens(container, filtro) {
    const listEl = container.querySelector('#character-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    const termo = filtro.toLowerCase();
    const source = globalState.isAdmin ? globalState.cache.all_personagens : globalState.cache.personagens;
    
    const filtered = [];
    source.forEach(char => {
        if(char.nome?.toLowerCase().includes(termo)) filtered.push(char);
    });

    if(filtered.length === 0) {
        listEl.innerHTML = '<p class="col-span-full text-center text-slate-500 italic py-10">Nenhum personagem encontrado.</p>';
        return;
    }

    filtered.sort((a,b)=>(a.nome||'').localeCompare(b.nome)).forEach(data => {
        const item = document.createElement('div');
        item.className = 'bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-amber-500 hover:bg-slate-800 hover:shadow-[0_4px_20px_rgba(245,158,11,0.15)] cursor-pointer transition-all flex flex-col relative group h-36';
        
        const date = data.lastAccessed?.toDate ? data.lastAccessed.toDate().toLocaleDateString('pt-BR') : 'Nunca';
        const img = (data.imagemPrincipal && data.imageUrls && data.imageUrls[data.imagemPrincipal]) ? data.imageUrls[data.imagemPrincipal] : PLACEHOLDER_IMAGE_URL;

        const delBtn = globalState.isAdmin ? `
            <button class="btn-delete-char absolute top-2 right-2 w-8 h-8 rounded-full bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" data-id="${data.id}" title="Excluir Ficha">
                <i class="fas fa-trash pointer-events-none"></i>
            </button>` : '';

        item.innerHTML = `
            ${delBtn}
            <div class="flex items-center gap-4 mb-3 relative z-0">
                <div class="w-14 h-14 rounded-full border-2 border-slate-600 group-hover:border-amber-400 overflow-hidden bg-black shrink-0 transition-colors">
                    <img src="${img}" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow overflow-hidden">
                    <h4 class="text-lg font-cinzel font-bold text-white group-hover:text-amber-400 truncate transition-colors">${data.nome || 'Sem Nome'}</h4>
                    <p class="text-xs text-slate-400 truncate">Jogador: <span class="text-slate-300 font-medium">${data.jogador || 'N/A'}</span></p>
                </div>
            </div>
            <div class="mt-auto flex justify-between items-end border-t border-slate-700/50 pt-2 relative z-0">
                <div class="text-[10px] text-slate-500 font-mono">Lvl ${data.levelPersonagemBase || 1}</div>
                <div class="text-[9px] text-slate-600">Modificado: ${date}</div>
            </div>
        `;
        
        item.addEventListener('click', e => {
            if(!e.target.closest('.btn-delete-char')) renderFichaEditor(data.id);
        });
        
        if(globalState.isAdmin) {
            item.querySelector('.btn-delete-char')?.addEventListener('click', e => {
                e.stopPropagation();
                if(confirm(`Excluir permanentemente ${data.nome}? Isso não pode ser desfeito.`)) {
                    deleteDoc(doc(db,"rpg_fichas",data.id)).then(() => {
                        globalState.cache.personagens.delete(data.id);
                        globalState.cache.all_personagens.delete(data.id);
                        renderPainelFichas();
                        if (globalState.selectedCharacterId === data.id) {
                            const sel = document.getElementById('character-select');
                            if(sel) sel.value = "";
                            if(window.handleCharacterSelect) window.handleCharacterSelect("");
                        }
                    });
                }
            });
        }
        listEl.appendChild(item);
    });
}

// ============================================================================
// --- TELA 2: EDITOR DE FICHA (LAYOUT VTT FULL SCREEN) ---
// ============================================================================
export async function renderFichaEditor(fichaId) {
    const container = document.getElementById('painel-fichas-content');
    if(!container) return;
    
    let activeBottomTab = 'historia'; 
    const currentActiveBtn = container.querySelector('.bottom-tab-btn.active');
    if (currentActiveBtn) {
        if (currentActiveBtn.textContent.toLowerCase().includes('anotações')) activeBottomTab = 'anotacoes';
        else if (currentActiveBtn.textContent.toLowerCase().includes('objetivos')) activeBottomTab = 'objetivos';
    }

    container.innerHTML = `<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-16 w-16 border-t-4 border-amber-500"></div></div>`;
    
    globalState.painelFichas.pontos = { disponiveis: 0, baseAtk: 0, baseDef: 0, baseEva: 0, tempAtk: 0, tempDef: 0, tempEva: 0 };
    globalState.painelFichas.bonusBase = { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 };

    let fichaData = {};
    let fullData = { bonusItens: { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 } };

    if (fichaId && window.gatherAllCharacterData) {
        fullData = await window.gatherAllCharacterData(fichaId);
        fichaData = fullData.ficha;
    }

    const inputClass = "w-full bg-slate-900 border border-slate-700 rounded text-slate-200 px-3 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition outline-none font-medium shadow-inner text-lg text-amber-400 font-cinzel ";

    container.innerHTML = `
        <div class="w-full h-full flex flex-col gap-4 animate-fade-in pb-4">
            
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm shrink-0 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div class="flex-grow grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-end w-full">
                    <div class="lg:col-span-2 space-y-1">
                        <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Nome do Personagem</label>
                        <input type="text" id="editor-nome" class="${inputClass}">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Jogador</label>
                        <input type="text" id="editor-jogador" class="${inputClass}">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Raça</label>
                        <select id="editor-racaId" class="${inputClass}"></select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Classe</label>
                        <select id="editor-classeId" class="${inputClass}"></select>
                    </div>
                </div>
                <div class="flex gap-4 w-full xl:w-auto shrink-0 mt-2 xl:mt-0 justify-end">
                    <button id="btn-voltar-painel" class="btn bg-red-700 hover:bg-red-500 text-white px-6 py-5 text-sm shadow">Voltar</button>
                    <button id="btn-salvar-ficha" class="btn bg-green-600 hover:bg-green-500 text-black px-8 py-5 text-sm font-bold shadow-lg transform transition active:scale-95"><i class="fas fa-save mr-2"></i> Salvar</button>
                </div>
            </div>

            <div class="flex-grow flex flex-col lg:flex-row gap-4 min-h-0">
                <div class="w-full lg:w-5/12 xl:w-1/3 flex flex-col gap-4 overflow-y-auto custom-scroll pr-1">
                    
                    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col gap-3 shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-1/3">
                                <label class="text-[9px] text-amber-500 font-bold uppercase tracking-widest block mb-1">Total XP</label>
                                <input type="number" id="editor-experiencia" class="w-full bg-slate-900 border border-amber-900/50 rounded px-2 py-1.5 text-sm text-center font-bold text-amber-400 outline-none focus:border-amber-500">
                            </div>
                            <div class="w-2/3 mt-4">
                                <div class="w-full relative h-11 bg-black rounded border border-slate-600 overflow-hidden shadow-inner" id="xp-bar-container">
                                    <div id="xp-bar-fill" class="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-900 to-indigo-600 transition-all w-0"></div>
                                    <div id="xp-bar-text" class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white text-shadow-sm">0/0</div>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3 mt-1">
                            <div class="space-y-1">
                                <label class="text-[9px] text-slate-500 font-bold uppercase tracking-widest block  mb-1">Subclasse</label>
                                <select id="editor-subclasseId" class="${inputClass} "></select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] text-purple-400 font-bold uppercase tracking-widest block  mb-1">Pts. Mestre</label>
                                <input type="number" id="editor-pontosExtrasMestre" class="w-full bg-slate-900 border border-purple-900/30 rounded px-2 py-1.5 text-xs text-center font-bold text-purple-300 outline-none" placeholder="0">
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2 shrink-0">
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-sky-500 font-bold uppercase">Nível</label>
                            <input type="text" id="view-level" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-emerald-500 font-bold uppercase">HP Max</label>
                            <input type="text" id="view-hp" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-blue-500 font-bold uppercase">MP Max</label>
                            <input type="text" id="view-mp" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-amber-500 font-bold uppercase">Iniciativa</label>
                            <input type="text" id="view-iniciativa" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-purple-500 font-bold uppercase">Movimento</label>
                            <input type="text" id="view-movimento" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-2 text-center shadow-inner">
                            <label class="text-[9px] text-rose-500 font-bold uppercase">AP</label>
                            <input type="text" id="view-ap" class="bg-transparent border-none text-white text-xl font-cinzel font-bold p-0 text-center w-full focus:outline-none" disabled>
                        </div>
                    </div>

                    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col shrink-0">
                        <div class="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                            <span class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Atributos Base</span>
                            <div class="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-600">
                                <span class="text-[9px] text-slate-500 uppercase font-bold">Pts:</span>
                                <div id="pontos-disponiveis" class="text-sm font-bold text-emerald-400 font-cinzel leading-none">0</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            ${['atk','def','eva'].map(stat => `
                            <div class="bg-slate-900/80 rounded-lg p-2 border border-slate-700 flex flex-col shadow-inner">
                                <div class="text-center mb-1">
                                    <h4 class="font-bold text-slate-400 text-[10px] uppercase tracking-wider">${stat === 'atk' ? 'Ataque' : (stat === 'def' ? 'Defesa' : 'Evasão')}</h4>
                                    <div id="display-total-${stat}" class="text-lg font-bold text-amber-400 font-cinzel leading-none mt-1">0</div>
                                </div>
                                <div class="flex justify-between items-center bg-slate-800 px-1 py-1 mb-2 border border-slate-600 rounded select-none">
                                    <button id="btn-${stat}-menos" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center font-bold transition active:scale-95 text-sm">-</button>
                                    <span id="display-${stat}" class="font-bold text-white text-sm mx-1 text-center w-6">0</span>
                                    <button id="btn-${stat}-mais" class="w-6 h-6 rounded bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold transition active:scale-95 text-sm">+</button>
                                </div>
                                <div class="space-y-1 text-[8px] text-slate-500 font-mono">
                                    <div class="flex justify-between"><span>Base:</span><span id="detail-${stat}-base" class="text-slate-400">0</span></div>
                                    <div class="flex justify-between"><span>Equip:</span><span id="detail-${stat}-equip" class="text-sky-400">0</span></div>
                                    <div class="flex justify-between"><span>Const:</span><span id="detail-${stat}-const" class="text-purple-400">0</span></div>
                                    <div class="flex justify-between"><span>Ego:</span><span id="detail-${stat}-ego" class="text-pink-400">0</span></div>
                                </div>
                            </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-7/12 xl:w-2/3 flex flex-col gap-4 min-h-0">
                    
                    <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-sm flex gap-4 shrink-0 h-40">
                        <div class="w-32 h-full relative rounded-lg border border-slate-600 bg-black overflow-hidden shadow-inner shrink-0 group">
                            <div id="main-image-placeholder-icon" class="absolute inset-0 flex flex-col items-center justify-center text-slate-600 ${fichaData.imagemPrincipal ? 'hidden' : ''}">
                                <i class="fas fa-image text-2xl mb-1 opacity-50"></i>
                                <span class="text-[8px] uppercase font-bold opacity-50 text-center px-1">Sem Avatar</span>
                            </div>
                            <img id="main-image-display" src="" class="hidden w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                        </div>
                        <div class="flex-grow flex flex-col min-w-0">
                            <h4 class="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><i class="fas fa-images text-sky-400"></i> Galeria de Aparências</h4>
                            <div id="image-upload-grid" class="flex flex-wrap gap-1.5 overflow-y-auto custom-scroll pr-1 content-start"></div>
                        </div>
                    </div>

                    <div class="flex flex-col flex-grow bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden min-h-[300px]">
                        <div class="flex border-b border-slate-700 shrink-0">
                            <button class="bottom-tab-btn active px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent hover:text-white transition-colors" onclick="window.switchBottomTab('historia')">História</button>
                            <button class="bottom-tab-btn px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent hover:text-white transition-colors" onclick="window.switchBottomTab('anotacoes')">Anotações</button>
                            <button class="bottom-tab-btn flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent hover:text-white transition-colors" onclick="window.switchBottomTab('objetivos')">
                                <i class="fas fa-bullseye text-amber-500"></i> Objetivos
                            </button>
                            <style>
                                .bottom-tab-btn.active { color: #f59e0b; border-bottom-color: #f59e0b; background: rgba(245,158,11,0.05); }
                            </style>
                        </div>
                        
                        <div class="p-4 flex-grow flex flex-col min-h-0">
                            <div id="tab-bottom-historia" class="bottom-tab-content h-full animate-fade-in flex flex-col">
                                <textarea id="editor-historia" class="flex-grow w-full bg-slate-900/50 border border-slate-700 rounded p-4 text-slate-300 text-sm leading-relaxed resize-none focus:border-amber-500 outline-none placeholder-slate-600 shadow-inner" placeholder="Escreva a lenda do seu personagem..."></textarea>
                            </div>

                            <div id="tab-bottom-anotacoes" class="bottom-tab-content hidden h-full animate-fade-in flex flex-col">
                                <textarea id="editor-anotacoes" class="flex-grow w-full bg-slate-900/50 border border-slate-700 rounded p-4 text-slate-300 text-sm leading-relaxed resize-none focus:border-amber-500 outline-none placeholder-slate-600 shadow-inner" placeholder="Mochila de campanha, diário de missões, notas rápidas..."></textarea>
                            </div>

                            <div id="tab-bottom-objetivos" class="bottom-tab-content hidden h-full animate-fade-in overflow-y-auto custom-scroll pr-2">
                                <div id="objectives-root"></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>`;

    // PREENCHIMENTO DOS DADOS
    const populate = (id, map) => { 
        const sel = container.querySelector('#'+id); 
        sel.innerHTML = '<option value="" class="bg-slate-900 text-slate-500">-- Selecione --</option>';
        
        [...map.values()].sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(d => {
            const opt = new Option(d.nome, d.id);
            opt.className = "bg-slate-900 text-slate-200 font-sans"; 
            sel.add(opt);
        }); 
        sel.value = fichaData[id.replace('editor-','')] || ''; 
    };
    
    populate('editor-racaId', globalState.cache.racas); 
    populate('editor-classeId', globalState.cache.classes); 
    populate('editor-subclasseId', globalState.cache.subclasses);
    
    const getEl = id => container.querySelector('#'+id);
    getEl('editor-jogador').value = fichaData.jogador || '';
    getEl('editor-nome').value = fichaData.nome || '';
    getEl('editor-experiencia').value = fichaData.experienciapersonagemBase || 0;
    getEl('editor-pontosExtrasMestre').value = fichaData.pontosExtrasMestre || 0;
    getEl('editor-historia').value = fichaData.historia || '';
    getEl('editor-anotacoes').value = fichaData.anotacoes || '';
    
    setupImageGallery(container, fichaData.imageUrls || {}, fichaData.imagemPrincipal);
    
    // BLOQUEIO DE EDIÇÃO DO MESTRE
    const fichaJaExiste = !!fichaId;
    const usuarioEhJogador = !globalState.isAdmin;
    const bloquearGeral = fichaJaExiste && usuarioEhJogador;
    const bloquearApenasMestre = usuarioEhJogador; 

    ['editor-nome', 'editor-racaId', 'editor-classeId', 'editor-jogador'].forEach(id => {
        const el = container.querySelector('#' + id);
        if(el) {
            el.disabled = bloquearGeral;
            if(bloquearGeral) el.classList.add('opacity-60', 'cursor-not-allowed');
        }
    });

    ['editor-subclasseId', 'editor-pontosExtrasMestre'].forEach(id => {
        const el = container.querySelector('#' + id);
        if(el) {
            el.disabled = bloquearApenasMestre;
            if(bloquearApenasMestre) {
                el.classList.add('opacity-60', 'cursor-not-allowed');
                el.title = "Apenas o Mestre pode alterar este campo.";
            }
        }
    });

    const elXP = container.querySelector('#editor-experiencia');
    if(elXP) elXP.disabled = usuarioEhJogador;

    // LISTENERS DE BOTÃO
    getEl('btn-salvar-ficha').addEventListener('click', () => salvarFicha(fichaId, container));
    getEl('btn-voltar-painel').addEventListener('click', renderPainelFichas);
    
    ['editor-racaId','editor-classeId','editor-experiencia'].forEach(id => getEl(id).addEventListener('change', () => recalculateEditor(container, fichaData, fullData)));
    
    ['atk','def','eva'].forEach(stat => {
        const btnMais = container.querySelector(`#btn-${stat}-mais`);
        const btnMenos = container.querySelector(`#btn-${stat}-menos`);

        if (btnMais) btnMais.onclick = (e) => changePoints(stat, 1, container, e);
        if (btnMenos) btnMenos.onclick = (e) => changePoints(stat, -1, container, e);
    });

    if (fichaId) {
        renderObjectivesManager(fichaData);
        window.switchBottomTab(activeBottomTab); 
    } else {
        document.getElementById('objectives-root').innerHTML = '<p class="text-slate-500 italic">Salve a ficha primeiro para adicionar objetivos.</p>';
    }

    await recalculateEditor(container, fichaData, fullData);
}

// Lógica de Abas Inferiores
window.switchBottomTab = function(tabName) {
    const container = document.getElementById('painel-fichas-content');
    if(!container) return;

    const btns = container.querySelectorAll('.bottom-tab-btn');
    btns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName === 'anotacoes' ? 'anotações' : (tabName === 'historia' ? 'história' : 'objetivos'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    container.querySelectorAll('.bottom-tab-content').forEach(el => el.classList.add('hidden'));
    const target = container.querySelector(`#tab-bottom-${tabName}`);
    if(target) target.classList.remove('hidden');
};

function setupImageGallery(container, urls, mainKey) {
    const grid = container.querySelector('#image-upload-grid');
    const mainDisplay = container.querySelector('#main-image-display');
    const placeholderIcon = container.querySelector('#main-image-placeholder-icon');
    
    const updateMainDisplay = (src) => {
        if (src && src !== '' && src !== PLACEHOLDER_IMAGE_URL) {
            mainDisplay.src = src;
            mainDisplay.classList.remove('hidden');
            placeholderIcon.classList.add('hidden');
        } else {
            mainDisplay.src = '';
            mainDisplay.classList.add('hidden');
            placeholderIcon.classList.remove('hidden');
        }
    };

    const initialUrl = (mainKey && urls[mainKey]) ? urls[mainKey] : null;
    updateMainDisplay(initialUrl);

    grid.innerHTML = '';
    
    for (let i = 1; i <= 26; i++) {
        const key = `imagem${i}`;
        const rawUrl = urls[key];
        
        const hasImage = rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('http') || rawUrl.startsWith('blob:'));
        const imageUrl = hasImage ? rawUrl : '';
        const isMain = (mainKey === key);
        
        const slot = document.createElement('div');
        
        let classes = 'upload-slot w-14 h-14 relative rounded-md border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all group shrink-0 ';
        if (isMain) classes += 'is-main border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] ';
        else classes += hasImage ? 'border-slate-600 ' : 'border-slate-700 border-dashed hover:border-sky-500 hover:bg-slate-700/50 ';

        slot.className = classes;
        if(isMain) slot.dataset.isMain = "true";

        slot.innerHTML = `
            <button type="button" class="star-btn absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center z-30 transition-all ${isMain ? 'text-amber-500 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:scale-110'}" title="Definir como Principal">
                <i class="fas fa-star text-[8px]"></i>
            </button>
            
            <div class="slot-view w-full h-full pointer-events-none relative flex items-center justify-center bg-slate-900">
                <img src="${imageUrl}" class="user-img ${hasImage ? '' : 'hidden'} w-full h-full object-cover">
                <div class="slot-placeholder ${hasImage ? 'hidden' : 'flex'} flex-col items-center opacity-30 group-hover:opacity-100 group-hover:text-sky-400 transition-all">
                     <i class="fas fa-plus text-sm"></i>
                </div>
            </div>
            
            <input type="file" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" title="${hasImage ? 'Alterar imagem' : 'Adicionar imagem'}">
        `;
        
        grid.appendChild(slot);

        const input = slot.querySelector('input');
        const userImg = slot.querySelector('.user-img');
        const placeholderDiv = slot.querySelector('.slot-placeholder');
        const starBtn = slot.querySelector('.star-btn');

        userImg.onerror = () => {
            userImg.classList.add('hidden'); 
            userImg.src = ''; 
            placeholderDiv.classList.remove('hidden'); 
            placeholderDiv.classList.add('flex');
            slot.classList.remove('has-image', 'border-slate-600', 'is-main', 'border-amber-500'); 
            slot.classList.add('empty', 'border-slate-700', 'border-dashed'); 
        };

        input.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const blobUrl = URL.createObjectURL(file);
                
                userImg.src = blobUrl;
                userImg.classList.remove('hidden');
                placeholderDiv.classList.remove('flex');
                placeholderDiv.classList.add('hidden');
                
                slot.classList.remove('border-dashed', 'border-slate-700');
                slot.classList.add('border-slate-600', 'has-image');
                
                if (slot.dataset.isMain === "true") updateMainDisplay(blobUrl);
                
                if (!grid.querySelector('.is-main')) starBtn.click();
            }
        });

        starBtn.addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault();
            grid.querySelectorAll('.upload-slot').forEach(s => {
                s.classList.remove('is-main', 'border-amber-500', 'shadow-[0_0_8px_rgba(245,158,11,0.4)]');
                if(s.querySelector('.user-img').src) s.classList.add('border-slate-600');
                
                const btn = s.querySelector('.star-btn');
                btn.classList.remove('text-amber-500', 'opacity-100');
                btn.classList.add('text-slate-400', 'opacity-0');
                
                delete s.dataset.isMain;
            });
            
            slot.classList.remove('border-slate-600');
            slot.classList.add('is-main', 'border-amber-500', 'shadow-[0_0_8px_rgba(245,158,11,0.4)]');
            slot.dataset.isMain = "true";
            
            starBtn.classList.remove('text-slate-400', 'opacity-0');
            starBtn.classList.add('text-amber-500', 'opacity-100');

            if (!userImg.classList.contains('hidden') && userImg.src) {
                updateMainDisplay(userImg.src);
            } else {
                updateMainDisplay(null);
            }
        });
    }
}

function changePoints(stat, direction, container, event) {
    const p = globalState.painelFichas.pontos;
    const capKey = stat.charAt(0).toUpperCase() + stat.slice(1);
    const tempKey = `temp${capKey}`; 
    const baseKey = `base${capKey}`; 

    let amount = 1;
    if (event) {
        if (event.ctrlKey || event.metaKey) amount = 50; 
        else if (event.shiftKey) amount = 10;            
    }

    const currentVal = p[tempKey];

    if (direction > 0) {
        if (p.disponiveis <= 0) return;
        const actualAdd = Math.min(amount, p.disponiveis);
        p[tempKey] += actualAdd;
        p.disponiveis -= actualAdd;
    } 
    else {
        const distanceToBase = currentVal - p[baseKey];
        if (distanceToBase <= 0) return; 
        const actualRemove = Math.min(amount, distanceToBase);
        p[tempKey] -= actualRemove;
        p.disponiveis += actualRemove;
    }
    updateEditorUI(container);
}

async function recalculateEditor(container, originalFicha, fullData) {
    const getElVal = id => container.querySelector('#'+id).value;
    const fakeFicha = { 
        ...originalFicha, 
        racaId: getElVal('editor-racaId'), 
        classeId: getElVal('editor-classeId'), 
        subclasseId: getElVal('editor-subclasseId'), 
        experienciapersonagemBase: Number(getElVal('editor-experiencia')) 
    };
    
    const simulado = {
        ficha: fakeFicha,
        raca: globalState.cache.racas.get(fakeFicha.racaId)||{},
        classe: globalState.cache.classes.get(fakeFicha.classeId)||{},
        subclasse: globalState.cache.subclasses.get(fakeFicha.subclasseId)||{},
        bonusItens: fullData.bonusItens,
        constellationTemplate: fullData.constellationTemplate
    };

    const stats = calculateMainStats(simulado, {atk:0,def:0,eva:0});
    
    container.querySelector('#view-level').value = stats.level;
    container.querySelector('#view-hp').value = stats.hpMax;
    container.querySelector('#view-mp').value = stats.mpMax;
    container.querySelector('#view-iniciativa').value = stats.iniciativa;
    container.querySelector('#view-ap').value = stats.ap;
    
    const movEl = container.querySelector('#view-movimento');
    movEl.value = Math.max(0, stats.movimento - stats.weightPenalty); 
    
    if (stats.weightPenalty > 0) {
        movEl.classList.remove('text-white');
        movEl.classList.add('text-red-500', 'font-bold');
        movEl.title = `Sobrecarga! Penalidade de Peso: -${stats.weightPenalty}`;
    } else {
        movEl.classList.remove('text-red-500', 'font-bold');
        movEl.classList.add('text-white');
        movEl.title = '';
    }
    
    const p = globalState.painelFichas.pontos;
    p.breakdowns = stats.breakdowns; 

    const extra = Number(getElVal('editor-pontosExtrasMestre') || originalFicha.pontosExtrasMestre || 0);
    const totalPoints = ((stats.level - 1) * 3) + extra;
    
    if(p.tempAtk === 0 && p.tempDef === 0 && p.tempEva === 0 && originalFicha.pontosDistribuidosAtk !== undefined) {
        p.tempAtk = originalFicha.pontosDistribuidosAtk || 0;
        p.tempDef = originalFicha.pontosDistribuidosDef || 0;
        p.tempEva = originalFicha.pontosDistribuidosEva || 0;
    }
    
    const gastos = p.tempAtk + p.tempDef + p.tempEva;
    p.disponiveis = Math.max(0, totalPoints - gastos);
    
    updateEditorUI(container);
}

function updateEditorUI(container) {
    const p = globalState.painelFichas.pontos;
    const bd = p.breakdowns; 

    const dispEl = container.querySelector('#pontos-disponiveis');
    dispEl.textContent = p.disponiveis;
    if(p.disponiveis === 0) dispEl.classList.add('text-slate-600'); else dispEl.classList.remove('text-slate-600');

    ['atk','def','eva'].forEach(stat => {
        const capKey = stat.charAt(0).toUpperCase() + stat.slice(1);
        const tempVal = p[`temp${capKey}`]; 
        const statBd = bd[stat]; 

        container.querySelector(`#detail-${stat}-base`).textContent = statBd.base;
        container.querySelector(`#detail-${stat}-equip`).textContent = statBd.equip;
        container.querySelector(`#detail-${stat}-const`).textContent = statBd.const;
        
        const elEgo = container.querySelector(`#detail-${stat}-ego`);
        if(elEgo) elEgo.textContent = statBd.ego || 0; 
        
        container.querySelector(`#display-${stat}`).textContent = tempVal;
        
        let total = statBd.base + statBd.equip + statBd.const + tempVal + (statBd.ego || 0);

        let debuffFome = 1;
        if (globalState.selectedCharacterData && globalState.selectedCharacterData.ficha) {
            debuffFome = getFomeDebuffMultiplier(globalState.selectedCharacterData.ficha);
        }
        total = Math.floor(total * debuffFome);

        const displayTotalEl = container.querySelector(`#display-total-${stat}`);
        displayTotalEl.textContent = total;

        if (debuffFome < 1) {
            displayTotalEl.classList.remove('text-amber-400');
            displayTotalEl.classList.add('text-red-500');
        } else {
            displayTotalEl.classList.remove('text-red-500');
            displayTotalEl.classList.add('text-amber-400');
        }
        
        const btnMais = container.querySelector(`#btn-${stat}-mais`);
        const btnMenos = container.querySelector(`#btn-${stat}-menos`);
        if(btnMais) { btnMais.disabled = (p.disponiveis <= 0); btnMais.classList.toggle('opacity-50', p.disponiveis <= 0); }
        if(btnMenos) { btnMenos.disabled = (tempVal <= 0); btnMenos.classList.toggle('opacity-50', tempVal <= 0); }
    });

    const xpInput = container.querySelector('#editor-experiencia');
    const currentXp = Number(xpInput.value) || 0;
    const tabela = globalState.cache.tabela_xp;
    
    if (tabela && tabela.niveis) {
        const levels = Object.keys(tabela.niveis).map(Number).sort((a,b)=>a-b);
        let currentLevel = 1;
        let xpFloor = 0;        
        let xpCeiling = 1000;   
        let isMaxLevel = false;

        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const reqProximo = tabela.niveis[lvl].experienciaParaProximoNivel;
            
            if (currentXp < reqProximo) {
                currentLevel = lvl;
                xpFloor = (i === 0) ? 0 : tabela.niveis[levels[i-1]].experienciaParaProximoNivel;
                xpCeiling = reqProximo;
                break;
            }
            
            if (i === levels.length - 1) {
                currentLevel = lvl; 
                isMaxLevel = true;
            }
        }

        const xpTextElement = container.querySelector('#xp-bar-text');
        const xpFillElement = container.querySelector('#xp-bar-fill');
        const xpContainer = container.querySelector('#xp-bar-container'); 

        if (isMaxLevel) {
            if(xpTextElement) xpTextElement.textContent = `Nível ${currentLevel} (Máx)`;
            if(xpFillElement) xpFillElement.style.width = "100%";
        } else {
            const xpRelativo = currentXp - xpFloor;
            const xpNecessario = xpCeiling - xpFloor;
            const pct = Math.min(100, Math.max(0, (xpRelativo / xpNecessario) * 100));
            
            if(xpTextElement) xpTextElement.textContent = `Nvl ${currentLevel} - ${Math.floor(pct)}%`;
            if(xpFillElement) xpFillElement.style.width = `${pct}%`;
            if(xpContainer) xpContainer.title = `XP Atual: ${currentXp}\nProgresso do Nível: ${xpRelativo} / ${xpNecessario}`;
        }
    }
}

async function salvarFicha(id, container) {
    const user = globalState.currentUser;
    if(!user) return;
    
    const btnSalvar = container.querySelector('#btn-salvar-ficha');
    const originalText = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

    const getVal = i => container.querySelector('#'+i).value;
    const fichaOriginal = id ? globalState.cache.all_personagens.get(id) : {};
    
    const urls = {};
    const slots = container.querySelectorAll('.upload-slot');
    let mainKey = null;

    for(let i=0; i<slots.length; i++) {
        const idx = i+1;
        const input = slots[i].querySelector('input');
        const file = input ? input.files[0] : null;
        const key = `imagem${idx}`;
        if(slots[i].dataset.isMain === "true") mainKey = key;

        if(file) {
            try {
                if(window.compressImage) {
                    const compressedBlob = await window.compressImage(file, 800, 800, 0.7);
                    if (fichaOriginal.imageUrls && fichaOriginal.imageUrls[key]) {
                        const oldUrl = fichaOriginal.imageUrls[key];
                        if (oldUrl.includes('firebasestorage')) {
                            try {
                                await deleteObject(ref(storage, oldUrl));
                            } catch(err) {
                                console.warn(`Aviso: Não foi possível deletar a imagem antiga (${key}).`);
                            }
                        }
                    }
                    const refImg = ref(storage, `imagens_rpg/${id||'temp'}/${key}_${Date.now()}.jpg`);
                    urls[key] = await getDownloadURL((await uploadBytes(refImg, compressedBlob)).ref);
                }
            } catch (imgError) {
                console.error("Erro ao processar imagem:", imgError);
                urls[key] = fichaOriginal.imageUrls?.[key] || "";
            }
        } else {
            const imgTag = slots[i].querySelector('.user-img');
            const prevSrc = imgTag ? imgTag.src : null;
            if(prevSrc && !prevSrc.startsWith('blob:') && !prevSrc.includes('placeholder')) {
                urls[key] = prevSrc;
            }
        }
    }

    const fakeFicha = { 
        ...fichaOriginal,
        racaId: getVal('editor-racaId'), 
        classeId: getVal('editor-classeId'), 
        subclasseId: getVal('editor-subclasseId'), 
        experienciapersonagemBase: Number(getVal('editor-experiencia')), 
    };

    let bonusItens = { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 };
    let constellationTemplate = null;

    if (id && window.gatherAllCharacterData) {
        try {
            const fullData = await window.gatherAllCharacterData(id);
            bonusItens = fullData.bonusItens;
            constellationTemplate = fullData.constellationTemplate;
        } catch (e) {
            console.warn("Ficha nova ou erro ao buscar dados extras:", e);
        }
    }
    
    const stats = calculateMainStats({
        ficha: fakeFicha,
        raca: globalState.cache.racas.get(fakeFicha.racaId)||{},
        classe: globalState.cache.classes.get(fakeFicha.classeId)||{},
        subclasse: globalState.cache.subclasses.get(fakeFicha.subclasseId)||{},
        bonusItens: bonusItens,
        constellationTemplate: constellationTemplate
    }, { 
        atk: globalState.painelFichas.pontos.tempAtk, 
        def: globalState.painelFichas.pontos.tempDef, 
        eva: globalState.painelFichas.pontos.tempEva 
    });

    const oldMaxAP = Number(fichaOriginal.apMaxPersonagemBase || 0);
    const oldCurrentAP = (fichaOriginal.apPersonagemBase !== undefined) ? Number(fichaOriginal.apPersonagemBase) : oldMaxAP;
    const newMaxAP = Number(stats.ap);
    let finalCurrentAP = newMaxAP; 

    if (id) { 
        const diff = newMaxAP - oldMaxAP; 
        finalCurrentAP = Math.max(0, oldCurrentAP + diff);
    }

    const racaFinal = globalState.cache.racas.get(fakeFicha.racaId) || {};
    const classeFinal = globalState.cache.classes.get(fakeFicha.classeId) || {};
    const subclasseFinal = globalState.cache.subclasses.get(fakeFicha.subclasseId) || {};
    
    const novosAtributosDinamicos = calculateDynamicAttributes(fichaOriginal, racaFinal, classeFinal, subclasseFinal);

    const hpShieldMult = Number(novosAtributosDinamicos.defesaCorporalNativaTotal) || 0;
    const hpExtraMult  = Number(novosAtributosDinamicos.pontosHPExtraTotal) || 0;
    const mpShieldMult = Number(novosAtributosDinamicos.defesaMagicaNativaTotal) || 0;
    const mpExtraMult  = Number(novosAtributosDinamicos.pontosMPExtraTotal) || 0;

    const hpShieldMax = Math.floor(stats.hpMax * hpShieldMult);
    const hpExtraMax  = Math.floor(stats.hpMax * hpExtraMult);
    const mpShieldMax = Math.floor(stats.mpMax * mpShieldMult);
    const mpExtraMax  = Math.floor(stats.mpMax * mpExtraMult);

    novosAtributosDinamicos.defesaCorporalNativaTotal = hpShieldMax;
    novosAtributosDinamicos.pontosHPExtraTotal = hpExtraMax;
    novosAtributosDinamicos.defesaMagicaNativaTotal = mpShieldMax;
    novosAtributosDinamicos.pontosMPExtraTotal = mpExtraMax;

    const hpShieldAtual = Math.min(fichaOriginal.hpShieldAtual !== undefined ? Number(fichaOriginal.hpShieldAtual) : hpShieldMax, hpShieldMax);
    const hpExtraAtual  = Math.min(fichaOriginal.hpExtraAtual !== undefined ? Number(fichaOriginal.hpExtraAtual) : hpExtraMax, hpExtraMax);
    const mpShieldAtual = Math.min(fichaOriginal.mpShieldAtual !== undefined ? Number(fichaOriginal.mpShieldAtual) : mpShieldMax, mpShieldMax);
    const mpExtraAtual  = Math.min(fichaOriginal.mpExtraAtual !== undefined ? Number(fichaOriginal.mpExtraAtual) : mpExtraMax, mpExtraMax);

    const weightStats = calculateWeightStats(fakeFicha, stats.level);
    
    const data = {
        jogadorUid: fichaOriginal.jogadorUid || user.uid,
        jogador: getVal('editor-jogador'),
        nome: getVal('editor-nome'),
        imageUrls: { ...fichaOriginal.imageUrls, ...urls },
        imagemPrincipal: mainKey || fichaOriginal.imagemPrincipal,
        historia: getVal('editor-historia'),
        anotacoes: getVal('editor-anotacoes'),
        
        racaId: fakeFicha.racaId,
        classeId: fakeFicha.classeId,
        subclasseId: fakeFicha.subclasseId,
        
        experienciapersonagemBase: fakeFicha.experienciapersonagemBase,
        pontosExtrasMestre: Number(getVal('editor-pontosExtrasMestre')),
        
        pontosDistribuidosAtk: globalState.painelFichas.pontos.tempAtk,
        pontosDistribuidosDef: globalState.painelFichas.pontos.tempDef,
        pontosDistribuidosEva: globalState.painelFichas.pontos.tempEva,
        
        levelPersonagemBase: stats.level,
        hpMaxPersonagemBase: stats.hpMax,
        mpMaxPersonagemBase: stats.mpMax,
        
        pesoMaximoPersonagemBase: weightStats.max,
        
        hpPersonagemBase: Math.min(fichaOriginal.hpPersonagemBase !== undefined ? Number(fichaOriginal.hpPersonagemBase) : stats.hpMax, stats.hpMax),
        mpPersonagemBase: Math.min(fichaOriginal.mpPersonagemBase !== undefined ? Number(fichaOriginal.mpPersonagemBase) : stats.mpMax, stats.mpMax),
        
        hpShieldAtual: hpShieldAtual,
        hpExtraAtual: hpExtraAtual,
        mpShieldAtual: mpShieldAtual,
        mpExtraAtual: mpExtraAtual,

        iniciativaPersonagemBase: stats.iniciativa,
        movimentoPersonagemBase: stats.movimento,
        
        apMaxPersonagemBase: newMaxAP,
        apPersonagemBase: finalCurrentAP, 
        
        atkPersonagemBase: stats.atk,
        defPersonagemBase: stats.def,
        evaPersonagemBase: stats.eva,

        atributosBasePersonagem: novosAtributosDinamicos,
        
        lastAccessed: serverTimestamp()
    };

    try {
        if(id) {
            await updateDoc(doc(db,"rpg_fichas",id), data);
        } else {
            await setDoc(doc(collection(db,"rpg_fichas")), {
                ...data, 
                createdAt: serverTimestamp(), 
                equipamento:{}, 
                mochila:{}, 
                rolagens:{},
                constelacao_unlocked: []
            });
        }
        
        btnSalvar.innerHTML = '<i class="fas fa-check mr-2"></i> Sucesso!';
        btnSalvar.classList.replace('bg-amber-600', 'bg-green-600');
        
        setTimeout(() => {
            btnSalvar.innerHTML = originalText;
            btnSalvar.disabled = false;
            btnSalvar.classList.replace('bg-green-600', 'bg-amber-600');
            
            if(window.preencherCacheTodosPersonagens) window.preencherCacheTodosPersonagens();
            if(!id && window.carregarPersonagensNoSeletor) window.carregarPersonagensNoSeletor(user); 
        }, 1500);

    } catch(e) { 
        console.error(e); 
        alert("Erro ao salvar: " + e.message); 
        btnSalvar.innerHTML = originalText;
        btnSalvar.disabled = false;
    }
}

// --- GESTÃO DE OBJETIVOS ---
function renderObjectivesManager(ficha) {
    const container = document.getElementById('objectives-root');
    if(!container) return;

    const objetivos = ficha.objetivos || []; 
    const logs = ficha.log_objetivos || []; 

    objetivos.sort((a,b) => {
        if (a.adminHidden !== b.adminHidden) return a.adminHidden ? 1 : -1;
        const aDone = a.checks >= 3;
        const bDone = b.checks >= 3;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return 0;
    });

    const isMaster = globalState.isAdmin;

    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <div class="flex items-center gap-2">
                <h3 class="font-cinzel text-amber-400 text-lg border-none m-0">Lista de Objetivos</h3>
                <div class="mechanics-tooltip-container relative inline-block ml-2">
                    <i class="fas fa-question-circle text-slate-500 hover:text-white cursor-help"></i>
                    <div class="mechanics-tooltip-body tooltip-down" style="width: 320px;">
                        <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">Gerenciamento</h4>
                        <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside">
                            <li><i class="fas fa-pen text-sky-400"></i> <strong>Editar:</strong> Corrige o texto.</li>
                            <li><i class="fas fa-trash text-red-400"></i> <strong>Excluir:</strong> Remove o card.</li>
                            <li><strong>Mestre:</strong> Pode desmarcar checks clicando novamente neles.</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <input type="text" id="new-obj-text" maxlength="150" placeholder="Descreva um novo objetivo..." class="bg-slate-900 border border-slate-600 rounded px-4 py-2 text-sm w-64 md:w-80 focus:border-amber-500 outline-none shadow-inner">
                <button onclick="window.addNewObjective()" class="btn btn-primary py-2 px-4 text-xs font-bold uppercase shadow-lg hover:scale-105 transition-transform"><i class="fas fa-plus mr-1"></i> Adicionar</button>
            </div>
        </div>
    `;

    html += `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">`;
    
    if (objetivos.length === 0) {
        html += `<div class="col-span-full text-center text-slate-500 italic py-12 border-2 border-dashed border-slate-700 rounded-lg">A lista de objetivos está vazia no momento.</div>`;
    } else {
        objetivos.forEach(obj => {
            if (obj.adminHidden && !isMaster) return;

            const isCompleted = obj.checks >= 3;
            
            let checksHtml = '';
            for(let i=1; i<=3; i++) {
                const checked = obj.checks >= i;
                const isNext = (i === obj.checks + 1);
                const isCurrent = (i === obj.checks);
                
                const canInteract = isMaster && (isNext || isCurrent);
                const action = isCurrent ? 'uncheck' : 'check';
                
                let cursorClass = canInteract ? 'cursor-pointer hover:border-white hover:bg-white/10 hover:scale-110' : 'cursor-default';
                let colorClass = checked ? 'checked' : 'opacity-30';
                
                checksHtml += `
                    <div onclick="${canInteract ? `window.toggleObjCheck('${obj.id}', ${i}, '${action}')` : ''}" 
                         class="obj-check-btn ${colorClass} ${cursorClass}"
                         title="${canInteract ? (action==='check'?'Marcar (+Rep)':'Desmarcar (-Rep)') : ''}">
                        <i class="fas fa-check text-xs"></i>
                    </div>
                `;
            }

            let borderClass = isCompleted ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : (obj.adminHidden ? 'border-purple-500 border-dashed opacity-70' : 'border-slate-600 hover:border-slate-500');
            
            html += `
                <div class="objective-card ${borderClass} relative group bg-slate-900/40 transition-colors">
                    <div class="absolute top-2 right-2 flex gap-2 opacity-100 transition-opacity z-10 bg-slate-800/80 px-2 py-1 rounded backdrop-blur">
                         <button onclick="window.editObjective('${obj.id}', '${escapeHTML(obj.text)}')" class="text-slate-400 hover:text-sky-400 transition-colors" title="Editar Texto">
                            <i class="fas fa-pen text-[10px]"></i>
                        </button>
                        <button onclick="window.deleteObjective('${obj.id}')" class="text-slate-400 hover:text-red-500 transition-colors" title="Excluir (Limpar da lista)">
                            <i class="fas fa-trash text-[10px]"></i>
                        </button>
                        ${isMaster ? `<button onclick="window.toggleObjAdminHide('${obj.id}')" class="text-slate-400 hover:text-purple-400 transition-colors" title="Admin: Ocultar/Banir"><i class="fas ${obj.adminHidden ? 'fa-eye' : 'fa-ban'} text-[10px]"></i></button>` : ''}
                    </div>

                    ${isCompleted ? '<div class="absolute top-4 right-4 text-amber-500/10 text-6xl drop-shadow-md z-0 pointer-events-none"><i class="fas fa-medal"></i></div>' : ''}
                    
                    <p class="text-sm text-slate-200 font-medium leading-relaxed break-words mb-4 mt-6 pr-4 relative z-10">
                        "${escapeHTML(obj.text)}"
                    </p>
                    
                    <div class="flex justify-between items-end border-t border-slate-700/50 pt-3 mt-auto relative z-10">
                        <div class="flex gap-3">
                            ${checksHtml}
                        </div>
                        ${isCompleted ? '<span class="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Concluído</span>' : ''}
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;

    html += `
        <div class="bg-black/30 rounded-lg border border-slate-700 p-4 shadow-inner">
            <h4 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3"><i class="fas fa-history mr-1"></i> Histórico de Conquistas</h4>
            <div class="max-h-40 overflow-y-auto custom-scroll space-y-1.5 text-xs font-mono text-slate-400 pr-2">
                ${logs.length > 0 ? logs.map(l => `<div class="border-b border-slate-800/50 pb-1"><span class="text-slate-600 font-bold mr-2">[${l.date}]</span> ${l.text}</div>`).join('') : '<span class="italic opacity-50">Nenhum registro no diário.</span>'}
            </div>
        </div>
    `;
    container.innerHTML = html;
} 

window.addNewObjective = async function() {
    const input = document.getElementById('new-obj-text');
    const text = input.value.trim();
    if (!text) return alert("Digite o objetivo.");
    
    const charId = globalState.selectedCharacterId;
    if (!confirm("Confirmar objetivo? Após criar, você não poderá editar o texto.")) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];

            const newObj = {
                id: Date.now().toString(36),
                text: text,
                checks: 0,
                hidden: false,
                created: Date.now()
            };

            const newLog = {
                date: new Date().toLocaleString('pt-BR'),
                text: `Objetivo criado: "${text}"`
            };

            t.update(ref, { 
                objetivos: [newObj, ...objs],
                log_objetivos: [newLog, ...logs]
            });
        });
        input.value = ''; 
    } catch(e) { alert("Erro: " + e); }
};

window.toggleObjCheck = async function(objId, checkIndex, action) {
    if (!globalState.isAdmin) return alert("Apenas o Mestre pode alterar o progresso.");

    const charId = globalState.selectedCharacterId;
    const isUncheck = action === 'uncheck';
    const verb = isUncheck ? "REVERTER" : "CONFIRMAR";
    
    if(!confirm(`Mestre: ${verb} etapa ${checkIndex}/3?\n${isUncheck ? 'A Reputação será removida.' : 'A Reputação será concedida.'}`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];
            const recursos = d.recursos || {};
            
            const objIndex = objs.findIndex(o => o.id === objId);
            if(objIndex === -1) throw "Objetivo não encontrado.";

            let repChange = 2; 
            if (checkIndex === 3) repChange += 4; 

            let logText = "";
            
            if (isUncheck) {
                if (objs[objIndex].checks !== checkIndex) throw "Sincronia incorreta. Recarregue.";
                objs[objIndex].checks = checkIndex - 1; 
                
                recursos.reputacaoObjetivos = (recursos.reputacaoObjetivos || 0) - repChange;
                logText = `Mestre reverteu etapa ${checkIndex} de "${objs[objIndex].text}" (-${repChange} Rep)`;
            } else {
                if (objs[objIndex].checks !== checkIndex - 1) throw "Marque na ordem correta.";
                objs[objIndex].checks = checkIndex;
                
                recursos.reputacaoObjetivos = (recursos.reputacaoObjetivos || 0) + repChange;
                logText = `Mestre validou etapa ${checkIndex}/3 em "${objs[objIndex].text}" (+${repChange} Rep)`;
                if (checkIndex === 3) logText += " - CONCLUÍDO!";
            }

            const newLog = { date: new Date().toLocaleString('pt-BR'), text: logText };
            t.update(ref, { 
                objetivos: objs,
                log_objetivos: [newLog, ...logs],
                recursos: recursos
            });
        });
    } catch(e) { alert("Erro: " + e); }
}; 

window.editObjective = async function(objId, currentText) {
    const newText = prompt("Editar objetivo:", currentText);
    if (newText === null || newText.trim() === "") return;
    if (newText === currentText) return;

    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            
            const idx = objs.findIndex(o => o.id === objId);
            if (idx === -1) throw "Não encontrado.";
            
            objs[idx].text = newText;
            t.update(ref, { objetivos: objs });
        });
    } catch(e) { alert("Erro ao editar: " + e); }
};

window.deleteObjective = async function(objId) {
    if (!confirm("Excluir este objetivo?\n\nUse isso para limpar objetivos já concluídos da tela.\nA reputação ganha e o histórico serão mantidos no Log.")) return;

    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];
            
            const deletedObj = objs.find(o => o.id === objId);
            if (!deletedObj) throw "Já excluído.";

            const newObjs = objs.filter(o => o.id !== objId);
            
            const newLog = { 
                date: new Date().toLocaleString('pt-BR'), 
                text: `Objetivo removido da lista: "${deletedObj.text}" (Progresso: ${deletedObj.checks}/3)` 
            };

            t.update(ref, { 
                objetivos: newObjs,
                log_objetivos: [newLog, ...logs]
            });
        });
    } catch(e) { alert("Erro ao excluir: " + e); }
};

window.toggleObjAdminHide = async function(objId) {
    if (!globalState.isAdmin) return; 

    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            
            const objIndex = objs.findIndex(o => o.id === objId);
            if(objIndex === -1) throw "Objetivo não encontrado";

            const newState = !objs[objIndex].adminHidden;
            objs[objIndex].adminHidden = newState;

            t.update(ref, { objetivos: objs });
        });
    } catch(e) { 
        console.error(e);
        alert("Erro ao alterar visibilidade administrativa: " + e.message); 
    }
};

window.toggleObjHide = async function(objId) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const objIndex = objs.findIndex(o => o.id === objId);
            
            if(objIndex === -1) return;
            
            const newState = !objs[objIndex].hidden;
            objs[objIndex].hidden = newState;

            const logs = d.log_objetivos || [];
            logs.unshift({
                date: new Date().toLocaleString('pt-BR'),
                text: newState ? `Arquivou: "${objs[objIndex].text}"` : `Restaurou: "${objs[objIndex].text}"`
            });

            t.update(ref, { objetivos: objs, log_objetivos: logs });
        });
    } catch(e) { console.error(e); }
}; 
