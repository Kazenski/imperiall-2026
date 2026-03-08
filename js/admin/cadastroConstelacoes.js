import { db } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ATTR_MAP = {
    atk: 'Ataque', def: 'Defesa', eva: 'Evasão', hp: 'HP Max', mp: 'MP Max',
    iniciativa: 'Iniciativa', movimento: 'Movimento', ap: 'AP', critico: 'Crítico'
};

let cState = {
    currentClassId: null,
    nodes: [], 
    selectedNodeIds: new Set(),
    isLinking: false,
    linkStartNodeId: null,
    zoom: 1,
    classes: [],
    isDragging: false,
    dragData: null
};

export async function renderCadastroConstelacoesTab() {
    const container = document.getElementById('cadastro-constelacoes-content');
    if (!container) return;

    // A injeção direta de estilo garante que a constelação mantenha a proporção 800x800 original,
    // preservando a posição exata de X e Y (em %) salvas no Firebase.
    container.innerHTML = `
        <style>
            #constellation-layer {
                position: absolute; top: 50%; left: 50%;
                width: 800px; height: 800px;
                transform: translate(-50%, -50%);
                border: 1px dashed #334155;
                border-radius: 8px;
                box-shadow: 0 0 50px rgba(0,0,0,0.5);
            }
            .node-point {
                position: absolute; width: 28px; height: 28px; border-radius: 50%;
                border: 2px solid var(--destaque, #0ea5e9);
                transform: translate(-50%, -50%);
                cursor: pointer; z-index: 10;
                transition: transform 0.2s, box-shadow 0.2s;
                display: flex; align-items: center; justify-content: center;
                color: white; font-size: 10px; font-weight: bold;
                box-shadow: 0 0 10px rgba(14, 165, 233, 0.5);
                user-select: none;
            }
            .node-point:hover { transform: translate(-50%, -50%) scale(1.2); z-index: 15; box-shadow: 0 0 15px var(--destaque, #0ea5e9); }
            .node-point.selected {
                border-color: white !important;
                box-shadow: 0 0 20px var(--destaque, #0ea5e9), inset 0 0 10px var(--destaque, #0ea5e9) !important;
                transform: translate(-50%, -50%) scale(1.3);
                z-index: 20; color: #fff; text-shadow: 0 0 2px black;
            }
            .node-point.start-node { border: 2px solid #fbbf24 !important; box-shadow: 0 0 15px #fbbf24 !important; }
            .connection-line { stroke: #334155; stroke-width: 2; transition: all 0.3s; }
            
            .attr-row-grid { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
            .attr-row-grid label { font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; min-width: 70px; font-weight: bold; }
            .attr-row-grid input { width: 100%; padding: 2px 6px; text-align: center; height: 24px; font-size: 0.8rem; background-color: #1e293b; border: 1px solid #334155; color: white; border-radius: 4px; outline: none; }
            .attr-row-grid input:focus { border-color: #0ea5e9; }
            
            @keyframes flashSuccess { 0% { background-color: #10b981; } 100% { background-color: #0ea5e9; } }
            .flash-success { animation: flashSuccess 0.5s ease-out; }
            
            .constellation-canvas-bg {
                background-color: #020617;
                background-image: linear-gradient(rgba(30, 41, 59, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.3) 1px, transparent 1px);
                background-size: 40px 40px;
            }
        </style>
        
        <div class="w-full h-full fade-in flex flex-col bg-slate-950 overflow-hidden relative">
            <header class="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-40 shrink-0 shadow-lg">
                <div class="flex items-center gap-4">
                    <h1 class="font-cinzel text-xl text-sky-400 flex items-center gap-2 font-bold tracking-widest"><i class="fas fa-star text-sky-600"></i> Matriz de Estrelas</h1>
                    <div class="h-8 w-px bg-slate-800 mx-2"></div>
                    <div class="flex flex-col">
                        <label class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Vincular a uma Classe</label>
                        <div class="flex gap-2">
                            <select id="const-class-select" onchange="window.constTools.loadConstellation()" class="w-48 py-1 px-2 text-sm bg-slate-800 border border-slate-700 rounded focus:border-sky-500 text-sky-100 outline-none cursor-pointer">
                                <option value="">-- Carregando Classes --</option>
                            </select>
                            <button id="btn-load-class" onclick="window.constTools.loadConstellation()" class="bg-sky-900 hover:bg-sky-700 text-sky-200 px-3 rounded text-xs border border-sky-800 transition" title="Atualizar Mapa"><i class="fas fa-sync-alt"></i></button>
                            <button onclick="window.constTools.newClass()" class="bg-emerald-900 hover:bg-emerald-700 text-emerald-200 px-3 rounded text-xs border border-emerald-800 transition" title="Nova Classe"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                     <button onclick="window.constTools.duplicate()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded text-sm border border-slate-700 flex items-center gap-2 transition">
                        <i class="fas fa-copy"></i> Clonar Molde
                    </button>
                    <button onclick="window.constTools.save()" id="btn-save-const" class="bg-sky-600 hover:bg-sky-500 text-white px-6 py-1.5 rounded text-sm font-bold shadow-[0_0_10px_rgba(14,165,233,0.5)] flex items-center gap-2 transition">
                        <i class="fas fa-save"></i> Gravar Diagrama
                    </button>
                </div>
            </header>

            <div class="flex flex-1 overflow-hidden relative">
                
                <aside class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col p-4 z-20 shadow-[4px_0_20px_rgba(0,0,0,0.6)] overflow-y-auto custom-scroll">
                    <div class="border-b border-slate-800 pb-4 mb-4">
                        <h3 class="font-cinzel text-slate-500 mb-3 text-xs uppercase tracking-widest font-bold">Ferramentas de Criação</h3>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <button onclick="window.constTools.addNode(50,50)" class="bg-slate-800 p-2 rounded hover:bg-slate-700 text-left text-xs flex items-center gap-2 text-slate-300 border border-slate-700 transition">
                                <i class="fas fa-circle-plus text-emerald-400"></i> Criar 1 Estrela
                            </button>
                            <button id="tool-link-mode" onclick="window.constTools.toggleLinkMode()" class="bg-slate-800 p-2 rounded hover:bg-slate-700 text-left text-xs flex items-center gap-2 text-slate-300 border border-slate-700 transition">
                                <i class="fas fa-network-wired text-sky-400"></i> Traçar Rota
                            </button>
                        </div>
                        <button onclick="window.constTools.add50Nodes()" class="w-full bg-slate-800 p-2 rounded hover:bg-slate-700 text-center text-xs text-amber-400 border border-slate-700 mb-2 font-bold transition">
                            <i class="fas fa-meteor mr-1"></i> Gerar 50 Estrelas
                        </button>
                    </div>

                    <div id="node-properties" class="flex-1 hidden animate-fade-in flex-col gap-4">
                        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                            <h3 class="font-cinzel text-sky-400 text-sm uppercase flex items-center gap-2 font-bold"><i class="fas fa-cog"></i> <span id="prop-header-text">Propriedades</span></h3>
                            <span id="selection-count" class="text-[9px] font-bold tracking-wider bg-sky-900 text-sky-200 px-2 py-0.5 rounded-full">1 Sel.</span>
                        </div>

                        <button id="btn-equalize" onclick="window.constTools.equalize()" class="w-full bg-sky-600 hover:bg-sky-500 text-white py-2 text-xs font-bold uppercase tracking-widest rounded shadow-lg hidden transition">
                            <i class="fas fa-clone mr-1"></i> Igualar Selecionados
                        </button>

                        <div>
                            <label class="text-[10px] text-slate-500 mb-1 block uppercase font-bold">Título da Habilidade</label>
                            <input type="text" id="prop-title" oninput="window.constTools.updateProp('title', this.value)" class="w-full p-2 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none focus:border-sky-500">
                        </div>

                        <div class="bg-slate-800/50 p-3 rounded border border-slate-700">
                            <label class="text-[10px] text-sky-400 mb-2 block font-bold border-b border-slate-600 pb-1 uppercase tracking-widest">Bônus Concedidos</label>
                            <div id="attributes-container" class="grid grid-cols-2 gap-x-4 gap-y-1">
                                </div>
                        </div>

                        <div class="grid grid-cols-3 gap-3">
                            <div class="col-span-1">
                                <label class="text-[10px] text-slate-500 mb-1 block uppercase font-bold">Custo (Orbes)</label>
                                <input type="number" id="prop-cost" min="1" oninput="window.constTools.updateProp('cost', this.value)" class="w-full p-1 bg-slate-800 border border-slate-700 rounded text-xs text-center text-white outline-none focus:border-sky-500">
                            </div>
                            <div class="col-span-1">
                                <label class="text-[10px] text-slate-500 mb-1 block uppercase font-bold text-center">Fundo</label>
                                <input type="color" id="prop-bg-color" oninput="window.constTools.updateProp('bgColor', this.value)" class="h-6 w-full p-0 cursor-pointer border-0 rounded overflow-hidden bg-slate-800">
                            </div>
                            <div class="col-span-1">
                                <label class="text-[10px] text-slate-500 mb-1 block uppercase font-bold text-center">Neon</label>
                                <input type="color" id="prop-color" oninput="window.constTools.updateProp('color', this.value)" class="h-6 w-full p-0 cursor-pointer border-0 rounded overflow-hidden bg-slate-800">
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] text-slate-500 mb-1 block uppercase font-bold">Descrição da Estrela</label>
                            <textarea id="prop-desc" rows="3" oninput="window.constTools.updateProp('desc', this.value)" class="w-full p-2 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none focus:border-sky-500 custom-scroll"></textarea>
                        </div>

                        <div class="pt-4 border-t border-slate-800 flex gap-2 mt-auto">
                            <button onclick="window.constTools.deleteSelected()" class="bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs py-2 rounded flex-1 border border-red-900/50 transition font-bold uppercase tracking-wider">
                                <i class="fas fa-trash mr-1"></i> Apagar
                            </button>
                            <button onclick="window.constTools.unlinkSelected()" class="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs py-2 px-3 rounded border border-slate-700 transition" title="Quebrar todas as conexões">
                                <i class="fas fa-unlink"></i>
                            </button>
                        </div>
                        <p class="text-[9px] text-slate-600 text-center italic">Dica: Use SHIFT+Click para selecionar múltiplas estrelas no painel direito.</p>
                    </div>
                    
                    <div id="no-selection-msg" class="flex-1 flex flex-col gap-4 items-center justify-center text-slate-600 text-sm text-center px-6">
                        <i class="fas fa-mouse-pointer text-4xl text-slate-800"></i>
                        <p>Clique em uma estrela na constelação para edita-la.<br><br>Segure <kbd class="bg-slate-800 px-1 rounded">SHIFT</kbd> para seleção múltipla.</p>
                    </div>
                </aside>

                <main id="const-canvas-container" class="flex-1 relative constellation-canvas-bg overflow-hidden cursor-grab">
                    <div id="constellation-layer">
                        <svg id="connections-svg" class="absolute inset-0 w-full h-full pointer-events-none z-0"></svg>
                        <div id="nodes-container" class="absolute inset-0 w-full h-full"></div>
                    </div>
                    
                    <div class="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                        <button onclick="window.constTools.zoomIn()" class="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-sky-400 shadow-lg transition"><i class="fas fa-plus"></i></button>
                        <button onclick="window.constTools.zoomOut()" class="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-sky-400 shadow-lg transition"><i class="fas fa-minus"></i></button>
                    </div>
                    
                    <div id="mode-indicator" class="absolute top-6 left-1/2 -translate-x-1/2 bg-sky-500/20 border border-sky-500/50 text-sky-400 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hidden backdrop-blur-md shadow-[0_0_15px_rgba(14,165,233,0.3)] pointer-events-none">
                        Modo de Ligação Ativo (Clique nos nós)
                    </div>
                </main>
            </div>
            
            <footer class="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-4 text-xs shrink-0 z-30">
                <span class="font-cinzel text-slate-500 font-bold uppercase tracking-widest border-r border-slate-700 pr-4">Total Gasto Na Build</span>
                <div id="stats-display" class="flex flex-1 gap-2 overflow-x-auto custom-scroll items-center"></div>
                <div class="text-slate-500 font-mono ml-auto border-l border-slate-700 pl-4">
                    ESTRELAS: <span id="total-nodes-count" class="text-sky-400 font-bold ml-1">0</span>
                </div>
            </footer>
        </div>
    `;

    buildAttributeInputs();
    attachDragListeners();
    await loadClassesList();
}

function buildAttributeInputs() {
    const cont = document.getElementById('attributes-container');
    if(!cont) return;
    cont.innerHTML = '';
    for (const [key, label] of Object.entries(ATTR_MAP)) {
        cont.innerHTML += `
            <div class="attr-row-grid">
                <label>${label}</label>
                <input type="number" data-attr-key="${key}" value="0" step="0.5" oninput="window.constTools.updateBonus('${key}', this.value)">
            </div>
        `;
    }
}

async function loadClassesList() {
    const sel = document.getElementById('const-class-select');
    if(!sel) return;
    try {
        const snap = await getDocs(collection(db, "rpg_classes"));
        cState.classes = [];
        snap.forEach(d => cState.classes.push({ id: d.id, nome: d.data().nome }));
        
        sel.innerHTML = '<option value="">-- Escolha uma Classe --</option>';
        cState.classes.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => sel.add(new Option(c.nome, c.id)));
    } catch(e) { console.error(e); }
}

function renderCanvas() {
    const cont = document.getElementById('nodes-container');
    const svg = document.getElementById('connections-svg');
    if(!cont || !svg) return;

    cont.innerHTML = ''; svg.innerHTML = '';
    const drawn = new Set(); 

    cState.nodes.forEach(node => {
        node.connections.forEach(tid => {
            const key = [node.id, tid].sort().join('-');
            if(drawn.has(key)) return;
            const target = cState.nodes.find(n => n.id === tid);
            if(target) {
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", `${node.x}%`); line.setAttribute("y1", `${node.y}%`);
                line.setAttribute("x2", `${target.x}%`); line.setAttribute("y2", `${target.y}%`);
                line.setAttribute("class", "connection-line");
                svg.appendChild(line);
                drawn.add(key);
            }
        });

        const el = document.createElement('div');
        const isSelected = cState.selectedNodeIds.has(node.id);
        
        el.className = `node-point ${isSelected ? 'selected' : ''} ${node.id === 0 ? 'start-node' : ''}`;
        el.style.left = `${node.x}%`; el.style.top = `${node.y}%`;
        el.style.setProperty('--destaque', node.data.color);
        el.style.backgroundColor = node.data.bgColor || "#0f172a";
        
        el.textContent = node.id;
        el.dataset.id = node.id;
        
        let bonusTxt = "";
        if(node.data.bonuses) {
            for(const [k, v] of Object.entries(node.data.bonuses)) {
                if(v !== 0) bonusTxt += `\n${k.toUpperCase()}: +${v}`;
            }
        }
        el.title = `${node.data.title}${bonusTxt}\nCusto: ${node.data.cost}`;

        el.addEventListener('mousedown', (e) => startDrag(e, node.id));
        el.addEventListener('click', (e) => handleNodeClick(e, node.id));
        
        cont.appendChild(el);
    });
    calculateTotals();
}

function attachDragListeners() {
    const canvas = document.getElementById('const-canvas-container');
    if(!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
        if(cState.isDragging && cState.dragData) {
            const layer = document.getElementById('constellation-layer');
            const rect = layer.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
            const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
            
            cState.selectedNodeIds.forEach(id => {
                const node = cState.nodes.find(n => n.id === id);
                const off = cState.dragData.nodeOffsets[id];
                if(node && off) {
                    node.x = Math.max(0, Math.min(100, mouseX + off.dx));
                    node.y = Math.max(0, Math.min(100, mouseY + off.dy));
                }
            });
            requestAnimationFrame(renderCanvas);
        }
    });

    document.addEventListener('mouseup', () => { 
        cState.isDragging = false; 
        cState.dragData = null; 
        const cvs = document.getElementById('const-canvas-container');
        if(cvs) cvs.style.cursor = cState.isLinking ? 'crosshair' : 'grab'; 
    });
}

function startDrag(e, id) {
    if(cState.isLinking) return;
    e.stopPropagation();
    document.getElementById('const-canvas-container').style.cursor = 'grabbing';
    
    if(!e.shiftKey && !cState.selectedNodeIds.has(id)) {
        cState.selectedNodeIds.clear();
        cState.selectedNodeIds.add(id);
        updateSidebarUI();
        renderCanvas();
    }

    cState.isDragging = true;
    const rect = document.getElementById('constellation-layer').getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;
    
    const nodeOffsets = {};
    cState.selectedNodeIds.forEach(selId => {
        const n = cState.nodes.find(no => no.id === selId);
        if(n) nodeOffsets[selId] = { dx: n.x - startX, dy: n.y - startY };
    });

    cState.dragData = { startX, startY, nodeOffsets };
}

function handleNodeClick(e, id) {
    e.stopPropagation();
    if(cState.isLinking) {
        if(cState.linkStartNodeId === null) {
            cState.linkStartNodeId = id;
        } else {
            if(cState.linkStartNodeId === id) return;
            const s = cState.nodes.find(n => n.id === cState.linkStartNodeId);
            const eNode = cState.nodes.find(n => n.id === id);
            
            const idx = s.connections.indexOf(id);
            if(idx > -1) {
                s.connections.splice(idx, 1);
                const rev = eNode.connections.indexOf(s.id);
                if(rev > -1) eNode.connections.splice(rev, 1);
            } else {
                s.connections.push(id); eNode.connections.push(s.id);
            }
            cState.linkStartNodeId = null;
            renderCanvas();
        }
    } else {
        if (e.shiftKey) {
            if (cState.selectedNodeIds.has(id)) cState.selectedNodeIds.delete(id);
            else cState.selectedNodeIds.add(id);
            updateSidebarUI();
            renderCanvas();
        } else {
            if (!cState.selectedNodeIds.has(id)) {
                cState.selectedNodeIds.clear();
                cState.selectedNodeIds.add(id);
                updateSidebarUI();
                renderCanvas();
            } else {
                updateSidebarUI();
            }
        }
    }
}

function updateSidebarUI() {
    const count = cState.selectedNodeIds.size;
    const panel = document.getElementById('node-properties');
    const msg = document.getElementById('no-selection-msg');
    
    if(count === 0) {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
        msg.classList.remove('hidden');
        msg.classList.add('flex');
        return;
    }

    msg.classList.add('hidden');
    msg.classList.remove('flex');
    panel.classList.remove('hidden');
    panel.classList.add('flex');
    
    document.getElementById('selection-count').textContent = `${count} Selecionada(s)`;
    document.getElementById('prop-header-text').textContent = count > 1 ? "Edição em Massa" : `Estrela #${[...cState.selectedNodeIds][0]}`;
    
    const btnEq = document.getElementById('btn-equalize');
    if(count > 1) btnEq.classList.remove('hidden');
    else btnEq.classList.add('hidden');

    const firstId = [...cState.selectedNodeIds][cState.selectedNodeIds.size - 1]; 
    const node = cState.nodes.find(n => n.id === firstId);
    if(!node) return;

    document.getElementById('prop-title').value = node.data.title;
    document.getElementById('prop-cost').value = node.data.cost;
    document.getElementById('prop-color').value = node.data.color;
    document.getElementById('prop-bg-color').value = node.data.bgColor || "#0f172a";
    document.getElementById('prop-desc').value = node.data.desc;

    const attrInputs = document.getElementById('attributes-container').querySelectorAll('input');
    attrInputs.forEach(input => {
        const key = input.dataset.attrKey;
        input.value = (node.data.bonuses && node.data.bonuses[key]) ? node.data.bonuses[key] : 0;
    });
}

function calculateTotals() {
    const totals = {}; let totalCost = 0;
    cState.nodes.forEach(n => {
        if(n.data.bonuses) {
            for(const [key, val] of Object.entries(n.data.bonuses)) {
                if(!totals[key]) totals[key] = 0;
                totals[key] += val;
            }
        }
        totalCost += n.data.cost;
    });
    
    const disp = document.getElementById('stats-display');
    if(!disp) return;
    disp.innerHTML = '';
    
    for(const [key, val] of Object.entries(totals)) {
        if(val === 0) continue;
        const label = ATTR_MAP[key] || key;
        disp.innerHTML += `<div class="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-white whitespace-nowrap"><span class="text-sky-400 font-bold">${label}:</span> +${val}</div>`;
    }
    
    document.getElementById('total-nodes-count').textContent = cState.nodes.length;
}

// ------------------------------------------------------------------------------------
// FERRAMENTAS EXPOSTAS NO WINDOW
// ------------------------------------------------------------------------------------
window.constTools = {
    loadConstellation: async () => {
        const sel = document.getElementById('const-class-select');
        const classId = sel.value;
        if(!classId) return alert("Selecione a Classe no menu superior!");
        
        cState.currentClassId = classId;
        cState.selectedNodeIds.clear();
        updateSidebarUI();

        const btn = document.getElementById('btn-load-class');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const docSnap = await getDoc(doc(db, "rpg_constelacoes_templates", classId));
            cState.nodes = docSnap.exists() ? (docSnap.data().nodes || []) : [];
            
            // Migração da Lógica Antiga
            cState.nodes.forEach(n => {
                if (n.data.bonusKey && !n.data.bonuses) {
                    n.data.bonuses = {};
                    n.data.bonuses[n.data.bonusKey] = n.data.bonusVal || 0;
                    delete n.data.bonusKey; delete n.data.bonusVal;
                }
                if (!n.data.bgColor) n.data.bgColor = "#0f172a";
                if (!n.data.bonuses) n.data.bonuses = {};
            });

            if(!docSnap.exists() && confirm("Ainda não existe mapa para esta classe. Iniciar em branco?")) cState.nodes = [];
            renderCanvas();
        } catch (e) { alert("Falha astral: " + e.message); }
        finally { btn.innerHTML = oldHtml; }
    },

    newClass: () => {
        const nome = prompt("Nome da Nova Classe Base:");
        if(nome) {
            const id = prompt("ID de Banco de Dados (ex: monge):", nome.toLowerCase().replace(/\s+/g, '_'));
            if(id) {
                cState.currentClassId = id;
                cState.nodes = [];
                const sel = document.getElementById('const-class-select');
                sel.add(new Option(nome, id));
                sel.value = id;
                renderCanvas();
            }
        }
    },

    duplicate: () => {
        if(cState.nodes.length === 0) return alert("Constelação vazia! Nada para clonar.");
        const targetId = prompt("Qual o ID da Classe Destino para colar esta constelação?");
        if(targetId) {
            cState.currentClassId = targetId;
            const sel = document.getElementById('const-class-select');
            if(![...sel.options].find(o => o.value === targetId)) sel.add(new Option(targetId + " (Clone)", targetId));
            sel.value = targetId;
            alert(`Matriz apontada para '${targetId}'. Pressione "Gravar" para selar no banco.`);
        }
    },

    save: async () => {
        if(!cState.currentClassId) return alert("Selecione a classe no menu do topo primeiro.");
        const btn = document.getElementById('btn-save-const');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Gravando...';
        
        const data = { classeId: cState.currentClassId, nodes: cState.nodes, totalNodes: cState.nodes.length, updatedAt: serverTimestamp() };
        try {
            await setDoc(doc(db, "rpg_constelacoes_templates", cState.currentClassId), data);
            await setDoc(doc(db, "rpg_constelacoes_backup", `${cState.currentClassId}_${Date.now()}`), data);
            alert("✨ Diagrama Estelar Gravado com Sucesso!");
        } catch(e) { alert("Erro ao salvar: " + e.message); } 
        finally { btn.innerHTML = oldHtml; }
    },

    addNode: (x, y) => {
        if(!cState.currentClassId) return alert("Carregue uma classe no topo!");
        const id = cState.nodes.length > 0 ? Math.max(...cState.nodes.map(n => n.id)) + 1 : 0;
        cState.nodes.push({
            id: id, x: x, y: y, connections: [],
            data: { title: `Estrela ${id}`, bonuses: {}, cost: 1, color: "#0ea5e9", bgColor: "#0f172a", desc: "" }
        });
        renderCanvas();
        cState.selectedNodeIds.clear();
        cState.selectedNodeIds.add(id);
        updateSidebarUI();
    },

    add50Nodes: () => {
        if(!cState.currentClassId) return alert("Carregue uma classe!");
        if(!confirm("Gerar 50 estrelas caóticas no centro?")) return;
        for(let i=0; i<50; i++) {
            window.constTools.addNode(40 + Math.random() * 20, 40 + Math.random() * 20);
        }
    },

    toggleLinkMode: () => {
        cState.isLinking = !cState.isLinking;
        cState.linkStartNodeId = null;
        const btn = document.getElementById('tool-link-mode');
        const ind = document.getElementById('mode-indicator');
        const cvs = document.getElementById('const-canvas-container');
        
        if (cState.isLinking) {
            btn.classList.add('border-sky-500', 'bg-sky-900/30');
            ind.classList.remove('hidden');
            cvs.style.cursor = 'crosshair';
        } else {
            btn.classList.remove('border-sky-500', 'bg-sky-900/30');
            ind.classList.add('hidden');
            cvs.style.cursor = 'grab';
        }
    },

    updateProp: (field, val) => {
        if(cState.selectedNodeIds.size === 0) return;
        const value = (field === 'cost') ? Number(val) : val;
        
        cState.selectedNodeIds.forEach(selId => {
            const node = cState.nodes.find(n => n.id === selId);
            if(node) node.data[field] = value;
        });

        if(['color', 'bgColor', 'title'].includes(field)) renderCanvas();
        calculateTotals();
    },

    updateBonus: (key, val) => {
        if(cState.selectedNodeIds.size === 0) return;
        const numVal = Number(val);
        cState.selectedNodeIds.forEach(selId => {
            const node = cState.nodes.find(n => n.id === selId);
            if(node) {
                if(!node.data.bonuses) node.data.bonuses = {};
                node.data.bonuses[key] = numVal;
            }
        });
        calculateTotals();
    },

    equalize: () => {
        if(cState.selectedNodeIds.size < 2) return;
        
        const bonuses = {};
        document.getElementById('attributes-container').querySelectorAll('input').forEach(inp => {
            bonuses[inp.dataset.attrKey] = Number(inp.value);
        });

        const data = {
            title: document.getElementById('prop-title').value,
            cost: Number(document.getElementById('prop-cost').value),
            color: document.getElementById('prop-color').value,
            bgColor: document.getElementById('prop-bg-color').value,
            desc: document.getElementById('prop-desc').value,
            bonuses: bonuses
        };

        cState.selectedNodeIds.forEach(id => {
            const node = cState.nodes.find(n => n.id === id);
            if(node) node.data = { ...data };
        });

        renderCanvas();
        calculateTotals();
        
        const btn = document.getElementById('btn-equalize');
        btn.classList.add('flash-success');
        setTimeout(() => btn.classList.remove('flash-success'), 500);
    },

    deleteSelected: () => {
        if(cState.selectedNodeIds.size === 0) return;
        if(!confirm(`Apagar ${cState.selectedNodeIds.size} estrelas?`)) return;

        cState.selectedNodeIds.forEach(delId => {
            cState.nodes.forEach(n => n.connections = n.connections.filter(c => c !== delId));
            cState.nodes = cState.nodes.filter(n => n.id !== delId);
        });
        
        cState.selectedNodeIds.clear();
        renderCanvas();
        updateSidebarUI();
    },

    unlinkSelected: () => {
        if(cState.selectedNodeIds.size === 0) return;
        cState.selectedNodeIds.forEach(selId => {
            const node = cState.nodes.find(n => n.id === selId);
            if(!node) return;
            node.connections.forEach(tid => {
                const t = cState.nodes.find(n => n.id === tid);
                if(t) t.connections = t.connections.filter(c => c !== selId);
            });
            node.connections = [];
        });
        renderCanvas();
    },

    zoomIn: () => { cState.zoom += 0.1; document.getElementById('constellation-layer').style.transform = `translate(-50%, -50%) scale(${cState.zoom})`; },
    zoomOut: () => { if(cState.zoom > 0.3) { cState.zoom -= 0.1; document.getElementById('constellation-layer').style.transform = `translate(-50%, -50%) scale(${cState.zoom})`; } }
};