import { globalState } from '../core/state.js';
import { calculateDetailedStats, getFomeDebuffMultiplier } from '../core/calculos.js';
import { rollAttack, resolveSkillBaseDamage, getStat } from '../core/combate.js';

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

    const idsHabilidades = Object.keys(charData.ficha?.habilidades || {});
    if (idsHabilidades.length === 0) {
        select.innerHTML = '<option value="">Personagem não tem habilidades</option>';
        select.disabled = true;
        return;
    }

    select.innerHTML = '<option value="">Selecione uma habilidade</option>';
    idsHabilidades.forEach(id => {
        const hab = globalState.cache.habilidades.get(id);
        if (hab) select.add(new Option(hab.nome, id));
    });
    select.disabled = false;

    // O listener é ligado UMA vez. `removeEventListener` seguido de
    // `addEventListener` a cada render era desperdício (o elemento do <select>
    // sobrevive entre renders, então os doisPodiam coexistir).
    if (!select.dataset.combateBound) {
        select.dataset.combateBound = '1';
        select.addEventListener('change', calcularEExibirDetalhesCombate);
    }
}

function limparCalculadoraCombate() {
    const painel = document.getElementById('calc-combate-painel-calculo');
    const msg = document.getElementById('calc-combate-mensagem-status');
    const lista = document.getElementById('calc-combate-lista-atributos');
    const valorBase = document.getElementById('calc-combate-valor-base');

    if (painel) painel.classList.add('hidden');
    if (msg) {
        msg.classList.remove('hidden');
        msg.textContent = "Selecione um personagem e uma habilidade para calcular o poder.";
    }
    if (lista) lista.innerHTML = '';
    if (valorBase) valorBase.textContent = '0';
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
        if (msg) msg.textContent = "Erro: Habilidade não encontrada no cache.";
        return;
    }

    const ficha = allData.ficha;
    const nivelHabilidade = ficha.habilidades?.[habilidadeId]?.nivel ?? 1;

    // USA O HELPER COMUM: antes esta tela SOMAVA efeitoDanoBaseUsoHabilidade +
    // niveis[n].danoBaseHabilidade, enquanto a arena SUBSTITUIA. O numero
    // mostrado aqui nunca era o numero rolado no combate.
    const poderBase = resolveSkillBaseDamage(habilidade, nivelHabilidade);

    const valorBaseEl = document.getElementById('calc-combate-valor-base');
    if (valorBaseEl) valorBaseEl.textContent = poderBase;

    // Recalcula porInfluence para cada influencia e mostra o MESMO modelo
    // de dano que a arena usa (esquiva por EVA + mitigação por DEF).
    let htmlDetalhes = '';
    const influencias = habilidade.atributoInfluenciaHabilidade || [];
    const listaInfluencias = Array.isArray(influencias) ? influencias : [influencias];

    // Visão estatística detalhada por tipo (mantém a tabela existente)
    const statsFinais = calculateDetailedStats(allData);

    listaInfluencias.forEach(nomeAtributoCompleto => {
        const parsed = parseAttributeName(nomeAtributoCompleto);
        if (!parsed) return;

        const { category, type } = parsed;
        const statsRelevantes = statsFinais[category]?.[type];

        if (!statsRelevantes) return;

        // Simula N rolagens para dar a faixa real de dano, já com esquiva e mitigação.
        const amostras = simularDano({ habilidade, nivelHabilidade, ficha, targetEva: getStat(ficha, 'eva'), targetDef: getStat(ficha, 'def') });
        const poderFinalEstimado = amostras.media;

        const fomeMult = getFomeDebuffMultiplier(ficha);
        const fomeWarn = fomeMult < 1
            ? ` <span class="text-[10px] text-red-500" title="Debuff de Fome ativo">🍞</span>`
            : '';

        htmlDetalhes += `
            <div class="detalhe-item mb-4">
                <div class="flex justify-between items-center border-b border-slate-600 pb-1 mb-2">
                    <strong class="text-amber-400">${category} ${type}</strong>
                    <span class="text-xl font-bold text-emerald-400">${Math.round(statsRelevantes.total)}</span>
                </div>

                <div class="text-xs space-y-1 text-slate-300">
                    <div class="flex justify-between"><span>Base (Raça/Classe/Sub):</span> <span>${statsRelevantes.base}</span></div>
                    <div class="flex justify-between"><span>Progressão (Nível):</span> <span>+${Math.round(statsRelevantes.progressao)}</span></div>
                    <div class="flex justify-between"><span>Pontos Distribuídos:</span> <span class="text-sky-400">+${statsRelevantes.distribuidos}</span></div>
                    <div class="flex justify-between"><span>Constelação:</span> <span class="text-purple-400">+${statsRelevantes.constelacao}</span></div>
                    <div class="flex justify-between"><span>Equipamentos:</span> <span class="text-amber-500">+${statsRelevantes.equipamentos}</span></div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-700 bg-slate-900/50 p-2 rounded text-center">
                    <span class="text-[10px] uppercase tracking-widest text-slate-500">Dano Simulado (${amostras.n} rolagens)</span>
                    <div class="text-lg font-cinzel text-white">
                        ${poderBase} <span class="text-slate-500 text-sm">(Base)</span> + ${statsRelevantes.total} <span class="text-slate-500 text-sm">(Attr)</span>${fomeWarn}
                    </div>
                    <div class="mt-1 text-emerald-400 font-bold">
                        ≈ ${Math.round(poderFinalEstimado)} de dano
                        <span class="text-slate-500 text-xs">(min ${amostras.min} · máx ${amostras.max} · acerta ${amostras.acertou}/${amostras.n})</span>
                    </div>
                </div>
            </div>
        `;
    });

    const listaEl = document.getElementById('calc-combate-lista-atributos');
    const painelEl = document.getElementById('calc-combate-painel-calculo');

    if (listaEl) listaEl.innerHTML = htmlDetalhes || '<p>Nenhum atributo de influência encontrado.</p>';
    if (msg) msg.classList.add('hidden');
    if (painelEl) painelEl.classList.remove('hidden');
}

/**
 * Roda N simulações usando EXATAMENTE a mesma função da arena.
 * Assim a tela deixa de ser uma estimativa paralela e passa a refletir o
 * que realmente vai acontecer em combate.
 */
function simularDano({ habilidade, nivelHabilidade, ficha, targetEva, targetDef, n = 200 }) {
    let soma = 0, min = Infinity, max = 0, acertou = 0;

    for (let i = 0; i < n; i++) {
        const r = rollAttack({
            masterSkill: habilidade,
            skillLevel: nivelHabilidade,
            attacker: ficha,
            defender: { evaPersonagemBase: targetEva, defPersonagemBase: targetDef },
            fomeMult: getFomeDebuffMultiplier
        });
        soma += r.damage;
        min = Math.min(min, r.damage);
        max = Math.max(max, r.damage);
        if (!r.missed) acertou++;
    }

    return { media: soma / n, min: Math.round(min), max: Math.round(max), acertou, n };
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