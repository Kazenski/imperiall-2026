import { db, doc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

function getRankColor(r) {
    let c = { 'SS': 'border-amber-400', 'S': 'border-rose-500', 'A': 'border-amber-500', 'B': 'border-purple-500', 'C': 'border-blue-500', 'D': 'border-emerald-500', 'E': 'border-slate-500' };
    return c[r?.toUpperCase()] || 'border-slate-700';
}

export function renderExtracaoTab() {
    const container = document.getElementById('extracao-content');
    if (!container) return;

    try {
        const charData = globalState.selectedCharacterData;
        if (!charData || !charData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        // Garante a existência do estado base
        if (!globalState.extracao) {
            globalState.extracao = { selectedItem: null, recipe: null };
        }

        // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
        if (!document.getElementById('extracao-layout-wrapper')) {
            container.innerHTML = `
                <div id="extracao-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                    
                    <div class="flex-1 flex flex-col min-w-0 h-full">
                        
                        <div class="flex justify-between items-center mb-4 shrink-0">
                            <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-recycle mr-3 text-slate-600"></i> Extração e Reciclagem</h2>
                        </div>
                        
                        <div class="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm shrink-0 mb-4">
                            <div class="relative w-full">
                                <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                                <input type="text" id="extracao-filtro" placeholder="Buscar item para extrair..." class="w-full bg-slate-900 border border-slate-600 rounded py-1.5 pl-9 pr-4 text-sm text-white focus:border-sky-500 outline-none">
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                            <div id="extracao-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 xl:grid-cols-12 gap-3 content-start"></div>
                        </div>
                    </div>

                    <div class="w-80 md:w-96 shrink-0 flex flex-col h-full pt-12">
                        <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden">
                            
                            <div id="extracao-empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                                <i class="fas fa-hand-sparkles text-6xl mb-4"></i>
                                <p class="text-sm text-center px-6">Selecione um item da mochila para extrair essências ou reciclar materiais.</p>
                            </div>

                            <div id="extracao-detalhes-panel" class="flex-col h-full hidden z-20">
                                <div class="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                                    <div class="w-20 h-20 rounded-xl border-2 border-slate-600 bg-black overflow-hidden mb-3 shadow-md">
                                        <img id="ext-img" src="" class="w-full h-full object-cover">
                                    </div>
                                    <h3 id="ext-nome" class="font-cinzel text-xl text-amber-400 text-center leading-tight mb-1 drop-shadow-md">Nome</h3>
                                    <span id="ext-tipo" class="text-[9px] uppercase tracking-widest text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-700 shadow-inner">Tipo</span>
                                    <div id="ext-qtd" class="text-[10px] text-slate-400 mt-2 font-mono bg-black/40 px-2 py-0.5 rounded border border-slate-800"></div>
                                </div>

                                <div class="flex-1 overflow-y-auto custom-scroll p-4 space-y-6 bg-slate-900/20">
                                    
                                    <div class="bg-slate-950 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                                        <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3 border-l-2 border-sky-500 pl-2"><i class="fas fa-magic mr-1 text-sky-400"></i> Extrair Essências</h4>
                                        
                                        <div class="space-y-1 text-[10px] font-mono mb-4">
                                            <div class="flex justify-between text-slate-400"><span>Valor Base (Item):</span> <span id="ext-val-base">0</span></div>
                                            <div class="flex justify-between text-sky-400"><span>Bônus Especialização:</span> <span id="ext-val-bonus">+0</span></div>
                                            <div class="flex justify-between border-t border-slate-700 pt-2 mt-2">
                                                <span class="font-bold text-slate-300">Total a Receber:</span> 
                                                <span id="ext-val-total" class="font-bold text-sky-400 text-sm">0</span>
                                            </div>
                                        </div>
                                        <button id="btn-confirmar-extracao" class="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded shadow-md transition-transform hover:scale-[1.02]">
                                            Extrair Essências
                                        </button>
                                    </div>

                                    <div id="panel-desfazer-craft" class="bg-slate-950 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                                        <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3 border-l-2 border-emerald-500 pl-2"><i class="fas fa-hammer mr-1 text-emerald-400"></i> Desfazer Craft</h4>
                                        
                                        <div id="recipe-warning" class="hidden mb-3"></div>

                                        <div class="space-y-1 text-[10px] font-mono mb-3">
                                            <div class="flex justify-between text-slate-400"><span>Profissão Exigida:</span> <span id="req-prof-name" class="font-bold text-amber-400">Geral</span></div>
                                            <div class="flex justify-between text-slate-400"><span>Bônus de Recuperação:</span> <span id="recycle-chance" class="font-bold text-emerald-400">0%</span></div>
                                        </div>
                                        
                                        <div class="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Materiais Devolvidos:</div>
                                        <div id="recycle-materials-list" class="grid grid-cols-2 gap-2 mb-4"></div>

                                        <button id="btn-confirmar-reciclagem" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded shadow-md transition-transform hover:scale-[1.02]">
                                            Reciclar Materiais
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            `;
            setupExtracaoListeners();
        }

        renderExtracaoGrid();

    } catch (e) {
        console.error("Erro fatal na aba de Extração:", e);
        container.innerHTML = `<div class="p-6 text-red-500 bg-red-900/20 border border-red-500/50 rounded-xl m-6 shadow-inner">
            <h3 class="font-bold uppercase tracking-widest mb-2"><i class="fas fa-exclamation-triangle"></i> Falha no Sistema</h3>
            <p class="font-mono text-xs">${e.message}</p>
        </div>`;
    }
}

export function renderExtracaoGrid() {
    const gridContainer = document.getElementById('extracao-grid');
    if (!gridContainer) return;
    
    gridContainer.innerHTML = '';
    
    // Esconde painel de detalhes por precaução
    const detalhesPanel = document.getElementById('extracao-detalhes-panel');
    const emptyState = document.getElementById('extracao-empty-state');
    if (detalhesPanel) { detalhesPanel.classList.remove('flex'); detalhesPanel.classList.add('hidden'); }
    if (emptyState) emptyState.classList.remove('hidden');
    globalState.extracao.selectedItem = null;

    const charData = globalState.selectedCharacterData;
    const mochila = charData.ficha.mochila || {};
    
    // Leitura ultra segura dos equipamentos 
    const eq1 = charData.ficha.equipamentos;
    const eq2 = charData.ficha.equipamento;
    const eqObj = (eq1 && typeof eq1 === 'object') ? eq1 : ((eq2 && typeof eq2 === 'object') ? eq2 : {});
    const equipadosIds = new Set(Object.values(eqObj).filter(Boolean));
    
    const ID_ESSENCIA_BLOQUEADA = 'JwZDdYnOtEjvJuQLaB4f';

    const itemIds = Object.keys(mochila).filter(id => !equipadosIds.has(id) && id !== ID_ESSENCIA_BLOQUEADA);
    const searchInput = document.getElementById('extracao-filtro');
    const termo = searchInput ? searchInput.value.toLowerCase() : '';

    if (itemIds.length === 0) {
        gridContainer.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-16"><i class="fas fa-box-open text-5xl mb-3 opacity-30"></i><p class="text-sm">Nenhum item elegível na mochila.</p></div>';
        return;
    }

    let hasFound = false;
    itemIds.forEach(itemId => {
        const itemInfo = globalState.cache.itens.get(itemId);
        if (!itemInfo || !itemInfo.nome) return;
        if (termo && !itemInfo.nome.toLowerCase().includes(termo)) return;

        hasFound = true;
        const qtd = mochila[itemId];
        const rankStyle = getRankColor(itemInfo.raridade || itemInfo.tierId || 'E');
        
        const el = document.createElement('div');
        el.className = `inventory-slot relative group cursor-pointer hover:-translate-y-1 transition-transform`;
        el.dataset.itemId = itemId;
        
        el.onclick = () => window.selectExtractionItem(itemId, itemInfo, qtd);

        el.innerHTML = `
            <div class="w-full aspect-square bg-slate-950 rounded-lg border-2 ${rankStyle} overflow-hidden relative shadow-md group-hover:border-sky-400 transition-all">
                <img src="${itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                <div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent"></div>
                <div class="absolute bottom-1 right-1 bg-black/90 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 shadow">x${qtd}</div>
                <div class="absolute bottom-1 left-1 w-[calc(100%-2.5rem)] text-[8.5px] font-bold text-slate-200 uppercase tracking-widest truncate drop-shadow-md">${itemInfo.nome}</div>
            </div>
        `;
        gridContainer.appendChild(el);
    });

    if (!hasFound) {
        gridContainer.innerHTML = '<div class="col-span-full text-center text-slate-500 py-10 italic">Nenhum item corresponde à busca.</div>';
    }
}

// 1. Função de Seleção (Global)
window.selectExtractionItem = function(itemId, itemInfo, qtd) {
    globalState.extracao.selectedItem = { id: itemId, info: itemInfo, qtd: qtd };
    
    document.getElementById('extracao-empty-state')?.classList.add('hidden');
    const panel = document.getElementById('extracao-detalhes-panel');
    if (panel) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    }

    // Efeito Visual de Seleção no Grid
    document.querySelectorAll('#extracao-grid .inventory-slot > div').forEach(el => el.classList.remove('ring-4', 'ring-sky-500/50', 'border-sky-400'));
    const clickedSlot = document.querySelector(`.inventory-slot[data-item-id="${itemId}"] > div`);
    if(clickedSlot) clickedSlot.classList.add('ring-4', 'ring-sky-500/50', 'border-sky-400');

    // Preenche dados visuais
    const imgEl = document.getElementById('ext-img');
    const nomeEl = document.getElementById('ext-nome');
    const tipoEl = document.getElementById('ext-tipo');
    const qtdEl = document.getElementById('ext-qtd');

    if(imgEl) imgEl.src = itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL;
    if(nomeEl) nomeEl.textContent = itemInfo.nome;
    
    const tiposMap = globalState.cache.tiposItens;
    const tipo = tiposMap ? tiposMap.get(itemInfo.slot_equipavel_id || itemInfo.tipoId) : null;
    if(tipoEl) tipoEl.textContent = tipo ? tipo.nome : 'Equipamento / Material';
    
    if(qtdEl) qtdEl.innerHTML = `Qtd em Mãos: <span class="font-bold text-white">${qtd}</span>`;

    // Achar a Receita
    const idParaBuscar = itemInfo.itemBaseId || itemId;
    let recipe = null;
    
    const receitasMap = globalState.cache.receitas || new Map();
    for (const [rId, rec] of receitasMap.entries()) {
        if (rec.itemId === idParaBuscar) {
            recipe = rec;
            break;
        }
    }
    
    globalState.extracao.recipe = recipe;

    calculateEssenceValues(itemInfo, recipe);
    checkRecycleAvailability(recipe);
};

// 2. Cálculo de Essência
function calculateEssenceValues(itemInfo, recipe) {
    const char = globalState.selectedCharacterData.ficha;
    const itemBaseVal = itemInfo.valorEssencias || 0;
    
    let skillLevel = 0;
    let profLevel = 0;

    if (recipe) {
        if (recipe.profissaoId) {
            if (char.profissoes && char.profissoes[recipe.profissaoId]) {
                profLevel = char.profissoes[recipe.profissaoId].nivel || 0;
            }
        } else {
            profLevel = 1;
        }

        if (recipe.habilidadeId && char.habilidades && char.habilidades[recipe.habilidadeId]) {
            skillLevel = char.habilidades[recipe.habilidadeId].nivel || 0;
        }
    }

    const bonus = skillLevel * profLevel;
    const total = itemBaseVal + bonus;

    const elBase = document.getElementById('ext-val-base');
    const elBonus = document.getElementById('ext-val-bonus');
    const elTotal = document.getElementById('ext-val-total');
    
    if(elBase) elBase.textContent = itemBaseVal;
    
    if (elBonus) {
        if (bonus > 0) {
            elBonus.textContent = `+${bonus} (Skl ${skillLevel} x Prof ${profLevel})`;
            elBonus.className = "font-bold text-sky-400";
        } else {
            elBonus.textContent = "+0";
            elBonus.className = "font-bold text-slate-500";
        }
    }

    if(elTotal) elTotal.textContent = total;

    const btnExt = document.getElementById('btn-confirmar-extracao');
    if (btnExt) {
        if (total <= 0) {
            btnExt.disabled = true;
            btnExt.innerHTML = `<i class="fas fa-ban mr-1"></i> Item sem valor`;
            btnExt.className = "w-full bg-slate-800 text-slate-500 font-bold uppercase tracking-widest text-[10px] py-3 rounded cursor-not-allowed";
        } else {
            btnExt.disabled = false;
            btnExt.innerHTML = `<i class="fas fa-magic mr-1"></i> Extrair Essências`;
            btnExt.className = "w-full bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded shadow-md transition-transform hover:scale-[1.02]";
            btnExt.onclick = () => performExtraction(total);
        }
    }
}

function checkRecycleAvailability(recipe) {
    const panel = document.getElementById('panel-desfazer-craft');
    const btn = document.getElementById('btn-confirmar-reciclagem');
    const list = document.getElementById('recycle-materials-list');
    const warning = document.getElementById('recipe-warning');
    const reqProfNameEl = document.getElementById('req-prof-name');
    const chanceEl = document.getElementById('recycle-chance');

    if (!panel || !btn || !list) return;

    panel.classList.remove('hidden');   
    panel.classList.add('opacity-50');  
    btn.disabled = true;                
    btn.className = "w-full bg-slate-800 text-slate-500 font-bold uppercase tracking-widest text-[10px] py-3 rounded cursor-not-allowed mt-2";
    list.innerHTML = '';
    if(warning) warning.classList.add('hidden');

    if (!recipe) {
        list.innerHTML = '<span class="text-slate-500 text-[10px] italic col-span-2">Este item não possui receita conhecida no mundo.</span>';
        if(reqProfNameEl) reqProfNameEl.textContent = "---";
        if(chanceEl) chanceEl.textContent = "0%";
        return;
    }

    const char = globalState.selectedCharacterData.ficha;
    const profIdRequerida = recipe.profissaoId;
    
    const profInfo = globalState.cache.profissoes.get(profIdRequerida);
    const profNome = profInfo ? profInfo.nome : (profIdRequerida || 'Geral');
    if(reqProfNameEl) reqProfNameEl.textContent = profNome;

    let hasProfession = false;
    if (!profIdRequerida) hasProfession = true;
    else if (char.profissoes && char.profissoes[profIdRequerida]) hasProfession = true;

    if (!hasProfession && !globalState.isAdmin) {
        if(warning) {
            warning.classList.remove('hidden'); 
            warning.innerHTML = `
                <div class="p-2 bg-red-900/20 border border-red-800/50 rounded-lg text-center shadow-inner">
                    <p class="text-red-500 text-[10px] font-bold uppercase tracking-widest"><i class="fas fa-lock"></i> Conhecimento Insuficiente</p>
                </div>
            `;
        }
        return; 
    }

    panel.classList.remove('opacity-50');
    btn.disabled = false;
    btn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded shadow-md transition-transform hover:scale-[1.02] mt-2";

    let profLvl = (profIdRequerida && char.profissoes && char.profissoes[profIdRequerida]) ? char.profissoes[profIdRequerida].nivel : 1;
    let skillLvl = (recipe.habilidadeId && char.habilidades && char.habilidades[recipe.habilidadeId]) ? char.habilidades[recipe.habilidadeId].nivel : 0;
    
    const bonusPct = profLvl * skillLvl;
    if(chanceEl) chanceEl.textContent = `+${bonusPct}%`;

    if (recipe.materiais) {
        recipe.materiais.forEach(mat => {
            const matInfo = globalState.cache.itens.get(mat.itemId);
            const el = document.createElement('div');
            el.className = "flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700 shadow-sm";
            el.innerHTML = `
                <img src="${matInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 rounded bg-black object-contain border border-slate-800 shrink-0">
                <span class="text-[9px] text-slate-300 font-bold uppercase truncate leading-tight">${matInfo?.nome || '???'} <br><span class="text-emerald-400 font-mono">x${mat.quantidade}</span></span>
            `;
            list.appendChild(el);
        });
    }

    btn.onclick = () => performDecraft(bonusPct);
}

async function performExtraction(amount) {
    if(!confirm(`O item será destruído permanentemente.\n\nVocê receberá: ${amount} Essências Mágicas.\nConfirmar extração?`)) return;

    const charId = globalState.selectedCharacterId;
    const itemId = globalState.extracao.selectedItem.id;
    const ESSENCE_ID = 'JwZDdYnOtEjvJuQLaB4f'; 

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            if (!sf.exists()) throw new Error("Ficha não existe");

            const currentMochila = sf.data().mochila || {};
            if (!currentMochila[itemId] || currentMochila[itemId] < 1) throw new Error("Item não existe mais na mochila");
            
            const newQtdItem = currentMochila[itemId] - 1;
            if (newQtdItem <= 0) delete currentMochila[itemId];
            else currentMochila[itemId] = newQtdItem;

            const currentEssence = currentMochila[ESSENCE_ID] || 0;
            currentMochila[ESSENCE_ID] = currentEssence + amount;

            t.update(charRef, { mochila: currentMochila });
        });

        alert("✨ Extração concluída com sucesso! Essências adicionadas à sua mochila.");
        renderExtracaoGrid();
    } catch (e) {
        console.error(e);
        alert("Erro na extração: " + e.message);
    }
}

async function performDecraft(bonusPct) {
    if(!confirm(`O item será destruído e você recuperará parte dos materiais base.\nConfirmar reciclagem?`)) return;

    const charId = globalState.selectedCharacterId;
    const itemId = globalState.extracao.selectedItem.id;
    const recipe = globalState.extracao.recipe;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            const data = sf.data();
            const currentMochila = data.mochila || {};

            if (!currentMochila[itemId] || currentMochila[itemId] < 1) throw new Error("Item não existe mais na mochila");
            const newQtd = currentMochila[itemId] - 1;
            if (newQtd <= 0) delete currentMochila[itemId];
            else currentMochila[itemId] = newQtd;

            recipe.materiais.forEach(mat => {
                let qtdBase = mat.quantidade;
                let extra = Math.floor(qtdBase * (bonusPct / 100));
                let finalQtd = qtdBase + extra;

                const have = currentMochila[mat.itemId] || 0;
                currentMochila[mat.itemId] = have + finalQtd;
            });

            t.update(charRef, { mochila: currentMochila });
        });
        
        alert("♻️ Item desmanchado com sucesso! Materiais devolvidos à sua mochila.");
        renderExtracaoGrid();
    } catch (e) {
        console.error(e);
        alert("Erro ao reciclar: " + e.message);
    }
}

export function setupExtracaoListeners() {
    const searchInput = document.getElementById('extracao-filtro');
    if (searchInput) {
        // Ao digitar, recarrega apenas o Grid, para não destruir a tela e o usuário não perder o foco de onde está digitando!
        searchInput.oninput = () => {
            renderExtracaoGrid();
        };
    }
}