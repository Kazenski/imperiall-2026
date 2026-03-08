import { globalState } from '../core/state.js';
import { calculateDetailedStats } from '../core/calculos.js';

export function renderCalculadoraAtributos() {
    const container = document.getElementById('calculadora-atributos-content');
    if (!container) return;

    const charData = globalState.selectedCharacterData;
    
    // Se não tiver personagem selecionado, mostra aviso
    if (!charData) {
        container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
        return;
    }

    // 1. INJEÇÃO DO ESQUELETO (Tela Cheia, Sem Scroll)
    if (!document.getElementById('calc-atributos-wrapper')) {
        container.innerHTML = `
            <div id="calc-atributos-wrapper" class="flex flex-col h-full animate-fade-in pb-4">
                
                <div class="flex justify-between items-center mb-4 shrink-0">
                    <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-chart-bar mr-3 text-slate-600"></i> Status Base Detalhado</h2>
                </div>

                <div class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-6">
                    
                    <div class="bg-slate-900/40 border border-slate-700 rounded-xl p-3 flex flex-col h-full shadow-inner">
                        <h3 class="text-amber-500 font-cinzel font-bold text-lg text-center border-b border-slate-700 pb-2 mb-3 shrink-0"><i class="fas fa-crosshairs mr-1 opacity-50"></i> Ataque</h3>
                        <div id="atk-container" class="flex-1 flex flex-col justify-start gap-2"></div>
                    </div>

                    <div class="bg-slate-900/40 border border-slate-700 rounded-xl p-3 flex flex-col h-full shadow-inner">
                        <h3 class="text-blue-400 font-cinzel font-bold text-lg text-center border-b border-slate-700 pb-2 mb-3 shrink-0"><i class="fas fa-shield-alt mr-1 opacity-50"></i> Defesa</h3>
                        <div id="def-container" class="flex-1 flex flex-col justify-start gap-2"></div>
                    </div>

                    <div class="bg-slate-900/40 border border-slate-700 rounded-xl p-3 flex flex-col h-full shadow-inner">
                        <h3 class="text-emerald-400 font-cinzel font-bold text-lg text-center border-b border-slate-700 pb-2 mb-3 shrink-0"><i class="fas fa-running mr-1 opacity-50"></i> Evasão</h3>
                        <div id="eva-container" class="flex-1 flex flex-col justify-start gap-2"></div>
                    </div>

                </div>
            </div>
        `;
    }

    // 2. Realiza os cálculos
    const stats = calculateDetailedStats(charData);

    // 3. Configura o mapeamento com as cores para cada coluna
    const map = [
        { id: 'atk-container', data: stats.Ataque, color: 'text-amber-400' },
        { id: 'def-container', data: stats.Defesa, color: 'text-blue-400' },
        { id: 'eva-container', data: stats.Evasao, color: 'text-emerald-400' }
    ];

    // 4. Renderiza as caixinhas super compactas (3 colunas internas)
    map.forEach(group => {
        const el = document.getElementById(group.id);
        if(!el) return;
        el.innerHTML = '';

        Object.keys(group.data).forEach(typeName => {
            const val = group.data[typeName];
            
            const div = document.createElement('div');
            // Classes ajustadas: p-2 (menor padding), bg-slate-950 (mais escuro para destacar da coluna)
            div.className = "bg-slate-950 p-2.5 rounded-lg border border-slate-800 shadow hover:border-slate-600 transition-colors";
            
            div.innerHTML = `
                <div class="flex justify-between items-end border-b border-slate-800 pb-1 mb-1.5">
                    <span class="text-slate-400 font-bold text-[10px] uppercase tracking-widest">${typeName}</span>
                    <span class="${group.color} font-cinzel font-bold text-xl leading-none drop-shadow-md">${val.total.toFixed(0)}</span>
                </div>
                <div class="grid grid-cols-3 gap-x-2 gap-y-1 text-[9px] text-slate-500 font-mono">
                    <div class="flex justify-between"><span>Base</span> <span class="text-slate-300 font-bold">${val.base}</span></div>
                    <div class="flex justify-between"><span>Nível</span> <span class="text-slate-300 font-bold">+${val.progressao.toFixed(0)}</span></div>
                    <div class="flex justify-between"><span>Equip</span> <span class="text-sky-400 font-bold">+${val.equipamentos}</span></div>
                    
                    <div class="flex justify-between"><span>Distrib</span> <span class="text-emerald-400 font-bold">+${val.distribuidos}</span></div>
                    <div class="flex justify-between"><span>Const</span> <span class="text-purple-400 font-bold">+${val.constelacao}</span></div>
                    <div class="flex justify-between"><span>Ego</span> <span class="text-pink-400 font-bold">+${val.ego || 0}</span></div>
                </div>
            `;
            el.appendChild(div);
        });
    });
}