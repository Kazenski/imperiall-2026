import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allRaces = [];
let typeCache = {}; // Mapeia IDs de tipo para Nomes

export async function renderRacasTab() {
    const container = document.getElementById('racas-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Raças</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Conheça as linhagens que caminham sobre as terras de Imperiall</p>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div id="racas-list-container" class="w-full relative">
                    <div class="flex flex-col items-center justify-center min-h-[300px]">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-lg text-slate-400 font-cinzel tracking-widest animate-pulse">Invocando Linhagens Ancestrais...</p>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim dos Registros de Raças</p>
            </div>
        </div>
    `;

    await fetchRacesData();
}

async function fetchRacesData() {
    const container = document.getElementById('racas-list-container');
    
    try {
        // Busca Tipos para traduzir IDs em Nomes (Cache)
        const typeSnap = await getDocs(collection(db, 'rpg_tipos'));
        typeSnap.docs.forEach(doc => {
            typeCache[doc.id] = doc.data().nome;
        });

        // Busca Raças
        const q = query(collection(db, 'rpg_racas'), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        allRaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (allRaces.length > 0) {
            renderRacesList();
        } else {
            if(container) container.innerHTML = `<div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400">Nenhuma raça encontrada no compêndio.</div>`;
        }

    } catch (error) {
        console.error("Erro ao carregar Raças:", error);
        if (container) {
            container.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">Os pergaminhos foram destruídos (Erro de conexão).</div>`;
        }
    }
}

function renderRacesList() {
    const container = document.getElementById('racas-list-container');
    if (!container) return;

    let html = '<div class="w-full flex flex-col gap-12 md:gap-16 animate-fade-in">';
    allRaces.forEach((race, index) => {
        html += generateRaceCard(race, index);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateRaceCard(race, index) {
    const imgUrl = race.imagemUrl || 'https://placehold.co/400x400/1e293b/a1a1aa?text=Sem+Retrato';
    const specialAbility = race.habilidadeRacial || "Nenhuma habilidade racial documentada.";

    // Renderizador de Tags para "Tipos" (Ex: Humanoide, Fera, etc)
    let tagsHTML = '<span class="text-slate-500 text-sm italic">Origem desconhecida</span>';
    if (race.tipos && Array.isArray(race.tipos) && race.tipos.length > 0) {
        tagsHTML = race.tipos.map(id => `
            <span class="px-3 py-1 bg-sky-900/30 border border-sky-700/50 text-sky-400 text-xs md:text-sm font-bold tracking-widest uppercase rounded-lg">
                ${escapeHTML(typeCache[id] || id)}
            </span>
        `).join('');
    }

    // Renderizador de Atributos Base
    const renderStat = (iconClass, colorClass, label, value) => `
        <div class="bg-slate-900/80 p-4 rounded-xl flex items-center gap-4 border border-slate-700 shadow-inner flex-1 min-w-[130px]">
            <div class="${colorClass} text-2xl w-8 text-center"><i class="fas ${iconClass}"></i></div>
            <div>
                <p class="text-[10px] md:text-xs text-slate-400 font-cinzel font-bold tracking-widest uppercase mb-0.5">${label}</p>
                <p class="text-xl md:text-2xl font-black text-white leading-none">${value || 0}</p>
            </div>
        </div>
    `;

    // Renderizador de Caixas Expansíveis para Textos Longos
    const renderExpandable = (title, text, iconClass, idPrefix) => {
        const content = text || 'Nenhuma informação registrada.';
        const uniqueId = `race-exp-${idPrefix}-${index}`;
        return `
            <div class="bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg relative h-full flex flex-col">
                <h3 class="text-xl md:text-2xl font-bold font-cinzel text-amber-400 mb-5 border-b border-slate-700/80 pb-3 flex items-center gap-3">
                    <i class="fas ${iconClass} text-slate-500"></i> ${title}
                </h3>
                <div id="content-${uniqueId}" class="relative transition-all duration-500 ease-in-out max-h-[120px] overflow-hidden flex-grow">
                    <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${escapeHTML(content)}</p>
                    <div id="fade-${uniqueId}" class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-800 via-slate-800/80 to-transparent pointer-events-none"></div>
                </div>
                <button onclick="window.racasCompendio.toggleExpand('${uniqueId}', this)" class="mt-4 text-amber-500 hover:text-amber-400 text-sm font-bold uppercase tracking-widest focus:outline-none flex items-center gap-2 transition-colors self-start">
                    Ler Mais <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
    };

    return `
        <article class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-8 group hover:border-amber-900/50 transition-colors">
            
            <div class="flex flex-col xl:flex-row gap-8 lg:gap-12 items-start">
                
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative cursor-pointer simulador-img-wrapper" onclick="window.racasCompendio.openImage('${imgUrl}')">
                        <div class="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-20 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"></div>
                        <img src="${imgUrl}" alt="${escapeHTML(race.nome)}" class="w-48 h-48 md:w-72 md:h-72 rounded-full object-cover border-4 border-amber-500 shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 hover:scale-105 transition-transform duration-500">
                        <div class="absolute bottom-4 right-4 bg-black/80 text-white p-3 md:p-4 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                            <i class="fas fa-expand-arrows-alt text-lg"></i>
                        </div>
                    </div>
                </div>

                <div class="flex-grow w-full flex flex-col justify-center">
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${tagsHTML}
                    </div>
                    
                    <h2 class="text-4xl md:text-5xl lg:text-6xl font-black font-cinzel text-white mb-8 drop-shadow-md border-b border-slate-700/80 pb-4">${escapeHTML(race.nome)}</h2>
                    
                    <div class="flex flex-wrap gap-4">
                        ${renderStat('fa-heart', 'text-red-500', 'HP Base', race.hpRacialBase)}
                        ${renderStat('fa-star', 'text-blue-400', 'MP Base', race.mpRacialBase)}
                        ${renderStat('fa-khanda', 'text-orange-500', 'ATK Bônus', race.bonusAtkRacaBase)}
                        ${renderStat('fa-shield-alt', 'text-sky-400', 'DEF Bônus', race.bonusDefRacaBase)}
                        ${renderStat('fa-feather-alt', 'text-emerald-400', 'EVA Bônus', race.bonusEvaRacaBase)}
                        ${renderStat('fa-shoe-prints', 'text-amber-400', 'Movimento', `${race.movimentacao || 0} Exp.`)}
                    </div>
                </div>
            </div>

            <div class="w-full bg-amber-900/10 p-6 md:p-8 rounded-2xl border border-amber-700/30 shadow-inner mt-2 relative overflow-hidden">
                <i class="fas fa-dna absolute -right-6 -top-6 text-9xl text-amber-500/5 pointer-events-none"></i>
                <h4 class="text-2xl font-bold font-cinzel text-amber-500 mb-4 flex items-center gap-3 relative z-10">
                    <i class="fas fa-star text-slate-500 text-lg"></i> Dádiva Racial
                </h4>
                <p class="text-amber-100/90 text-sm md:text-lg leading-relaxed whitespace-pre-wrap relative z-10 italic border-l-4 border-amber-500/50 pl-4 py-2">${escapeHTML(specialAbility)}</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
                ${renderExpandable('Cultura e Sociedade', race.culturaSociedade, 'fa-landmark', 'cult')}
                ${renderExpandable('Lendas e Mitos', race.lendasConhecidas, 'fa-book-dead', 'lend')}
            </div>

        </article>
    `;
}

// Funções globais de interação
window.racasCompendio = {
    toggleExpand: function(id, btnElement) {
        const contentDiv = document.getElementById(`content-${id}`);
        const fadeDiv = document.getElementById(`fade-${id}`);
        
        if (!contentDiv) return;

        if (contentDiv.classList.contains('max-h-[120px]')) {
            contentDiv.classList.remove('max-h-[120px]');
            contentDiv.classList.add('max-h-[3000px]'); 
            if (fadeDiv) fadeDiv.classList.add('hidden');
            btnElement.innerHTML = 'Ocultar <i class="fas fa-chevron-up"></i>';
        } else {
            contentDiv.classList.add('max-h-[120px]');
            contentDiv.classList.remove('max-h-[3000px]');
            if (fadeDiv) fadeDiv.classList.remove('hidden');
            btnElement.innerHTML = 'Ler Mais <i class="fas fa-chevron-down"></i>';
        }
    },
    openImage: function(url) {
        let modal = document.getElementById('global-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'global-image-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/95 hidden items-center justify-center p-4 cursor-pointer animate-fade-in';
            modal.onclick = function() { this.classList.add('hidden'); this.classList.remove('flex'); };
            modal.innerHTML = `
                <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
                <img id="global-modal-img" src="" class="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl border-4 border-slate-700 shadow-2xl">
            `;
            document.body.appendChild(modal);
        }
        
        const img = document.getElementById('global-modal-img');
        if (img) {
            img.src = url;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
};