import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

const DADIVA_TIERS = [
    { start: 1, end: 20 }, { start: 21, end: 50 },
    { start: 51, end: 80 }, { start: 81, end: 100 }
];

let xpState = {
    efeitos: [],
    loading: false
};

export async function renderGerarTabelaXpTab() {
    const container = document.getElementById('gerar-tabela-xp-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col items-center p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-amber-900/50 pb-8 w-full max-w-5xl flex flex-col items-center gap-4">
                <div class="p-4 bg-amber-900/20 rounded-full border-2 border-amber-500/50 text-amber-500 text-4xl shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-2">
                    <i class="fas fa-chart-line"></i>
                </div>
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Engenharia de Progressão</h1>
                <p class="text-slate-400 mt-2 text-sm italic font-bold">Matemática de Nível Universal e Dádivas de Imperiall</p>
            </header>

            <div id="xp-loading" class="flex flex-col items-center justify-center p-12 text-amber-500">
                <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                <span class="font-cinzel tracking-widest">Calculando constantes universais...</span>
            </div>

            <div id="xp-view" class="w-full max-w-5xl hidden flex-col gap-6">
                <form id="xp-form" onsubmit="window.xpTools.generateAndSave(event)" class="bg-slate-800/80 p-8 rounded-2xl border border-amber-500/30 shadow-2xl space-y-8">
                    
                    <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                        <h3 class="text-xl font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2 font-cinzel uppercase tracking-widest"><i class="fas fa-calculator mr-2"></i> 1. Matriz de Crescimento</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nome do Registro (ID)</label>
                                <input type="text" id="config-nome" value="tabela_xp" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-slate-300 font-mono outline-none focus:border-amber-500 transition-colors">
                            </div>
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nível Limite (Max)</label>
                                <input type="number" id="max-level" value="100" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white text-center font-mono outline-none focus:border-amber-500 transition-colors">
                            </div>
                            <div>
                                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block" title="Este é o valor base '100' da fórmula.">Fator Multiplicador de XP</label>
                                <input type="number" id="xp-base-increment" value="100" required class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-amber-400 text-center font-mono outline-none focus:border-amber-500 transition-colors">
                            </div>
                        </div>
                    </section>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                            <h3 class="text-sm font-bold text-sky-400 mb-4 border-b border-slate-700 pb-2 font-cinzel uppercase tracking-widest"><i class="fas fa-seedling mr-2"></i> 2A. Atributos Base (Nvl 1)</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">HP Inicial</label><input type="number" id="base-hp" value="100" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-white text-center font-mono outline-none focus:border-sky-500"></div>
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">MP Inicial</label><input type="number" id="base-mp" value="50" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-white text-center font-mono outline-none focus:border-sky-500"></div>
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Iniciativa Inic.</label><input type="number" id="base-iniciativa" value="10" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-white text-center font-mono outline-none focus:border-sky-500"></div>
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">AP Inic.</label><input type="number" id="base-ap" value="5" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-white text-center font-mono outline-none focus:border-sky-500"></div>
                            </div>
                        </section>

                        <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                            <h3 class="text-sm font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-2 font-cinzel uppercase tracking-widest"><i class="fas fa-level-up-alt mr-2"></i> 2B. Ganho Automático (Por Nível)</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="col-span-2"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">+ HP e MP Ganho</label><input type="number" id="inc-hp-mp" value="10" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-emerald-300 text-center font-mono outline-none focus:border-emerald-500"></div>
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">+ Iniciativa</label><input type="number" id="inc-iniciativa" value="1" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-emerald-300 text-center font-mono outline-none focus:border-emerald-500"></div>
                                <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">+ AP</label><input type="number" id="inc-ap" value="3" class="w-full bg-slate-950 border border-slate-600 p-2 rounded text-emerald-300 text-center font-mono outline-none focus:border-emerald-500"></div>
                            </div>
                        </section>
                    </div>

                    <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                        <h3 class="text-xl font-bold text-amber-400 mb-2 border-b border-slate-700 pb-2 font-cinzel uppercase tracking-widest"><i class="fas fa-medal mr-2"></i> 3. Bônus de Ascensão (Milestones)</h3>
                        <p class="text-[10px] text-slate-400 uppercase tracking-widest mb-4 font-bold">Acúmulo extra que ocorre a cada 5 níveis.</p>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-64 overflow-y-auto custom-scroll pr-2" id="milestones-container">
                            </div>
                    </section>

                    <section class="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                        <h3 class="text-xl font-bold text-purple-400 mb-2 border-b border-slate-700 pb-2 font-cinzel uppercase tracking-widest"><i class="fas fa-gift mr-2"></i> 4. Dádivas de Patamar</h3>
                        <p class="text-[10px] text-slate-400 uppercase tracking-widest mb-4 font-bold">Benefícios passivos atrelados à faixa de nível atual do jogador.</p>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="dadivas-container">
                            </div>
                    </section>

                    <button type="submit" id="btn-save-xp" class="w-full py-5 bg-gradient-to-r from-amber-700 to-amber-600 hover:brightness-110 text-white font-black text-xl tracking-widest rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] uppercase transition-transform hover:scale-[1.01] flex items-center justify-center border border-amber-500/50">
                        <i class="fas fa-magic mr-3"></i> Imprimir Constantes Universais no Banco de Dados
                    </button>
                </form>
            </div>

        </div>
    `;

    await loadDependencies();
}

async function loadDependencies() {
    try {
        const snapshot = await getDocs(query(collection(db, 'rpg_efeitosGerais'), orderBy('nome')));
        xpState.efeitos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        buildDynamicForms();

        document.getElementById('xp-loading').classList.add('hidden');
        document.getElementById('xp-view').classList.remove('hidden');
        document.getElementById('xp-view').classList.add('flex');
    } catch (e) {
        console.error("Erro ao carregar efeitos:", e);
        document.getElementById('xp-loading').innerHTML = '<p class="text-red-500 font-bold">Erro crítico de carregamento das leis físicas.</p>';
    }
}

function buildDynamicForms() {
    const mileCont = document.getElementById('milestones-container');
    const dadCont = document.getElementById('dadivas-container');
    if (!mileCont || !dadCont) return;

    let mileHtml = '';
    for (let i = 5; i <= 100; i += 5) {
        mileHtml += `
            <div class="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-inner">
                <h4 class="text-center font-bold text-amber-500 text-xs mb-2 border-b border-slate-800 pb-1">Nível ${i}</h4>
                <div class="space-y-2">
                    <div class="flex justify-between items-center"><label class="text-[9px] text-slate-400 font-bold uppercase">+ HP/MP</label><input type="number" class="milestone-bonus w-12 bg-slate-900 border border-slate-700 rounded text-center text-[10px] text-white outline-none focus:border-amber-500" data-level="${i}" data-stat="hpmp" value="0"></div>
                    <div class="flex justify-between items-center"><label class="text-[9px] text-slate-400 font-bold uppercase">+ INIC.</label><input type="number" class="milestone-bonus w-12 bg-slate-900 border border-slate-700 rounded text-center text-[10px] text-white outline-none focus:border-amber-500" data-level="${i}" data-stat="iniciativa" value="0"></div>
                    <div class="flex justify-between items-center"><label class="text-[9px] text-slate-400 font-bold uppercase">+ AP</label><input type="number" class="milestone-bonus w-12 bg-slate-900 border border-slate-700 rounded text-center text-[10px] text-white outline-none focus:border-amber-500" data-level="${i}" data-stat="ap" value="0"></div>
                </div>
            </div>
        `;
    }
    mileCont.innerHTML = mileHtml;

    const optionsEfeitos = xpState.efeitos.map(e => `<option value="${e.id}">${escapeHTML(e.nome)}</option>`).join('');
    let dadHtml = '';
    
    DADIVA_TIERS.forEach(tier => {
        dadHtml += `
            <div class="bg-slate-950 border border-purple-900/30 p-4 rounded-xl shadow-inner">
                <h4 class="font-bold text-purple-400 text-sm mb-3 font-cinzel text-center border-b border-slate-800 pb-2">Patamar ${tier.start} ao ${tier.end}</h4>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Descrição Textual (Roleplay)</label>
                        <textarea id="dadiva-efeito-${tier.start}" rows="2" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 outline-none focus:border-purple-500 custom-scroll"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Bônus Dano Fixo</label>
                            <input type="number" id="dadiva-dano-${tier.start}" value="0" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-red-400 text-center font-mono outline-none focus:border-red-500">
                        </div>
                        <div>
                            <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Efeito Acoplado</label>
                            <input type="text" list="efeitos-list-${tier.start}" id="dadiva-efeito-geral-${tier.start}" placeholder="Buscar efeito..." class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-sky-300 outline-none focus:border-sky-500">
                            <datalist id="efeitos-list-${tier.start}">${optionsEfeitos}</datalist>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    dadCont.innerHTML = dadHtml;
}

window.xpTools = {
    generateAndSave: async function(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-xp');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> Sincronizando Leis Físicas...';
        btn.disabled = true;

        try {
            const configNome = document.getElementById('config-nome').value.trim();
            const maxLevel = parseInt(document.getElementById('max-level').value) || 100;
            const xpBaseIncrement = parseInt(document.getElementById('xp-base-increment').value) || 100;
            
            const base = {
                hp: parseInt(document.getElementById('base-hp').value) || 100, 
                mp: parseInt(document.getElementById('base-mp').value) || 50,
                iniciativa: parseInt(document.getElementById('base-iniciativa').value) || 10, 
                ap: parseInt(document.getElementById('base-ap').value) || 5
            };
            
            const inc = {
                hpmp: parseInt(document.getElementById('inc-hp-mp').value) || 10,
                iniciativa: parseInt(document.getElementById('inc-iniciativa').value) || 1,
                ap: parseInt(document.getElementById('inc-ap').value) || 3
            };

            const milestoneBonuses = {};
            document.querySelectorAll('.milestone-bonus').forEach(input => {
                const lvl = input.dataset.level;
                if (!milestoneBonuses[lvl]) milestoneBonuses[lvl] = {};
                milestoneBonuses[lvl][input.dataset.stat] = parseInt(input.value) || 0;
            });

            const dadivas = {};
            DADIVA_TIERS.forEach(tier => {
                dadivas[tier.start] = {
                    efeito: document.getElementById(`dadiva-efeito-${tier.start}`).value,
                    bonusDanoExtraLevelBase: parseInt(document.getElementById(`dadiva-dano-${tier.start}`).value) || 0,
                    efeitoGeralId: document.getElementById(`dadiva-efeito-geral-${tier.start}`).value
                };
            });
            
            const niveis = {};
            let stats = { ...base };
            let milestoneAcc = { hpmp: 0, iniciativa: 0, ap: 0 };
            let xpTotalNecessaria = 0;

            // Algoritmo Matemático Oficial do Imperiall
            for (let level = 1; level <= maxLevel; level++) {
                if (level > 1) {
                    // XP Total Atual = XP Total Anterior + ((Nível Anterior) * Fator)
                    const custoParaEsteNivel = (level - 1) * xpBaseIncrement;
                    xpTotalNecessaria += custoParaEsteNivel;
                    
                    stats.hp += inc.hpmp; 
                    stats.mp += inc.hpmp;
                    stats.iniciativa += inc.iniciativa; 
                    stats.ap += inc.ap;
                }

                if (level % 5 === 0 && milestoneBonuses[level]) {
                    milestoneAcc.hpmp += milestoneBonuses[level].hpmp;
                    milestoneAcc.iniciativa += milestoneBonuses[level].iniciativa;
                    milestoneAcc.ap += milestoneBonuses[level].ap;
                }
                
                let dadivaAtual = {};
                for(const tier of DADIVA_TIERS) {
                    if (level >= tier.start && level <= tier.end) { 
                        dadivaAtual = dadivas[tier.start]; 
                        break; 
                    }
                }

                niveis[level] = {
                    level,
                    experienciaParaProximoNivel: xpTotalNecessaria,
                    bonusHpLevelBase: stats.hp + milestoneAcc.hpmp,
                    bonusMpLevelBase: stats.mp + milestoneAcc.hpmp,
                    bonusIniciativaLevelBase: stats.iniciativa + milestoneAcc.iniciativa,
                    bonusApLevelBase: stats.ap + milestoneAcc.ap,
                    ...dadivaAtual
                };
            }

            const finalDoc = { 
                nome: configNome, 
                niveis: niveis, 
                atualizadoEm: serverTimestamp() 
            };

            await setDoc(doc(db, "rpg_configuracoes", configNome), finalDoc);
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Evolução Sancionada!';
            btn.classList.replace('from-amber-700', 'from-green-600');
            btn.classList.replace('to-amber-600', 'to-green-500');
            
            setTimeout(() => {
                btn.innerHTML = oldHtml;
                btn.classList.replace('from-green-600', 'from-amber-700');
                btn.classList.replace('to-green-500', 'to-amber-600');
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error(error);
            alert(`Falha Crítica na Matriz: ${error.message}`);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};