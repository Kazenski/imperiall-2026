import { db, doc, runTransaction } from '../core/firebase.js';
import { globalState, CURRENCY_ID, RESET_ID } from '../core/state.js';

export function renderConstelacaoTab() {
    try {
        const container = document.getElementById('constelacao-content');
        if (!container) return;

        const data = globalState.selectedCharacterData;
        if (!data || !data.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        // Inicializa o estado de controle da câmera se não existir
        if (!globalState.constelacao) {
            globalState.constelacao = { transform: { x: 0, y: 0, scale: 1 }, isDragging: false, startPos: { x: 0, y: 0 } };
        }

        // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
        if (!document.getElementById('constelacao-layout-wrapper')) {
            container.innerHTML = `
                <div id="constelacao-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                    
                    <div class="flex-1 flex flex-col min-w-0 h-full relative">
                        
                        <div class="flex justify-between items-center mb-4 shrink-0 z-10 relative">
                            <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-star mr-3 text-slate-600"></i> Constelação</h2>
                            <div class="flex gap-2">
                                <button id="const-zoom-out" class="bg-slate-800 hover:bg-slate-700 text-slate-300 w-8 h-8 rounded border border-slate-600 shadow transition-colors flex items-center justify-center"><i class="fas fa-search-minus"></i></button>
                                <button id="const-zoom-in" class="bg-slate-800 hover:bg-slate-700 text-slate-300 w-8 h-8 rounded border border-slate-600 shadow transition-colors flex items-center justify-center"><i class="fas fa-search-plus"></i></button>
                            </div>
                        </div>
                        
                        <div id="canvas-wrapper" class="flex-1 bg-[#020617] border border-slate-700 rounded-xl overflow-hidden relative shadow-inner cursor-grab select-none" style="background-image: radial-gradient(circle at center, #0f172a 0%, #020617 100%);">
                            
                            <div id="constellation-layer" class="absolute top-1/2 left-1/2 origin-center transition-transform duration-75" style="width: 800px; height: 800px; transform: translate(-50%, -50%) scale(1);">
                                <svg id="connections-svg" class="w-full h-full absolute inset-0 pointer-events-none z-0"></svg>
                                <div id="nodes-container" class="w-full h-full absolute inset-0 z-10"></div>
                            </div>
                            <div id="constellation-tooltip" class="absolute hidden bg-slate-900/95 backdrop-blur border border-amber-500/50 rounded-lg p-3 shadow-2xl z-50 pointer-events-none min-w-[200px] transition-opacity"></div>
                        </div>
                    </div>

                    <div class="w-80 shrink-0 flex flex-col h-full pt-12 gap-4">
                        
                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl text-center flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
                            <div class="absolute -right-4 -bottom-4 text-7xl text-sky-500 opacity-5"><i class="fas fa-gem"></i></div>
                            <div class="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 relative z-10">Orbes de Poder</div>
                            <div class="text-4xl font-bold font-cinzel text-sky-400 flex items-center justify-center gap-3 relative z-10">
                                <i class="fas fa-gem text-sky-500/50 text-2xl"></i>
                                <span id="const-currency-display" class="drop-shadow-md">0</span>
                            </div>
                        </div>

                        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl shrink-0">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold"><i class="fas fa-chart-line mr-1 text-amber-500"></i> Despertar</h4>
                                <span id="const-progress-text" class="text-amber-400 font-bold text-xs font-mono">0%</span>
                            </div>
                            <div class="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-700 shadow-inner">
                                <div id="const-progress-bar" class="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-500 shadow-[0_0_10px_orange]" style="width: 0%"></div>
                            </div>
                        </div>

                        <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col flex-1 min-h-0">
                            <div class="p-3 border-b border-slate-700 shrink-0 bg-slate-900/30">
                                <h4 class="text-[10px] text-slate-400 uppercase tracking-widest font-bold"><i class="fas fa-bolt mr-1 text-sky-400"></i> Efeitos Adquiridos</h4>
                            </div>
                            <div id="const-bonuses-list" class="flex-1 overflow-y-auto custom-scroll p-3 space-y-1.5 bg-slate-900/10"></div>
                        </div>

                        <button id="btn-const-reset" class="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all shadow-md shrink-0">
                            <i class="fas fa-undo-alt mr-1"></i> Resetar Constelação
                        </button>
                    </div>

                </div>
            `;
            
            setupConstelacaoListeners();
        }

        // 2. Atualizar Dados
        const orbes = data.ficha.mochila?.[CURRENCY_ID] || 0;
        const currencyDisplay = document.getElementById('const-currency-display');
        if(currencyDisplay) currencyDisplay.textContent = orbes;

        renderConstellationBonuses(data);
        renderConstellationCanvas(data);

    } catch (error) {
        console.error("Erro na constelação:", error);
        const container = document.getElementById('constelacao-content');
        if (container) {
            container.innerHTML = `<div class="flex h-full items-center justify-center text-red-500 italic p-6 text-center border border-red-900/50 bg-red-900/10 rounded-xl m-6">Erro ao renderizar constelação.<br><br>Detalhes: ${error.message}</div>`;
        }
    }
}

function renderConstellationBonuses(data) {
    const unlocked = new Set(data.ficha.constelacao_unlocked || []);
    const template = data.constellationTemplate;
    const bonuses = {};

    if (template && template.nodes) {
        template.nodes.forEach(n => {
            if (unlocked.has(n.id) && n.data && n.data.bonuses) {
                for (let [k, v] of Object.entries(n.data.bonuses)) {
                    if (bonuses[k] !== undefined) bonuses[k] += v;
                    else bonuses[k] = v;
                }
            }
        });
    }

    const list = document.getElementById('const-bonuses-list');
    if(!list) return;
    
    list.innerHTML = '';
    let hasBonus = false;
    
    for (let [k, v] of Object.entries(bonuses)) {
        if (v !== 0) {
            hasBonus = true;
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center bg-slate-900 border border-slate-700 px-3 py-1.5 rounded shadow-sm';
            row.innerHTML = `<span class="uppercase font-bold text-[10px] text-slate-400">${k}</span> <span class="text-amber-400 font-bold font-mono">+${v}</span>`;
            list.appendChild(row);
        }
    }
    if (!hasBonus) list.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-600"><i class="fas fa-moon text-3xl mb-2 opacity-20"></i><p class="text-[10px] uppercase tracking-widest font-bold">Nenhum poder ativo</p></div>';

    const totalNodes = template?.nodes?.length || 1;
    const pct = Math.round((unlocked.size / totalNodes) * 100);
    const progressBar = document.getElementById('const-progress-bar');
    const progressText = document.getElementById('const-progress-text');
    
    if(progressBar) progressBar.style.width = `${pct}%`;
    if(progressText) progressText.textContent = `${pct}%`;
}

function renderConstellationCanvas(data) {
    const container = document.getElementById('nodes-container');
    const svg = document.getElementById('connections-svg');
    const layer = document.getElementById('constellation-layer');
    const template = data.constellationTemplate;

    if(!container || !svg || !layer) return;

    updateConstellationTransform();
    
    container.innerHTML = '';
    svg.innerHTML = '';

    if (!template || !template.nodes || template.nodes.length === 0) {
        container.innerHTML = '<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-slate-500"><i class="fas fa-space-shuttle text-5xl mb-4 opacity-30"></i><p class="uppercase font-bold tracking-widest text-xs">Esta classe não possui constelação</p></div>';
        return;
    }

    const unlockedIds = new Set(data.ficha.constelacao_unlocked || []);
    const nodes = template.nodes || [];
    const drawn = new Set();

    // Desenhar Linhas
    nodes.forEach(node => {
        if (!node.connections) return;
        node.connections.forEach(targetId => {
            const key = [node.id, targetId].sort().join('-');
            if (drawn.has(key)) return;
            const target = nodes.find(n => n.id === targetId);
            if (target) {
                const active = unlockedIds.has(node.id) && unlockedIds.has(targetId);
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                
                // CORREÇÃO: Restaurada a porcentagem (%)
                line.setAttribute("x1", `${node.x}%`); 
                line.setAttribute("y1", `${node.y}%`);
                line.setAttribute("x2", `${target.x}%`); 
                line.setAttribute("y2", `${target.y}%`);
                line.setAttribute("class", `c-line ${active ? 'active' : ''}`);
                
                svg.appendChild(line);
                drawn.add(key);
            }
        });
    });

    // Desenhar Nós
    nodes.forEach(node => {
        const el = document.createElement('div');
        const isUnlocked = unlockedIds.has(node.id);
        const isNeighbor = node.connections && node.connections.some(id => unlockedIds.has(id));
        const isStart = (node.id === 0);
        const isAccessible = !isUnlocked && (isStart || isNeighbor);
        const customColor = (node.data && node.data.color) ? node.data.color : "#0ea5e9"; 

        el.className = `c-node ${isUnlocked ? 'unlocked' : ''} ${isAccessible ? 'accessible' : ''} ${(!isUnlocked && !isAccessible) ? 'locked' : ''}`;
        
        // CORREÇÃO: Restaurada a porcentagem (%)
        el.style.left = `${node.x}%`; 
        el.style.top = `${node.y}%`;
        
        if (isAccessible) el.style.borderColor = customColor;

        if (isUnlocked) el.innerHTML = '<i class="fas fa-check"></i>';
        else if (isAccessible) el.innerHTML = `<span class="text-xs">${node.data?.cost || 0}</span>`;
        else el.innerHTML = '<i class="fas fa-lock text-[10px]"></i>';

        el.onmouseenter = (e) => showConstellationTooltip(e, node, isAccessible, isUnlocked);
        el.onmouseleave = () => {
            const tooltip = document.getElementById('constellation-tooltip');
            if(tooltip) tooltip.style.display = 'none';
        };
        
        if (isAccessible) {
            el.onclick = (e) => {
                e.stopPropagation(); 
                buyConstellationNode(node);
            };
        }
        container.appendChild(el);
    });
}

function updateConstellationTransform() {
    const layer = document.getElementById('constellation-layer');
    if(!layer || !globalState.constelacao) return;
    const t = globalState.constelacao.transform;
    layer.style.transform = `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px)) scale(${t.scale})`;
}

function showConstellationTooltip(e, node, accessible, unlocked) {
    const t = document.getElementById('constellation-tooltip');
    const wrapper = document.getElementById('canvas-wrapper');
    if(!t || !wrapper) return;

    t.style.display = 'block';
    
    const rect = wrapper.getBoundingClientRect();
    let x = e.clientX - rect.left + 20;
    let y = e.clientY - rect.top + 20;
    
    t.style.left = x + 'px'; 
    t.style.top = y + 'px';

    let bonusHtml = '';
    if (node.data && node.data.bonuses) {
        for (let [k, v] of Object.entries(node.data.bonuses)) {
            if (v !== 0) bonusHtml += `<div class="text-sky-400 text-[10px] font-bold font-mono">+${v} ${k.toUpperCase()}</div>`;
        }
    }
    const status = unlocked ? '<span class="text-emerald-400">DESBLOQUEADO</span>' : (accessible ? '<span class="text-amber-400 animate-pulse">DISPONÍVEL</span>' : '<span class="text-slate-500">BLOQUEADO</span>');
    
    t.innerHTML = `
        <h4 class="text-amber-400 font-cinzel text-xs font-bold border-b border-slate-700 pb-1.5 mb-2">${node.data?.title || 'Nó Desconhecido'}</h4>
        <div class="mb-3 space-y-0.5">${bonusHtml || '<span class="text-slate-500 text-[9px] italic">Nenhum bônus de status</span>'}</div>
        <div class="flex justify-between items-center text-[10px] border-t border-slate-700 pt-2 gap-4">
            <span class="text-slate-400 font-bold">Custo: <span class="text-sky-400">${node.data?.cost || 0} Orbes</span></span>
            <span class="font-bold tracking-wider">${status}</span>
        </div>
    `;
}

async function buyConstellationNode(node) {
    const charId = globalState.selectedCharacterId;
    const data = globalState.selectedCharacterData.ficha;
    const cost = (node.data && node.data.cost) ? node.data.cost : 0;
    const current = data.mochila?.[CURRENCY_ID] || 0;

    if (current < cost) return alert(`Orbes insuficientes.\n\nCusto: ${cost} Orbes\nVocê possui: ${current} Orbes`);
    if (!confirm(`Despertar "${node.data?.title || 'este nó'}" requer ${cost} Orbes de Poder. Continuar?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            if (!sf.exists()) throw "Ficha não existe!";
            
            const d = sf.data();
            const money = d.mochila?.[CURRENCY_ID] || 0;
            
            if (money < cost) throw "Saldo insuficiente no servidor.";

            const newMochila = { ...d.mochila };
            newMochila[CURRENCY_ID] = money - cost;
            if (newMochila[CURRENCY_ID] <= 0) delete newMochila[CURRENCY_ID];

            const unlocked = [...(d.constelacao_unlocked || []), node.id];
            
            t.update(ref, { 
                mochila: newMochila, 
                constelacao_unlocked: unlocked 
            });
        });
        
        renderConstelacaoTab();
        
    } catch (e) {
        console.error(e);
        alert("Erro ao despertar estrela: " + (e.message || e));
    }
}

export function setupConstelacaoListeners() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!canvasWrapper) return;
    
    canvasWrapper.onmousedown = null;
    window.onmousemove = null;
    window.onmouseup = null;

    canvasWrapper.onmousedown = (e) => {
        if (e.target.closest('.c-node')) return; 
        globalState.constelacao.isDragging = true;
        globalState.constelacao.startPos = { 
            x: e.clientX - globalState.constelacao.transform.x, 
            y: e.clientY - globalState.constelacao.transform.y 
        };
        canvasWrapper.classList.replace('cursor-grab', 'cursor-grabbing');
    };

    window.onmousemove = (e) => {
        if (!globalState.constelacao?.isDragging) return;
        e.preventDefault();
        globalState.constelacao.transform.x = e.clientX - globalState.constelacao.startPos.x;
        globalState.constelacao.transform.y = e.clientY - globalState.constelacao.startPos.y;
        updateConstellationTransform();
    };

    window.onmouseup = () => {
        if(globalState.constelacao) globalState.constelacao.isDragging = false;
        if(canvasWrapper) canvasWrapper.classList.replace('cursor-grabbing', 'cursor-grab');
    };

    document.getElementById('const-zoom-in')?.addEventListener('click', () => {
        if(globalState.constelacao) {
            globalState.constelacao.transform.scale = Math.min(globalState.constelacao.transform.scale * 1.2, 3);
            updateConstellationTransform();
        }
    });

    document.getElementById('const-zoom-out')?.addEventListener('click', () => {
        if(globalState.constelacao) {
            globalState.constelacao.transform.scale = Math.max(globalState.constelacao.transform.scale * 0.8, 0.4);
            updateConstellationTransform();
        }
    });

    document.getElementById('btn-const-reset')?.addEventListener('click', async () => {
        const charId = globalState.selectedCharacterId;
        const qtd = globalState.selectedCharacterData?.ficha?.mochila?.[RESET_ID] || 0;
        
        if (qtd < 1) return alert("Você precisa do item 'Lágrima do Destino' na mochila para resetar sua constelação.");
        if (!confirm("ATENÇÃO: Sua constelação será zerada! Os Orbes gastos NÃO serão devolvidos. Você usará 1 Lágrima do Destino. Continuar?")) return;

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "rpg_fichas", charId);
                const sf = await t.get(ref);
                const d = sf.data();
                
                const newMochila = { ...d.mochila };
                newMochila[RESET_ID] = (d.mochila[RESET_ID] || 0) - 1;
                if (newMochila[RESET_ID] <= 0) delete newMochila[RESET_ID];

                t.update(ref, { constelacao_unlocked: [], mochila: newMochila });
            });
            
            globalState.constelacao.transform = { x: 0, y: 0, scale: 1 };
            updateConstellationTransform();
            
            alert("Constelação resetada com sucesso.");
            renderConstelacaoTab();
            
        } catch (e) {
            console.error(e);
            alert("Falha ao resetar constelação.");
        }
    });
}