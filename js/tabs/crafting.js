import { db, doc, updateDoc, runTransaction, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

let selectedCraftingProfId = 'geral'; // Estado local da sub-aba de craft

export function renderCraftingTab() {
    try {
        const container = document.getElementById('crafting-content');
        if (!container) return;

        const charData = globalState.selectedCharacterData;
        if (!charData || !charData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        // PREVENÇÃO DE ERRO: Garante que o estado do crafting exista antes de tentar ler
        if (!globalState.crafting) {
            globalState.crafting = {
                selectedRecipe: null,
                step: 'prepare',
                rollResult: 0,
                quality: 0,
                finalChance: 0
            };
        }

        const ficha = charData.ficha;
        const profissoes = ficha.profissoes || {};

        // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
        if (!document.getElementById('crafting-layout-wrapper')) {
            container.innerHTML = `
                <div id="crafting-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                    
                    <div class="flex-1 flex flex-col min-w-0 h-full">
                        
                        <div class="flex justify-between items-center mb-4 shrink-0">
                            <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-hammer mr-3 text-slate-600"></i> Oficina de Criação</h2>
                        </div>

                        <div class="flex flex-col gap-3 bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm shrink-0 mb-4">
                            <div class="relative w-full">
                                <i class="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                                <input type="text" id="craft-search" placeholder="Buscar receita..." class="w-full bg-slate-900 border border-slate-600 rounded py-1.5 pl-9 pr-4 text-sm text-white focus:border-amber-500 outline-none">
                            </div>
                            <div id="craft-profession-tabs" class="flex gap-2 overflow-x-auto hide-scroll pb-1">
                                </div>
                        </div>
                        
                        <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                            <div id="craft-recipe-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start"></div>
                        </div>
                    </div>

                    <div class="w-80 md:w-96 shrink-0 flex flex-col h-full pt-12">
                        <div id="craft-bench-panel" class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden">
                            </div>
                    </div>

                </div>
            `;
            
            setupCraftingListeners();
        }

        // 2. Renderiza Abas de Profissões (Horizontal)
        const tabsContainer = document.getElementById('craft-profession-tabs');
        if (tabsContainer) {
            let tabsHtml = `
                <button onclick="window.switchCraftProf('geral')" 
                    class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${selectedCraftingProfId === 'geral' ? 'bg-amber-600 text-black font-bold border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}">
                    <i class="fas fa-globe mr-1"></i> Geral
                </button>
            `;

            Object.keys(profissoes).forEach(profId => {
                const profInfo = globalState.cache.profissoes.get(profId);
                const level = profissoes[profId].nivel || 1;
                const nome = profInfo ? profInfo.nome : 'Profissão';
                
                tabsHtml += `
                    <button onclick="window.switchCraftProf('${profId}')" 
                        class="px-4 py-2 rounded border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${selectedCraftingProfId === profId ? 'bg-amber-600 text-black font-bold border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}">
                        <span>${nome}</span>
                        <span class="bg-black/30 px-1.5 py-0.5 rounded text-[9px]">Lv.${level}</span>
                    </button>
                `;
            });

            tabsContainer.innerHTML = tabsHtml;
        }

        // 3. Atualiza Lista de Receitas
        const searchInput = document.getElementById('craft-search');
        const searchTerm = searchInput ? searchInput.value : '';
        const recipeContainer = document.getElementById('craft-recipe-list');
        if (recipeContainer) renderRecipeList(recipeContainer, searchTerm);
        
        // Atualiza a bancada
        renderWorkbench();

    } catch (error) {
        console.error("Erro na aba de Oficina de Criação:", error);
        const container = document.getElementById('crafting-content');
        if (container) {
            container.innerHTML = `<div class="flex h-full items-center justify-center text-red-500 italic p-6 text-center border border-red-900/50 bg-red-900/10 rounded-xl m-6">Erro ao carregar Oficina de Criação.<br><br>Detalhes: ${error.message}</div>`;
        }
    }
}

window.switchCraftProf = function(profId) {
    selectedCraftingProfId = profId;
    if (!globalState.crafting) globalState.crafting = {};
    globalState.crafting.selectedRecipe = null;
    globalState.crafting.step = 'prepare';
    renderCraftingTab();
};

function renderRecipeList(container, filter = '') {
    container.innerHTML = '';
    const term = filter.toLowerCase();

    const receitasMap = globalState.cache.receitas || new Map();

    const recipes = [...receitasMap.values()].filter(r => {
        const nameMatch = (r.nome || '').toLowerCase().includes(term);
        const profMatch = selectedCraftingProfId === 'geral' 
            ? (!r.profissaoId || r.profissaoId === "") 
            : (r.profissaoId === selectedCraftingProfId);
            
        return nameMatch && profMatch;
    }).sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));

    if (recipes.length === 0) {
        container.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-12"><i class="fas fa-hammer text-4xl mb-3 opacity-30"></i><p class="text-xs uppercase tracking-widest font-bold">Nenhuma receita encontrada</p></div>';
        return;
    }

    recipes.forEach(rec => {
        const itemInfo = globalState.cache.itens.get(rec.itemId);
        const isSelected = globalState.crafting.selectedRecipe?.id === rec.id;
        
        const el = document.createElement('div');
        el.className = `bg-slate-950 border ${isSelected ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] ring-1 ring-amber-500/50' : 'border-slate-700 hover:border-slate-500'} rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all group`;
        
        el.innerHTML = `
            <div class="w-12 h-12 rounded bg-black border border-slate-800 shrink-0 overflow-hidden relative">
                <img src="${itemInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
            </div>
            <div class="flex-grow min-w-0">
                <h4 class="text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-slate-300'} truncate uppercase tracking-wider group-hover:text-amber-400 transition-colors">${rec.nome || 'Desconhecida'}</h4>
                <div class="text-[10px] text-slate-500 font-mono mt-1">Base: <span class="text-sky-400 font-bold">${rec.chanceSucessoBase || 0}%</span></div>
            </div>
        `;
        el.onclick = () => selectRecipe(rec);
        container.appendChild(el);
    });
}

function selectRecipe(recipe) {
    globalState.crafting = {
        selectedRecipe: recipe,
        step: 'prepare',
        rollResult: 0,
        quality: 0,
        finalChance: 0
    };
    
    const recipeContainer = document.getElementById('craft-recipe-list');
    const searchInput = document.getElementById('craft-search');
    if(recipeContainer) renderRecipeList(recipeContainer, searchInput ? searchInput.value : '');
    
    renderWorkbench();
}

function renderWorkbench() {
    const bench = document.getElementById('craft-bench-panel');
    const state = globalState.crafting;
    const recipe = state.selectedRecipe;
    const charData = globalState.selectedCharacterData;

    if (!bench || !charData) return;

    // Estado Vazio
    if (!recipe) {
        bench.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                <i class="fas fa-tools text-6xl mb-4"></i>
                <p class="text-sm text-center px-6">Selecione uma receita na lista ao lado para começar a trabalhar na forja.</p>
            </div>
        `;
        return;
    }

    const itemResult = globalState.cache.itens.get(recipe.itemId);
    const mochila = charData.ficha.mochila || {};
    const profissoes = charData.ficha.profissoes || {};
    const habilidades = charData.ficha.habilidades || {};

    // 1. Verificar Materiais
    let hasAllMaterials = true;
    const recipeMaterials = recipe.materiais || [];
    
    const materialsHtml = recipeMaterials.map(mat => {
        const matInfo = globalState.cache.itens.get(mat.itemId) || { nome: 'Desconhecido', imagemUrl: '' };
        const owned = mochila[mat.itemId] || 0;
        const enough = owned >= mat.quantidade;
        if (!enough) hasAllMaterials = false;

        return `
            <div class="flex flex-col items-center bg-slate-950 border ${enough ? 'border-emerald-500/50' : 'border-red-500/50 bg-red-900/10'} rounded-lg p-2 shadow-inner">
                <img src="${matInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 mb-1 rounded bg-black object-contain border border-slate-800">
                <span class="text-[9px] truncate w-full text-center text-slate-400" title="${matInfo.nome}">${matInfo.nome}</span>
                <span class="text-[10px] font-mono font-bold mt-1 ${enough ? 'text-emerald-400' : 'text-red-400'}">${owned} / ${mat.quantidade}</span>
            </div>
        `;
    }).join('');

    // 2. Calcular Chances
    let baseChance = recipe.chanceSucessoBase || 0;
    let profBonus = 0;
    let skillBonus = 0;
    let hasReqProf = true;

    if (recipe.profissaoId) {
        const pLvl = profissoes[recipe.profissaoId]?.nivel || 0;
        if (pLvl >= (recipe.profissaoLevel || 0)) {
            profBonus = pLvl; 
        } else {
            hasReqProf = false;
        }
    }

    if (recipe.habilidadeId) {
        const hLvl = habilidades[recipe.habilidadeId]?.nivel || 1;
        const habInfo = globalState.cache.habilidades.get(recipe.habilidadeId);
        let baseEff = habInfo?.efeitoDanoBaseUsoHabilidade || 0;
        if(hLvl > 1 && habInfo?.niveis?.[hLvl]) baseEff = habInfo.niveis[hLvl].danoBaseHabilidade || baseEff;
        skillBonus = baseEff;
    }

    const finalChance = Math.max(0, Math.min(100, baseChance + profBonus + skillBonus));
    globalState.crafting.finalChance = finalChance;

    // 3. Renderizar Interface Baseada no Passo
    let actionArea = '';

    if (state.step === 'prepare') {
        const btnDisabled = !hasAllMaterials || !hasReqProf;
        const btnText = !hasReqProf ? "Profissão Insuficiente" : (!hasAllMaterials ? "Materiais Insuficientes" : "Iniciar Criação");
        
        actionArea = `
            <button id="btn-craft-start" class="w-full font-bold uppercase tracking-widest text-[10px] py-3 rounded transition-transform ${!btnDisabled ? 'bg-amber-600 hover:bg-amber-500 text-black hover:scale-[1.02] shadow-md cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}" ${btnDisabled ? 'disabled' : ''}>
                <i class="fas fa-fire mr-1"></i> ${btnText}
            </button>
        `;
    } else if (state.step === 'roll') {
        actionArea = `
            <div class="flex flex-col items-center animate-fade-in bg-slate-900 border border-slate-700 p-4 rounded-xl">
                <p class="text-[10px] uppercase font-bold text-amber-400 tracking-widest mb-3 text-center">Role o dado para a qualidade final</p>
                <button id="btn-craft-d20" class="text-5xl text-amber-500 hover:text-amber-400 transition-transform hover:rotate-[15deg] hover:scale-110 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                    <i class="fas fa-dice-d20"></i>
                </button>
            </div>
        `;
    } else if (state.step === 'confirm') {
        actionArea = `
            <div class="bg-slate-900 border border-amber-500/50 p-4 rounded-xl mb-3 animate-fade-in shadow-[0_0_15px_rgba(245,158,11,0.1)] font-mono text-[10px]">
                <div class="flex justify-between text-slate-300 mb-1"><span>Chance:</span> <span>${finalChance}%</span></div>
                <div class="flex justify-between text-amber-400 mb-2 font-bold text-xs"><span>Dado rolado:</span> <span>+${state.rollResult}</span></div>
                <div class="flex justify-between text-emerald-400 font-bold border-t border-slate-700 pt-2 mt-1 text-sm">
                    <span>Qualidade Final:</span> <span>${state.quality}%</span>
                </div>
            </div>
            <div class="flex gap-2">
                <button id="btn-craft-confirm" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded shadow-md transition-transform hover:scale-[1.02]">
                    <i class="fas fa-hammer mr-1"></i> Forjar
                </button>
                <button id="btn-craft-cancel" class="bg-red-900/40 hover:bg-red-600 text-red-500 hover:text-white font-bold uppercase text-[10px] py-3 px-4 rounded border border-red-900/50 transition-colors">
                    Cancelar
                </button>
            </div>
        `;
    } else if (state.step === 'loading') {
        actionArea = `<div class="flex justify-center items-center py-6 text-amber-500"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;
    }

    bench.innerHTML = `
        <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0 shadow-sm z-10">
            <div class="w-24 h-24 rounded-full border-2 border-amber-500 bg-black overflow-hidden mb-4 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <img src="${itemResult?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
            </div>
            <h3 class="font-cinzel text-2xl text-amber-400 text-center leading-tight mb-2 drop-shadow-md">${itemResult?.nome || recipe.nome}</h3>
            <span class="text-[9px] uppercase tracking-widest text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-700 shadow-inner">Projeto</span>
        </div>

        <div class="flex-1 overflow-y-auto custom-scroll p-6 flex flex-col gap-6 bg-slate-900/20">
            
            <div>
                <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3 border-l-2 border-slate-500 pl-2"><i class="fas fa-boxes mr-1"></i> Materiais Necessários</h4>
                <div class="grid grid-cols-3 gap-2">
                    ${materialsHtml || '<span class="text-slate-500 text-xs italic">Sem materiais.</span>'}
                </div>
            </div>

            <div class="bg-slate-950 border border-slate-700 rounded-xl p-4 shadow-inner">
                <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3"><i class="fas fa-percentage mr-1"></i> Probabilidade Base</h4>
                <div class="space-y-1 text-[10px] font-mono">
                    <div class="flex justify-between text-slate-400"><span>Dificuldade Base:</span> <span>${baseChance}%</span></div>
                    <div class="flex justify-between text-sky-400"><span>Bônus de Profissão:</span> <span>+${profBonus}%</span></div>
                    <div class="flex justify-between text-purple-400 mb-2"><span>Bônus de Habilidade:</span> <span>+${skillBonus}%</span></div>
                    <div class="flex justify-between border-t border-slate-700 pt-2 mt-2">
                        <span class="font-bold text-slate-300">Chance Total de Sucesso:</span> 
                        <span class="font-bold text-amber-400 text-sm">${finalChance}%</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            ${actionArea}
        </div>
    `;

    // Vincular Eventos
    const btnStart = document.getElementById('btn-craft-start');
    if (btnStart) btnStart.onclick = () => {
        globalState.crafting.step = 'roll';
        renderWorkbench();
    };

    const btnD20 = document.getElementById('btn-craft-d20');
    if (btnD20) btnD20.onclick = handleCraftRoll;

    const btnConfirm = document.getElementById('btn-craft-confirm');
    if (btnConfirm) btnConfirm.onclick = executeCraftTransaction;

    const btnCancel = document.getElementById('btn-craft-cancel');
    if (btnCancel) btnCancel.onclick = () => selectRecipe(recipe); 
}

function handleCraftRoll() {
    const roll = Math.floor(Math.random() * 20) + 1;
    const state = globalState.crafting;
    
    state.rollResult = roll;
    state.quality = Math.min(100, state.finalChance + roll);
    state.step = 'confirm';
    
    const btn = document.getElementById('btn-craft-d20');
    if (btn) btn.style.transform = 'rotate(360deg) scale(1.5) translateY(-10px)';
    setTimeout(() => renderWorkbench(), 500);
}

async function executeCraftTransaction() {
    globalState.crafting.step = 'loading';
    renderWorkbench();

    const recipe = globalState.crafting.selectedRecipe;
    const state = globalState.crafting;
    const charId = globalState.selectedCharacterId;
    const charData = globalState.selectedCharacterData.ficha;

    const successRoll = Math.floor(Math.random() * 100) + 1;
    const isSuccess = successRoll <= state.finalChance;

    let lossFactor = 1;
    if (!isSuccess) {
        lossFactor = (Math.floor(Math.random() * (50 - 20 + 1)) + 20) / 100;
    }

    const profLevel = charData.profissoes?.[recipe.profissaoId]?.nivel || 1;
    const qtdCriada = isSuccess ? (Math.floor(Math.random() * profLevel) + 1) : 0;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            if (!sf.exists()) throw new Error("Ficha não encontrada");

            const currentMochila = sf.data().mochila || {};
            const recipeMaterials = recipe.materiais || [];
            
            // Consumir Materiais
            for (const mat of recipeMaterials) {
                const qtdNecessaria = mat.quantidade;
                const qtdConsumir = Math.ceil(qtdNecessaria * lossFactor);
                const emMaos = currentMochila[mat.itemId] || 0;

                if (emMaos < qtdNecessaria) throw new Error(`Falta material: ${mat.itemId}`);

                const novaQtd = emMaos - qtdConsumir;
                if (novaQtd <= 0) delete currentMochila[mat.itemId]; 
                else currentMochila[mat.itemId] = novaQtd;
            }

            if (isSuccess) {
                const currentQtdItem = currentMochila[recipe.itemId] || 0;
                currentMochila[recipe.itemId] = currentQtdItem + qtdCriada;

                if (recipe.expProducao) {
                    t.update(charRef, { 
                        mochila: currentMochila,
                        experienciapersonagemBase: increment(recipe.expProducao)
                    });
                } else {
                    t.update(charRef, { mochila: currentMochila });
                }
            } else {
                t.update(charRef, { mochila: currentMochila });
            }
        });

        if (isSuccess) {
            const itemBase = globalState.cache.itens.get(recipe.itemId);
            const nomeItem = itemBase ? itemBase.nome : 'Item Desconhecido';
            
            updateDoc(doc(db, "rpg_fichas", charId), {
                [`livro_receitas.${recipe.id}.craftado`]: true
            }).catch(e => console.warn("Erro ao atualizar livro de receitas:", e));

            alert(`SUCESSO GLORIOSO!\nVocê criou: ${qtdCriada}x ${nomeItem}\n(Item adicionado à sua mochila)`);
        } else {
            alert(`FALHA CATASTRÓFICA!\nO processo falhou e você perdeu ${(lossFactor*100).toFixed(0)}% dos materiais.`);
        }

        selectRecipe(recipe);

    } catch (e) {
        console.error(e);
        alert("Erro no processo de criação: " + (e.message || e));
        globalState.crafting.step = 'confirm';
        renderWorkbench();
    }
}

export function setupCraftingListeners() {
    const searchInput = document.getElementById('craft-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const recipeContainer = document.getElementById('craft-recipe-list');
            if (recipeContainer) renderRecipeList(recipeContainer, e.target.value);
        };
    }
}