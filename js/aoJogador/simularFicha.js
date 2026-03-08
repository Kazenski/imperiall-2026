import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

const simState = {
    tab: 'race', // 'race', 'class', 'ability', 'profession'
    indices: { race: 0, class: 0, profession: 0 },
    data: { races: [], classes: [], abilities: [], professions: [] },
    previousStats: {} 
};

export function renderSimularFichaTab() {
    const container = document.getElementById('simular-ficha-content');
    if (!container) return;

    simState.data.races = Array.from(globalState.cache.racas.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    simState.data.classes = Array.from(globalState.cache.classes.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    simState.data.professions = Array.from(globalState.cache.profissoes.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    
    updateAbilitiesForCurrentClass();

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 lg:p-10 overflow-y-auto custom-scroll relative pb-16">
            
            <header class="mb-6 w-full flex flex-col xl:flex-row items-center justify-between border-b border-slate-700 pb-6 gap-8">
                <div class="flex-1 w-full text-center xl:text-left">
                    <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel mb-2 text-blue-400 drop-shadow-md">
                        Forja do Aventureiro
                    </h1>
                    <p class="text-slate-400 text-sm md:text-base max-w-3xl leading-relaxed mx-auto xl:mx-0">
                        Simule combinações, acompanhe o impacto nos atributos e tenha uma visão completa do arsenal do seu próximo herói épico.
                    </p>
                </div>
                <div id="simulador-summary" class="w-full xl:w-auto shrink-0 flex justify-center relative z-50"></div>
            </header>

            <div class="flex justify-center border-b border-slate-600 mb-8 flex-wrap w-full gap-4">
                <button onclick="window.simulador.setTab('race')" id="sim-tab-race" class="sim-tab font-cinzel text-base md:text-lg px-6 md:px-10 py-3 transition-colors duration-200 border-b-4 border-blue-500 text-blue-400 font-bold tracking-widest outline-none">1. Raça</button>
                <button onclick="window.simulador.setTab('class')" id="sim-tab-class" class="sim-tab font-cinzel text-base md:text-lg px-6 md:px-10 py-3 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">2. Classe</button>
                <button onclick="window.simulador.setTab('ability')" id="sim-tab-ability" class="sim-tab font-cinzel text-base md:text-lg px-6 md:px-10 py-3 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">3. Habilidades</button>
                <button onclick="window.simulador.setTab('profession')" id="sim-tab-profession" class="sim-tab font-cinzel text-base md:text-lg px-6 md:px-10 py-3 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">4. Profissões</button>
            </div>

            <div id="simulador-carousel-area" class="w-full flex-grow flex flex-col items-center"></div>
        </div>

        <div id="simulador-image-modal" class="fixed inset-0 bg-black/95 hidden items-center justify-center z-[100] p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
            <img id="simulador-modal-img" src="" class="max-w-[95vw] max-h-[95vh] rounded-2xl border-4 border-slate-700 shadow-2xl object-contain">
        </div>
    `;

    renderUI();
}

function updateAbilitiesForCurrentClass() {
    const currentClass = simState.data.classes[simState.indices.class];
    if (currentClass && currentClass.id) {
        simState.data.abilities = Array.from(globalState.cache.habilidades.values())
            .filter(hab => hab.restricaoClasses && hab.restricaoClasses.includes(currentClass.id))
            .sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    } else {
        simState.data.abilities = [];
    }
}

function renderUI() {
    renderSummary();
    renderTabs();
    renderCarouselOrGrid();
}

function renderSummary() {
    const summaryContainer = document.getElementById('simulador-summary');
    if (!summaryContainer) return;

    const race = simState.data.races[simState.indices.race] || {};
    const cls = simState.data.classes[simState.indices.class] || {};

    const newStats = {
        hp: (Number(race.hpRacialBase) || 0) + (Number(cls.bonusHpClasseBase) || 0),
        mp: (Number(race.mpRacialBase) || 0) + (Number(cls.bonusMpClasseBase) || 0),
        atk: (Number(race.bonusAtkRacaBase) || 0) + (Number(cls.poderAtaque) || 0),
        def: (Number(race.bonusDefRacaBase) || 0) + (Number(cls.capacidadeDefesa) || 0),
        eva: (Number(race.bonusEvaRacaBase) || 0)
    };

    const oldStats = simState.previousStats || {};

    const attrHTML = (key, label, val) => {
        let diffHTML = '';
        if (oldStats[key] !== undefined && oldStats[key] !== val) {
            const diff = val - oldStats[key];
            const color = diff > 0 ? 'text-emerald-400' : 'text-red-500';
            const icon = diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const signal = diff > 0 ? '+' : '';
            
            diffHTML = `<div class="absolute -top-12 right-0 left-0 flex justify-center ${color} font-black text-2xl md:text-3xl animate-float-up pointer-events-none z-[9999]">
                            <span class="flex items-center gap-1"><i class="fas ${icon} text-lg"></i> ${signal}${diff}</span>
                        </div>`;
        }

        return `
            <div class="relative bg-slate-800/90 p-3 md:p-4 rounded-xl text-center shadow-lg border border-slate-700/50 flex-1 min-w-[70px] lg:min-w-[85px]">
                ${diffHTML}
                <div class="text-[10px] md:text-xs font-cinzel text-blue-400 tracking-widest font-bold mb-1">${label}</div>
                <div class="text-2xl md:text-4xl font-black text-white leading-none">${val}</div>
            </div>
        `;
    };

    summaryContainer.innerHTML = `
        <div class="bg-slate-900/80 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-slate-700/60 shadow-xl flex flex-col md:flex-row items-center gap-5 relative">
            <h2 class="font-cinzel text-slate-400 tracking-widest uppercase md:border-r border-slate-700 md:pr-5 text-xs font-bold shrink-0">Status</h2>
            <div class="flex flex-wrap md:flex-nowrap justify-center gap-2 sm:gap-4 w-full overflow-visible">
                ${attrHTML('hp', 'HP', newStats.hp)}
                ${attrHTML('mp', 'MP', newStats.mp)}
                ${attrHTML('atk', 'ATK', newStats.atk)}
                ${attrHTML('def', 'DEF', newStats.def)}
                ${attrHTML('eva', 'EVA', newStats.eva)}
            </div>
        </div>
    `;

    simState.previousStats = { ...newStats };
}

function renderTabs() {
    document.querySelectorAll('.sim-tab').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-400', 'font-bold');
        btn.classList.add('border-transparent', 'text-slate-400');
    });
    const activeBtn = document.getElementById(`sim-tab-${simState.tab}`);
    if (activeBtn) {
        activeBtn.classList.add('border-blue-500', 'text-blue-400', 'font-bold');
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
    }
}

function renderCarouselOrGrid() {
    const area = document.getElementById('simulador-carousel-area');
    if (!area) return;

    let items = [];
    let placeholder = '';
    let extraHeader = '';

    if (simState.tab === 'race') items = simState.data.races;
    if (simState.tab === 'class') items = simState.data.classes;
    if (simState.tab === 'profession') items = simState.data.professions;

    // --- GRID DE HABILIDADES ---
    if (simState.tab === 'ability') {
        items = simState.data.abilities;
        const clsName = simState.data.classes[simState.indices.class]?.nome || 'Nenhuma';
        
        extraHeader = `
            <div class="text-center mb-6 w-full">
                <h4 class="font-cinzel text-lg text-slate-400 mb-1">Grimório de Habilidades</h4>
                <p class="text-4xl font-bold text-amber-500 mb-4 drop-shadow-md">${escapeHTML(clsName)}</p>
                <div class="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl max-w-3xl mx-auto inline-block">
                    <p class="text-sm text-slate-300 italic">
                        Quantidade inicial: <strong class="text-amber-400">1d6</strong> | Nível máximo: <strong class="text-amber-400">1d20</strong>.
                    </p>
                </div>
            </div>
        `;

        if (items.length === 0) {
            area.innerHTML = extraHeader + `<div class="text-center text-slate-400 py-16 w-full bg-slate-800/50 rounded-[2rem] border border-slate-700 border-dashed text-lg">Nenhuma habilidade encontrada para esta classe.</div>`;
            return;
        }

        let gridHTML = `<div class="w-full grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 animate-fade-in mt-4 items-start">`;
        
        items.forEach((hab, idx) => {
            const desc = hab.descricaoEfeito || hab.efeito || 'Não informado.';
            
            // AQUI ESTÁ A MUDANÇA: 'rounded-full' transforma a imagem num círculo perfeito
            const imgHTML = hab.imagemUrl
                ? `<img src="${hab.imagemUrl}" alt="Icon" class="w-20 h-20 rounded-full object-cover border-2 border-slate-500 shadow-md shrink-0 cursor-pointer hover:scale-105 hover:border-amber-400 transition-all" onclick="window.simulador.openImage('${hab.imagemUrl}')">`
                : `<div class="w-20 h-20 rounded-full border-2 border-slate-600 bg-slate-800 flex items-center justify-center shrink-0 shadow-md"><i class="fas fa-magic text-3xl text-slate-500"></i></div>`;

            gridHTML += `
                <div class="bg-slate-800/80 p-5 md:p-6 rounded-2xl border border-slate-600/50 shadow-xl flex items-start gap-5 hover:border-amber-500/60 transition-colors group h-full flex-col">
                    <div class="flex items-start gap-5 w-full">
                        ${imgHTML}
                        <div class="flex-1 flex flex-col min-w-0">
                            <h4 class="font-cinzel text-xl text-blue-400 font-bold mb-2 border-b border-slate-700/50 pb-1 truncate" title="${escapeHTML(hab.nome)}">${escapeHTML(hab.nome)}</h4>
                            <div class="relative">
                                <p id="hab-desc-${idx}" class="text-slate-300 text-sm leading-relaxed line-clamp-5 transition-all duration-300 overflow-hidden">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
                                <button onclick="window.simulador.toggleReadMore('hab-desc-${idx}', this)" class="text-amber-500 hover:text-amber-400 text-xs font-bold uppercase tracking-widest mt-2 focus:outline-none flex items-center gap-1">
                                    Ler Mais <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 shadow-inner flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                            <span class="text-[10px] text-slate-400 font-cinzel tracking-widest uppercase mb-1">Custo</span>
                            <span class="text-2xl font-black text-amber-500 drop-shadow-md group-hover:scale-110 transition-transform">${escapeHTML(hab.custoAprendizado || 'N/A')}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        gridHTML += `</div>`;

        area.innerHTML = extraHeader + gridHTML;
        return;
    }

    // --- CARROSSEL ---
    
    if (simState.tab === 'profession') {
        extraHeader = `
            <div class="text-center mb-6 w-full">
                <div class="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl max-w-3xl mx-auto inline-block">
                    <p class="text-sm md:text-base text-slate-300 italic leading-relaxed">
                        Requer Guilda ou Mestre. <strong class="text-amber-500">Permitido registrar apenas a partir do Nível 5.</strong>
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-16 w-full bg-slate-800/50 rounded-[2rem] border border-slate-700 border-dashed text-lg">Nenhuma profissão encontrada.</div>`;
    }

    if (items.length === 0) {
        area.innerHTML = extraHeader + placeholder;
        return;
    }

    const currentIndex = simState.indices[simState.tab];
    const currentItem = items[currentIndex];

    const navHTML = `
        <div class="flex items-center justify-center mb-8 gap-6 w-full">
            <button onclick="window.simulador.prev()" class="p-3 px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-md focus:outline-none">
                <i class="fas fa-chevron-left text-xl"></i>
            </button>
            <div class="font-mono text-2xl text-slate-200 font-bold min-w-[100px] text-center bg-slate-900 px-5 py-2 rounded-xl border border-slate-700 shadow-inner">
                ${currentIndex + 1} <span class="text-slate-500 text-lg mx-1">/</span> ${items.length}
            </div>
            <button onclick="window.simulador.next()" class="p-3 px-4 bg-slate-800 text-slate-300 rounded-xl hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-md focus:outline-none">
                <i class="fas fa-chevron-right text-xl"></i>
            </button>
        </div>
    `;

    const cardHTML = generateCardHTML(currentItem, simState.tab);

    area.innerHTML = `
        ${extraHeader}
        ${navHTML}
        <div class="w-full animate-fade-in flex justify-center">
            ${cardHTML}
        </div>
    `;
}

function generateCardHTML(item, type) {
    const isClass = type === 'class';
    const isRace = type === 'race';
    const desc = item.descricao || item.habilidadeEspecialClasse || 'Não informado.';
    
    let leftImgHTML = '';
    if (item.imagemUrl) {
        leftImgHTML = `
            <div class="w-full sm:w-[18rem] xl:w-[24rem] shrink-0 mx-auto xl:mx-0 simulador-img-wrapper cursor-pointer group" onclick="window.simulador.openImage('${item.imagemUrl}')">
                <div class="simulador-img-glow"></div>
                <img src="${item.imagemUrl}" alt="${escapeHTML(item.nome)}" class="simulador-img aspect-[4/5]">
                <div class="absolute bottom-4 right-4 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm text-lg">
                    <i class="fas fa-expand-arrows-alt"></i>
                </div>
            </div>
        `;
    }

    let specificContentHTML = '';

    if (isRace) {
        const hasLendas = !!item.lendasConhecidas;
        specificContentHTML += `
            <div class="w-full grid grid-cols-1 ${hasLendas ? 'lg:grid-cols-2' : ''} gap-6 h-full items-stretch">
                <div class="bg-slate-900/40 p-6 md:p-8 rounded-2xl border border-slate-700/50 flex flex-col shadow-inner h-full">
                    <h4 class="font-cinzel text-xl mb-4 text-blue-400 flex items-center gap-3 border-b border-slate-700/50 pb-3"><i class="fas fa-landmark text-slate-500"></i> Cultura e Sociedade</h4>
                    <p class="text-slate-300 text-base leading-loose flex-grow">${escapeHTML(item.culturaSociedade || '').replace(/\n/g, '<br>')}</p>
                </div>
        `;
        if (hasLendas) {
            specificContentHTML += `
                <div class="bg-amber-900/10 p-6 md:p-8 rounded-2xl border border-amber-900/30 flex flex-col shadow-inner h-full">
                    <h4 class="font-cinzel text-xl mb-4 text-amber-500 flex items-center gap-3 border-b border-amber-900/40 pb-3"><i class="fas fa-book-dead text-slate-500"></i> Lendas Conhecidas</h4>
                    <p class="text-amber-100/80 text-base leading-loose italic flex-grow">${escapeHTML(item.lendasConhecidas).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        specificContentHTML += `</div>`;
    }

    if (isClass) {
        const attrs = [
            { k: 'Ataque', v: item.poderAtaque },
            { k: 'Defesa', v: item.capacidadeDefesa },
            { k: 'Controle', v: item.controleGrupo },
            { k: 'Escala', v: item.escalabilidade },
            { k: 'Utilidade', v: item.utilidadeGrupo },
            { k: 'Fácil', v: item.facilidade }
        ].filter(a => a.v >= 2);

        specificContentHTML += `
            <div class="w-full flex flex-col gap-6 h-full items-stretch">
                <div class="w-full bg-slate-900/40 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-inner flex-grow">
                    <h4 class="font-cinzel text-xl mb-4 text-blue-400 border-b border-slate-700/50 pb-3 flex items-center gap-3"><i class="fas fa-scroll text-slate-500"></i> Descrição</h4>
                    <p class="text-slate-300 text-base leading-loose">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
                </div>
        `;
        if (attrs.length > 0) {
            specificContentHTML += `
                <div class="w-full bg-slate-900/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-inner">
                    <h4 class="font-cinzel text-xl mb-5 text-emerald-400 flex items-center gap-3 border-b border-slate-700/50 pb-3"><i class="fas fa-chart-radar text-slate-500"></i> Atributos em Foco</h4>
                    <div class="flex flex-wrap gap-3 mt-2">
                        ${attrs.map(a => `<span class="bg-slate-950 border border-emerald-900/50 text-slate-200 px-4 py-2 rounded-xl text-sm shadow-md font-medium tracking-wide cursor-default">${a.k} <span class="text-amber-400 font-bold ml-2">${a.v}</span></span>`).join('')}
                    </div>
                </div>
            `;
        }
        specificContentHTML += `</div>`;
    }

    if (!isRace && !isClass) {
        specificContentHTML += `
            <div class="w-full bg-slate-900/40 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-inner h-full flex-grow">
                <h4 class="font-cinzel text-xl mb-4 text-blue-400 border-b border-slate-700/50 pb-3 flex items-center gap-3"><i class="fas fa-scroll text-slate-500"></i> Descrição</h4>
                <p class="text-slate-300 text-base leading-loose">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }

    return `
        <div class="simulador-card w-full p-6 md:p-10 lg:p-12 rounded-[2.5rem] border border-slate-600/50 shadow-2xl flex flex-col gap-8 items-start mx-auto">
            
            <h3 class="font-cinzel text-3xl sm:text-4xl md:text-5xl font-bold text-white border-b-2 border-slate-700/80 pb-4 tracking-wide w-full drop-shadow-md text-center xl:text-left">${escapeHTML(item.nome || 'Desconhecido')}</h3>
            
            <div class="w-full flex flex-col xl:flex-row gap-8 xl:gap-12 items-stretch">
                ${leftImgHTML}
                <div class="flex-1 w-full flex flex-col gap-6 items-start h-full">
                    ${specificContentHTML}
                </div>
            </div>

        </div>
    `;
}

window.simulador = {
    setTab: function(tabName) {
        simState.tab = tabName;
        renderUI();
    },
    next: function() {
        const max = simState.data[simState.tab === 'profession' ? 'professions' : simState.tab === 'race' ? 'races' : 'classes'].length;
        if(max <= 1) return;
        simState.indices[simState.tab] = (simState.indices[simState.tab] + 1) % max;
        if(simState.tab === 'class') updateAbilitiesForCurrentClass();
        renderUI();
    },
    prev: function() {
        const max = simState.data[simState.tab === 'profession' ? 'professions' : simState.tab === 'race' ? 'races' : 'classes'].length;
        if(max <= 1) return;
        simState.indices[simState.tab] = (simState.indices[simState.tab] - 1 + max) % max;
        if(simState.tab === 'class') updateAbilitiesForCurrentClass();
        renderUI();
    },
    openImage: function(src) {
        const modal = document.getElementById('simulador-image-modal');
        const img = document.getElementById('simulador-modal-img');
        if(modal && img) {
            img.src = src;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },
    toggleReadMore: function(descId, btn) {
        const descEl = document.getElementById(descId);
        if(!descEl) return;
        if (descEl.classList.contains('line-clamp-5')) {
            descEl.classList.remove('line-clamp-5');
            btn.innerHTML = 'Mostrar Menos <i class="fas fa-chevron-up"></i>';
        } else {
            descEl.classList.add('line-clamp-5');
            btn.innerHTML = 'Ler Mais <i class="fas fa-chevron-down"></i>';
        }
    }
};