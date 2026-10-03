/* ARQUIVO: js/tabs/teiaConexoes.js */
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from '../core/firebase.js';
// Correção cirúrgica: Importação direta do módulo de estado do seu projeto
import { globalState } from '../core/state.js';

let networkInstance = null;
let scriptCarregado = false;

// Caches locais para sincronizar dados em tempo real
let listaNpcsGlobal = [];
let listaConexoesGlobal = [];

// Função auxiliar unificada para checar permissão de mestre/admin importada do seu state.js
function checkIsMaster() {
    return globalState?.isAdmin ||
        globalState?.userRole === 'mestre' ||
        globalState?.userRole === 'admin' ||
        false;
}

export function renderTeiaConexoesTab(target) {
    if (!target) return;

    // Sair da aba encerra as escutas: sem isso, visitar a aba 10 vezes deixava
    // 20 listeners vivos (ver nota em unsubscribeTeia).
    window.teiaUnsubscribe = unsubscribeTeia;

    // 1. Injeta a estrutura de HTML contendo o Inspector e os Formulários de Gestão
    target.innerHTML = `
        <div class="flex flex-col md:flex-row h-full w-full gap-4 p-4 animate-fade-in">
            
            <!-- Painel Lateral: Inspecionar e Gerenciar -->
            <div id="teia-sidebar" class="w-full md:w-80 bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scroll">
                
                <!-- Navegação de Abas do Mestre (Fica visível apenas para o Mestre/Admin) -->
                <div id="teia-sidebar-tabs" class="flex border-b border-slate-800 shrink-0 gap-1 hidden">
                    <button onclick="window.teia.switchTab('inspect')" id="btn-teia-tab-inspect" class="flex-1 py-2 text-[10px] uppercase font-bold text-amber-500 border-b-2 border-amber-500 bg-slate-850">Inspecionar</button>
                    <button onclick="window.teia.switchTab('link')" id="btn-teia-tab-link" class="flex-1 py-2 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-200">Vínculo</button>
                    <button onclick="window.teia.switchTab('concept')" id="btn-teia-tab-concept" class="flex-1 py-2 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-200">Nó Especial</button>
                </div>
                
                <!-- Conteúdo da Aba 1: INSPEÇÃO (Disponível para todos, mas apenas editável por Mestre) -->
                <div id="teia-panel-inspect" class="space-y-4">
                    <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
                        Inspecionar Detalhes
                    </h3>
                    <div id="teia-inspect-empty" class="text-center text-slate-500 italic py-10 text-xs">
                        Clique em um personagem ou linha de vínculo no grafo para ver suas informações e histórias.
                    </div>
                    <div id="teia-inspect-content" class="hidden space-y-3">
                        <div class="bg-slate-950 p-3 rounded border border-slate-800 text-center">
                            <h4 id="teia-inspect-title" class="font-cinzel text-sm text-white font-bold">Nome do Vínculo</h4>
                            <p id="teia-inspect-subtitle" class="text-[10px] text-slate-500 mt-1 uppercase font-bold">Tipo</p>
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Anotações / Descrição</label>
                            <textarea id="teia-inspect-desc" rows="6" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" placeholder="Sem descrição cadastrada..."></textarea>
                        </div>
                        
                        <!-- Ações Administrativas (Salvar/Remover) -->
                        <div id="teia-inspect-admin-actions" class="hidden space-y-2">
                            <button onclick="window.teia.saveInspection()" class="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest text-[10px] py-2.5 rounded transition-colors">
                                Salvar Alterações
                            </button>
                            <button onclick="window.teia.deleteInspected()" class="w-full bg-red-950/40 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 font-bold uppercase tracking-widest text-[10px] py-2 rounded transition-colors">
                                Remover do Grafo
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Conteúdo da Aba 2: CRIAR VÍNCULO (Apenas Mestre) -->
                <div id="teia-panel-link" class="hidden space-y-3">
                    <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
                        Criar Novo Vínculo
                    </h3>
                    <form id="form-nova-conexao" class="space-y-3">
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nó de Origem</label>
                            <select id="teia-select-npc1" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required>
                                <option value="">Selecione...</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nó de Destino</label>
                            <select id="teia-select-npc2" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required>
                                <option value="">Selecione...</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tipo de Vínculo</label>
                            <input type="text" id="teia-input-tipo" placeholder="Ex: Aliado, Inimigo, Clã, Religião" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required />
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Comentário / Detalhes</label>
                            <textarea id="teia-input-comentario" placeholder="Segredos ou informações da relação..." rows="4" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500"></textarea>
                        </div>
                        <button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest text-[10px] py-2 rounded transition-colors">
                            Criar Vínculo
                        </button>
                    </form>
                </div>

                <!-- Conteúdo da Aba 3: CRIAR NÓ ESPECIAL (Apenas Mestre) -->
                <div id="teia-panel-concept" class="hidden space-y-3">
                    <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
                        Criar Nó Especial
                    </h3>
                    <p class="text-[10px] text-slate-500 italic leading-snug">Use para representar famílias, religiões, cultos, facções ou organizações que não possuem um único NPC para representá-los.</p>
                    <form id="form-novo-conceito" class="space-y-3">
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nome do Nó Especial</label>
                            <input type="text" id="teia-input-conceito-nome" placeholder="Ex: Família Kazenski, Igreja de Gallandra" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required />
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Classificação</label>
                            <select id="teia-select-conceito-tipo" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500">
                                <option value="Família / Clã">Família / Clã</option>
                                <option value="Religião / Culto">Religião / Culto</option>
                                <option value="Organização / Facção">Organização / Facção</option>
                                <option value="Conceito / Lenda">Conceito / Lenda</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Anotações Iniciais</label>
                            <textarea id="teia-input-conceito-desc" placeholder="Resumo de história, influência ou crenças..." rows="4" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500"></textarea>
                        </div>
                        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-[10px] py-2 rounded transition-colors">
                            Criar Nó Especial
                        </button>
                    </form>
                </div>

            </div>

            <!-- Área Principal: Onde o Grafo Interativo será Renderizado -->
            <div class="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex flex-col min-h-[500px]">
                <div id="teia-canvas-container" class="flex-grow w-full h-full min-h-[450px]"></div>
                
                <!-- Legenda flutuante no grafo -->
                <div class="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-3 rounded text-[10px] space-y-1.5 pointer-events-none z-10">
                    <p class="font-bold text-amber-500 uppercase tracking-wider mb-1">Legenda da Teia</p>
                    <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Personagem (Passe o mouse)</div>
                    <div class="flex items-center gap-2"><span class="w-4 h-2 bg-slate-700 border border-slate-600 inline-block rounded"></span> Nó Especial (Família, Religião, etc)</div>
                    <div class="flex items-center gap-2"><span class="w-4 h-0.5 bg-slate-500 inline-block"></span> Linha de Vínculo</div>
                </div>
            </div>

        </div>
    `;

    // 2. Garante o carregamento da biblioteca vis-network antes de inicializar o mapa de relações
    if (!scriptCarregado) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
        script.onload = () => {
            scriptCarregado = true;
            configurarGrafoEFormularios();
        };
        document.head.appendChild(script);
    } else {
        configurarGrafoEFormularios();
    }
}

// Expõe a função globalmente no objeto window
window.renderTeiaConexoesTab = renderTeiaConexoesTab;

// 3. Namespace principal para gerenciar interações e estados da Teia
window.teia = {
    selectedNodeId: null,
    selectedEdgeId: null,
    activeTab: 'inspect',

    switchTab: function (tabName) {
        this.activeTab = tabName;
        document.getElementById('teia-panel-inspect').classList.toggle('hidden', tabName !== 'inspect');
        document.getElementById('teia-panel-link').classList.toggle('hidden', tabName !== 'link');
        document.getElementById('teia-panel-concept').classList.toggle('hidden', tabName !== 'concept');

        // Atualiza estilo dos botões das abas administrativas
        const btns = {
            inspect: document.getElementById('btn-teia-tab-inspect'),
            link: document.getElementById('btn-teia-tab-link'),
            concept: document.getElementById('btn-teia-tab-concept')
        };

        Object.keys(btns).forEach(key => {
            const btn = btns[key];
            if (!btn) return;
            if (key === tabName) {
                btn.className = "flex-1 py-2 text-[10px] uppercase font-bold text-amber-500 border-b-2 border-amber-500 bg-slate-850";
            } else {
                btn.className = "flex-1 py-2 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-200";
            }
        });
    },

    inspectNode: function (nodeId) {
        this.selectedNodeId = nodeId;
        this.selectedEdgeId = null;

        const npc = listaNpcsGlobal.find(n => n.id === nodeId);
        if (!npc) return;

        this.switchTab('inspect');
        document.getElementById('teia-inspect-empty').classList.add('hidden');
        document.getElementById('teia-inspect-content').classList.remove('hidden');

        document.getElementById('teia-inspect-title').textContent = npc.nome;
        document.getElementById('teia-inspect-subtitle').textContent = npc.isConceito ? `Nó Especial: ${npc.tipoNode}` : 'Personagem (NPC)';

        const descArea = document.getElementById('teia-inspect-desc');
        descArea.value = npc.description || '';

        const isMaster = checkIsMaster();
        descArea.disabled = !isMaster;

        const adminActions = document.getElementById('teia-inspect-admin-actions');
        if (adminActions) {
            adminActions.classList.toggle('hidden', !isMaster);
        }
    },

    inspectEdge: function (edgeId) {
        this.selectedEdgeId = edgeId;
        this.selectedNodeId = null;

        const conn = listaConexoesGlobal.find(c => c.id === edgeId);
        if (!conn) return;

        const npcOrigem = listaNpcsGlobal.find(n => n.id === conn.npcId1)?.nome || 'Desconhecido';
        const npcDestino = listaNpcsGlobal.find(n => n.id === conn.npcId2)?.nome || 'Desconhecido';

        this.switchTab('inspect');
        document.getElementById('teia-inspect-empty').classList.add('hidden');
        document.getElementById('teia-inspect-content').classList.remove('hidden');

        document.getElementById('teia-inspect-title').textContent = `${npcOrigem} ➔ ${npcDestino}`;
        document.getElementById('teia-inspect-subtitle').textContent = `Vínculo: ${conn.tipo}`;

        const descArea = document.getElementById('teia-inspect-desc');
        descArea.value = conn.comentario || '';

        const isMaster = checkIsMaster();
        descArea.disabled = !isMaster;

        const adminActions = document.getElementById('teia-inspect-admin-actions');
        if (adminActions) {
            adminActions.classList.toggle('hidden', !isMaster);
        }
    },

    clearInspect: function () {
        this.selectedNodeId = null;
        this.selectedEdgeId = null;
        const empty = document.getElementById('teia-inspect-empty');
        const content = document.getElementById('teia-inspect-content');
        if (empty) empty.classList.remove('hidden');
        if (content) content.classList.add('hidden');
    },

    saveInspection: async function () {
        const descValue = document.getElementById('teia-inspect-desc').value.trim();
        try {
            if (this.selectedNodeId) {
                await updateDoc(doc(db, 'rpg_Npcs', this.selectedNodeId), { description: descValue });
                alert("Descrição do nó atualizada!");
            } else if (this.selectedEdgeId) {
                await updateDoc(doc(db, 'rpg_NpcConexoes', this.selectedEdgeId), { comentario: descValue });
                alert("Histórico do vínculo atualizado!");
            }
        } catch (err) {
            console.error("Erro ao salvar alterações:", err);
            alert("Erro ao salvar.");
        }
    },

    deleteInspected: async function () {
        if (this.selectedNodeId) {
            const npc = listaNpcsGlobal.find(n => n.id === this.selectedNodeId);
            if (!confirm(`Deseja mesmo remover permanentemente o nó "${npc?.nome}" do mapa de relações?`)) return;
            try {
                await deleteDoc(doc(db, 'rpg_Npcs', this.selectedNodeId));
                this.clearInspect();
                alert("Nó removido!");
            } catch (err) {
                console.error(err);
                alert("Erro ao remover nó.");
            }
        } else if (this.selectedEdgeId) {
            if (!confirm("Deseja mesmo remover este vínculo do mapa de relações?")) return;
            try {
                await deleteDoc(doc(db, 'rpg_NpcConexoes', this.selectedEdgeId));
                this.clearInspect();
                alert("Vínculo removido!");
            } catch (err) {
                console.error(err);
                alert("Erro ao remover vínculo.");
            }
        }
    }
};

// Unsubscribe das escutas deste módulo.
//
// BUG CORRIGIDO (leak): `configurarGrafoEFormularios()` é chamado a cada
// visita à aba e criava DOIS novos onSnapshot, descartando o valor de
// retorno (sem unsubscribe). Após 10 visitas havia 20 escutas ativas: uma
// única edição de NPC disparava 10 redesenhos do grafo, e cada redesenho
// fazia `networkInstance.destroy()` + `new vis.Network(...)`, recomeçando a
// simulação física do zero. Além disso, cada escuta antiga mantinha referência
// a um <select> já desconectado do DOM.
let npcsUnsub = null;
let conexoesUnsub = null;

/** Cancela as escutas anteriores (idempotente). */
function unsubscribeTeia() {
    if (npcsUnsub) { try { npcsUnsub(); } catch (e) { /* já desligado */ } npcsUnsub = null; }
    if (conexoesUnsub) { try { conexoesUnsub(); } catch (e) { /* já desligado */ } conexoesUnsub = null; }
}

function configurarGrafoEFormularios() {
    // Reentrada: mata as escutas anteriores antes de criar novas.
    unsubscribeTeia();
    const isMaster = checkIsMaster();
    const sidebarTabs = document.getElementById('teia-sidebar-tabs');

    // Se for Mestre, exibe o controle de abas administrativas na lateral
    if (isMaster && sidebarTabs) {
        sidebarTabs.classList.remove('hidden');
        window.teia.switchTab('inspect');
    }

    const select1 = document.getElementById('teia-select-npc1');
    const select2 = document.getElementById('teia-select-npc2');

    // Escuta NPCs e Nós Especiais em tempo real do Firebase (Sintaxe Modular v9)
    npcsUnsub = onSnapshot(collection(db, 'rpg_Npcs'), (snapNPCs) => {
        listaNpcsGlobal = [];

        if (select1 && select2) {
            select1.innerHTML = '<option value="">Selecione...</option>';
            select2.innerHTML = '<option value="">Selecione...</option>';
        }

        snapNPCs.forEach(docSnap => {
            const data = docSnap.data();
            const npc = {
                id: docSnap.id,
                nome: data.nome || data.name,
                imagem: data.imagemUrl || data.imageUrls?.imagem1 || 'https://placehold.co/100x100/0f172a/d4af37?text=NPC',
                isConceito: data.isConceito === true,
                tipoNode: data.tipoNode || '',
                description: data.description || ''
            };
            listaNpcsGlobal.push(npc);

            if (select1 && select2) {
                const opt1 = document.createElement('option');
                opt1.value = npc.id; opt1.textContent = npc.isConceito ? `[Grupo] ${npc.nome}` : npc.nome;
                select1.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = npc.id; opt2.textContent = npc.isConceito ? `[Grupo] ${npc.nome}` : npc.nome;
                select2.appendChild(opt2);
            }
        });

        atualizarEdesenhar();
    });

    // Escuta conexões em tempo real do Firebase (Sintaxe Modular v9)
    conexoesUnsub = onSnapshot(collection(db, 'rpg_NpcConexoes'), (snapConexoes) => {
        listaConexoesGlobal = [];

        snapConexoes.forEach(docSnap => {
            const data = docSnap.data();
            listaConexoesGlobal.push({ id: docSnap.id, ...data });
        });

        atualizarEdesenhar();
    });

    // Submissão do Formulário de Vínculos (Mestre)
    const formConexao = document.getElementById('form-nova-conexao');
    if (formConexao) {
        formConexao.onsubmit = async (e) => {
            e.preventDefault();
            const npcId1 = select1.value;
            const npcId2 = select2.value;
            const tipo = document.getElementById('teia-input-tipo').value.trim();
            const comentario = document.getElementById('teia-input-comentario').value.trim();

            if (npcId1 === npcId2) {
                alert("Não é possível criar um vínculo para o mesmo nó!");
                return;
            }

            try {
                await addDoc(collection(db, 'rpg_NpcConexoes'), {
                    npcId1,
                    npcId2,
                    tipo,
                    comentario,
                    criadoEm: serverTimestamp()
                });
                formConexao.reset();
                alert("Vínculo criado com sucesso!");
            } catch (err) {
                console.error("Erro ao criar vínculo:", err);
            }
        };
    }

    // Submissão do Formulário de Nó Especial de Conceito/Grupo (Mestre)
    const formConceito = document.getElementById('form-novo-conceito');
    if (formConceito) {
        formConceito.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById('teia-input-conceito-nome').value.trim();
            const tipoNode = document.getElementById('teia-select-conceito-tipo').value;
            const desc = document.getElementById('teia-input-conceito-desc').value.trim();

            try {
                await addDoc(collection(db, 'rpg_Npcs'), {
                    nome,
                    isConceito: true,
                    tipoNode,
                    description: desc,
                    criadoEm: serverTimestamp()
                });
                formConceito.reset();
                alert(`Nó especial "${nome}" registrado com sucesso!`);
            } catch (err) {
                console.error("Erro ao criar nó especial:", err);
            }
        };
    }
}

function atualizarEdesenhar() {
    const conexoesParaListaAdmin = listaConexoesGlobal.map(c => {
        const npcOrigem = listaNpcsGlobal.find(n => n.id === c.npcId1)?.nome || 'Desconhecido';
        const npcDestino = listaNpcsGlobal.find(n => n.id === c.npcId2)?.nome || 'Desconhecido';
        return { id: c.id, texto: `${npcOrigem} ➔ ${npcDestino} (${c.tipo})` };
    });

    atualizarListaAdmin(conexoesParaListaAdmin);
    desenharGrafo(listaNpcsGlobal, listaConexoesGlobal);
}

function atualizarListaAdmin(conexoes) {
    const container = document.getElementById('teia-lista-conexoes');
    if (!container) return;

    container.innerHTML = '';
    if (conexoes.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic text-[10px]">Nenhum vínculo.</p>';
        return;
    }

    conexoes.forEach(c => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-[#020617] border border-slate-800 p-1.5 rounded gap-2 hover:border-red-900 transition-colors";
        div.innerHTML = `
            <span class="truncate text-slate-300 font-mono text-[10px]" title="${c.texto}">${c.texto}</span>
            <button class="text-red-500 hover:text-red-400 font-bold shrink-0 p-1">
                <i class="fas fa-trash-alt text-[10px]"></i>
            </button>
        `;
        div.querySelector('button').onclick = async () => {
            if (confirm("Remover esta conexão?")) {
                try {
                    await deleteDoc(doc(db, 'rpg_NpcConexoes', c.id));
                } catch (err) {
                    console.error("Erro ao remover conexão:", err);
                }
            }
        };
        container.appendChild(div);
    });
}

function desenharGrafo(npcs, conexoes) {
    const container = document.getElementById('teia-canvas-container');
    if (!container) return;

    // Configurando os nós do Vis-Network diferenciando NPCs de Nós de Grupos (Cinza Escuro)
    const nodes = npcs.map(npc => {
        if (npc.isConceito) {
            // Estilo Cinza Escuro e Formato Retangular/Oval ('box') para Organizações/Famílias/Religiões
            return {
                id: npc.id,
                label: npc.nome,
                shape: 'box',
                margin: 10,
                color: {
                    border: '#475569', // Slate 600
                    background: '#1e293b', // Slate 800
                    highlight: { border: '#64748b', background: '#334155' }
                },
                font: { color: '#ffffff', size: 12, face: 'Cinzel', bold: true }
            };
        } else {
            // Estilo Padrão para NPCs (Avatar redondo com borda ambar)
            return {
                id: npc.id,
                label: npc.nome,
                shape: 'circularImage',
                image: npc.imagem,
                size: 24,
                borderWidth: 3,
                color: {
                    border: '#d97706',
                    background: '#0f172a',
                    highlight: { border: '#fbbf24', background: '#1e293b' }
                },
                font: { color: '#e2e8f0', size: 12, face: 'Cinzel' }
            };
        }
    });

    // Configurando as arestas (linhas de conexão com tooltips/titles)
    const edges = conexoes.map(c => {
        return {
            id: c.id,
            from: c.npcId1,
            to: c.npcId2,
            label: c.tipo,
            title: c.comentario || 'Sem comentários.',
            width: 2,
            color: {
                color: '#475569',
                highlight: '#fbbf24',
                hover: '#fbbf24'
            },
            font: { color: '#94a3b8', size: 10, align: 'horizontal' },
            arrows: {
                to: { enabled: true, scaleFactor: 0.5 }
            }
        };
    });

    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const options = {
        physics: {
            stabilization: true,
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.3,
                springLength: 150
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100
        }
    };

    if (networkInstance) {
        networkInstance.destroy();
    }
    networkInstance = new vis.Network(container, data, options);

    // Ouvinte para abrir o painel de inspeção lateral quando um item for clicado/selecionado
    networkInstance.on("select", function (params) {
        if (params.nodes.length === 1) {
            window.teia.inspectNode(params.nodes[0]);
        } else if (params.edges.length === 1) {
            window.teia.inspectEdge(params.edges[0]);
        } else {
            window.teia.clearInspect();
        }
    });
}