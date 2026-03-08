import { globalState } from '../core/state.js';
import { calculateDetailedStats } from '../core/calculos.js';

export function renderCalculadoraCombate() {
    const select = document.getElementById('calc-combate-habilidade-select');
    if (!select) return;

    limparCalculadoraCombate();
    
    const charData = globalState.selectedCharacterData;
    if (!charData) {
        select.innerHTML = '<option value="">Selecione um personagem</option>';
        select.disabled = true;
        return;
    }

    const idsHabilidades = Object.keys(charData.ficha.habilidades || {});
    if (idsHabilidades.length === 0) {
        select.innerHTML = '<option value="">Personagem não tem habilidades</option>';
        select.disabled = true;
        return;
    }
    
    select.innerHTML = '<option value="">Selecione uma habilidade</option>';
    idsHabilidades.forEach(id => {
        const hab = globalState.cache.habilidades.get(id);
        if (hab) {
            select.add(new Option(hab.nome, id));
        }
    });
    select.disabled = false;

    // Garante que o evento de change está atrelado apenas uma vez
    select.removeEventListener('change', calcularEExibirDetalhesCombate);
    select.addEventListener('change', calcularEExibirDetalhesCombate);
}

function limparCalculadoraCombate() {
    const painel = document.getElementById('calc-combate-painel-calculo');
    const msg = document.getElementById('calc-combate-mensagem-status');
    const lista = document.getElementById('calc-combate-lista-atributos');
    const valorBase = document.getElementById('calc-combate-valor-base');

    if(painel) painel.classList.add('hidden');
    if(msg) {
        msg.classList.remove('hidden');
        msg.textContent = "Selecione um personagem e uma habilidade para calcular o poder.";
    }
    if(lista) lista.innerHTML = '';
    if(valorBase) valorBase.textContent = '0';
}

function calcularEExibirDetalhesCombate() {
    const select = document.getElementById('calc-combate-habilidade-select');
    const habilidadeId = select ? select.value : null;
    const allData = globalState.selectedCharacterData;
    
    if (!habilidadeId || !allData) {
        limparCalculadoraCombate(); 
        return;
    }

    const habilidade = globalState.cache.habilidades.get(habilidadeId);
    const msg = document.getElementById('calc-combate-mensagem-status');
    
    if (!habilidade) {
        limparCalculadoraCombate();
        if(msg) msg.textContent = "Erro: Habilidade não encontrada no cache.";
        return;
    }
    
    const ficha = allData.ficha;
    const statsFinais = calculateDetailedStats(allData);

    const nivelHabilidade = ficha.habilidades[habilidadeId]?.nivel ?? 1;
    const poderBase = nivelHabilidade > 1     
        ? ((habilidade.efeitoDanoBaseUsoHabilidade ?? 0) + (habilidade.niveis?.[nivelHabilidade]?.danoBaseHabilidade ?? 0))
        : (habilidade.efeitoDanoBaseUsoHabilidade ?? 0);
    
    const valorBaseEl = document.getElementById('calc-combate-valor-base');
    if(valorBaseEl) valorBaseEl.textContent = poderBase;

    let htmlDetalhes = '';
    const influencias = habilidade.atributoInfluenciaHabilidade || [];
    
    // Suporte para string ou array no banco de dados
    const listaInfluencias = Array.isArray(influencias) ? influencias : [influencias];

    listaInfluencias.forEach(nomeAtributoCompleto => {
        const parsed = parseAttributeName(nomeAtributoCompleto);
        if (!parsed) return;

        const { category, type } = parsed;
        const statsRelevantes = statsFinais[category]?.[type];

        if (statsRelevantes) {
            const poderFinalEstimado = poderBase + statsRelevantes.total;

            htmlDetalhes += `
                <div class="detalhe-item mb-4">
                    <div class="flex justify-between items-center border-b border-slate-600 pb-1 mb-2">
                        <strong class="text-amber-400">${category} ${type}</strong>
                        <span class="text-xl font-bold text-emerald-400">${statsRelevantes.total.toFixed(0)}</span>
                    </div>
                    
                    <div class="text-xs space-y-1 text-slate-300">
                        <div class="flex justify-between"><span>Base (Raça/Classe/Sub):</span> <span>${statsRelevantes.base}</span></div>
                        <div class="flex justify-between"><span>Progressão (Nível):</span> <span>+${statsRelevantes.progressao.toFixed(0)}</span></div>
                        <div class="flex justify-between"><span>Pontos Distribuídos:</span> <span class="text-sky-400">+${statsRelevantes.distribuidos}</span></div>
                        <div class="flex justify-between"><span>Constelação:</span> <span class="text-purple-400">+${statsRelevantes.constelacao}</span></div>
                        <div class="flex justify-between"><span>Equipamentos:</span> <span class="text-amber-500">+${statsRelevantes.equipamentos}</span></div>
                    </div>

                    <div class="mt-2 pt-2 border-t border-slate-700 bg-slate-900/50 p-2 rounded text-center">
                        <span class="text-[10px] uppercase tracking-widest text-slate-500">Poder Final Estimado</span>
                        <div class="text-lg font-cinzel text-white">
                            ${poderBase} <span class="text-slate-500 text-sm">(Base)</span> + ${statsRelevantes.total.toFixed(0)} <span class="text-slate-500 text-sm">(Attr)</span>
                            = <span class="text-amber-400 font-bold">${poderFinalEstimado.toFixed(0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    const listaEl = document.getElementById('calc-combate-lista-atributos');
    const painelEl = document.getElementById('calc-combate-painel-calculo');

    if(listaEl) listaEl.innerHTML = htmlDetalhes || '<p>Nenhum atributo de influência encontrado.</p>';
    if(msg) msg.classList.add('hidden');
    if(painelEl) painelEl.classList.remove('hidden');
}

function parseAttributeName(fullName) {
    if (!fullName || typeof fullName !== 'string') return null;
    let category = null;
    if (fullName.includes('Ataque')) category = 'Ataque';
    else if (fullName.includes('Defesa')) category = 'Defesa';
    else if (fullName.includes('Evasao')) category = 'Evasao';
    
    if (!category) return null;
    const type = fullName.replace('bonus', '').replace(category, '').replace('HabilidadeBase', '');
    return { category, type };
}