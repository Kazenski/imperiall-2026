import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

const COLLECTION_ENTIDADES = 'rpg_entidadesPoderosas';
const TIPOS_DE_SER = ["Entidades Cósmicas", "Deuses Maiores", "Deuses Menores", "Titãs", "Semi Deuses"];

let allEntities = [];
let currentFilter = '';

export async function renderOsDeusesTab() {
    const container = document.getElementById('os-deuses-content');
    if (!container) return;

    // Estrutura Base da Página
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Entidades</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Consulte os Deuses, Titãs e Entidades que regem o universo de Imperiall</p>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div class="w-full max-w-2xl mx-auto mb-10 p-6 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl">
                    <label htmlFor="type-select" class="block text-sm md:text-base font-cinzel font-bold text-slate-300 mb-3 tracking-widest uppercase">
                        Filtrar por Tipo de Ser:
                    </label>
                    <div class="relative">
                        <select id="deuses-filter-select" class="appearance-none w-full px-5 py-4 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-base md:text-lg" onchange="window.osDeuses.applyFilter(this.value)">
                            <option value="" class="bg-slate-900">-- Selecione um Tipo --</option>
                            ${TIPOS_DE_SER.map(tipo => `<option value="${tipo}" class="bg-slate-900">${tipo}</option>`).join('')}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-amber-500">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>

                <div id="deuses-list-container" class="w-full relative">
                    <div class="flex flex-col items-center justify-center min-h-[300px]">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-lg text-slate-400 font-cinzel tracking-widest animate-pulse">Invocando Registros...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    await fetchEntities();
}

async function fetchEntities() {
    try {
        const q = query(collection(db, COLLECTION_ENTIDADES), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        allEntities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFilteredEntities();
    } catch (error) {
        console.error("Erro ao carregar entidades:", error);
        const listContainer = document.getElementById('deuses-list-container');
        if (listContainer) {
            listContainer.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">Erro ao carregar os dados. Os deuses não respondem.</div>`;
        }
    }
}

function renderFilteredEntities() {
    const container = document.getElementById('deuses-list-container');
    if (!container) return;

    if (!currentFilter) {
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[200px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                <p class="text-xl text-slate-500 font-cinzel tracking-widest">Selecione uma hierarquia acima para visualizar as entidades.</p>
            </div>
        `;
        return;
    }

    const filtered = allEntities.filter(e => e.tipoDeSer === currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[200px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full animate-fade-in">
                <p class="text-xl text-slate-500 font-cinzel tracking-widest">Nenhuma entidade catalogada nesta hierarquia.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="w-full flex flex-col gap-10 animate-fade-in">';
    filtered.forEach((entity, index) => {
        html += generateEntityCard(entity, index);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateEntityCard(entity, index) {
    const imgUrl = (entity.imageUrls && entity.imageUrls.imagem1) ? entity.imageUrls.imagem1 : 'https://placehold.co/400x400/1e293b/a1a1aa?text=Sem+Face';
    const supremacia = entity.supremacia || {};

    const renderStat = (iconClass, colorClass, label, value) => `
        <div class="bg-slate-900/80 p-4 rounded-xl flex items-center gap-4 border border-slate-700 shadow-inner flex-1 min-w-[120px]">
            <div class="${colorClass} text-2xl"><i class="fas ${iconClass}"></i></div>
            <div>
                <p class="text-[10px] md:text-xs text-slate-400 font-cinzel font-bold tracking-widest uppercase mb-0.5">${label}</p>
                <p class="text-2xl font-black text-white leading-none">${value || 0}</p>
            </div>
        </div>
    `;

    const renderExpandable = (title, text, iconClass, idPrefix) => {
        const content = text || 'Nenhuma informação revelada.';
        const uniqueId = `exp-${idPrefix}-${index}`;
        return `
            <div class="bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg relative">
                <h3 class="text-xl md:text-2xl font-bold font-cinzel text-amber-400 mb-5 border-b border-slate-700/80 pb-3 flex items-center gap-3">
                    <i class="fas ${iconClass} text-slate-500"></i> ${title}
                </h3>
                <div id="content-${uniqueId}" class="relative transition-all duration-500 ease-in-out max-h-[120px] overflow-hidden">
                    <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${escapeHTML(content)}</p>
                    <div id="fade-${uniqueId}" class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-800 via-slate-800/80 to-transparent pointer-events-none"></div>
                </div>
                <button onclick="window.osDeuses.toggleExpand('${uniqueId}', this)" class="mt-4 text-amber-500 hover:text-amber-400 text-sm font-bold uppercase tracking-widest focus:outline-none flex items-center gap-2 transition-colors">
                    Ler Mais <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
    };

    return `
        <div class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-8">
            
            <div class="flex flex-col xl:flex-row gap-8 items-start">
                
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative group cursor-pointer" onclick="window.osDeuses.openImage('${imgUrl}')">
                        <div class="absolute inset-0 bg-amber-500 rounded-full blur-md opacity-30 group-hover:opacity-60 transition-opacity"></div>
                        <img src="${imgUrl}" alt="${escapeHTML(entity.nome)}" class="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-amber-500 shadow-xl relative z-10">
                        <div class="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-black/80 text-white p-3 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <i class="fas fa-search-plus"></i>
                        </div>
                    </div>
                </div>

                <div class="flex-grow w-full">
                    <span class="inline-block px-3 py-1 bg-amber-900/30 border border-amber-700/50 text-amber-400 text-xs md:text-sm font-bold tracking-widest uppercase rounded-lg mb-3">
                        ${escapeHTML(entity.tipoDeSer || 'Entidade')}
                    </span>
                    <h2 class="text-4xl md:text-5xl font-black font-cinzel text-white mb-6 drop-shadow-md">${escapeHTML(entity.nome)}</h2>
                    
                    <h4 class="text-lg font-cinzel text-slate-400 mb-4 border-b border-slate-700 pb-2">Atributos Base</h4>
                    <div class="flex flex-wrap gap-4">
                        ${renderStat('fa-heart', 'text-red-500', 'HP', entity.hpMaxPersonagemBase)}
                        ${renderStat('fa-star', 'text-blue-400', 'MP', entity.mpMaxPersonagemBase)}
                        ${renderStat('fa-khanda', 'text-orange-500', 'ATK', entity.atk_base)}
                        ${renderStat('fa-shield-alt', 'text-sky-400', 'DEF', entity.def_base)}
                        ${renderStat('fa-feather-alt', 'text-emerald-400', 'EVA', entity.eva_base)}
                    </div>
                </div>
            </div>

            <div class="w-full bg-slate-900/50 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-inner">
                <h3 class="text-2xl font-bold font-cinzel text-amber-500 border-b border-slate-700/80 pb-3 mb-6"><i class="fas fa-hands-praying mr-2 text-slate-500"></i> Supremacia (Devoção)</h3>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                    <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-600 shadow-md flex flex-col h-full">
                        <h4 class="font-cinzel text-red-400 font-bold mb-3 flex items-center gap-2"><i class="fas fa-ban"></i> Restrições</h4>
                        <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap flex-grow">${escapeHTML(supremacia.restricoes || "Nenhuma")}</p>
                    </div>
                    <div class="bg-slate-800/80 p-5 rounded-xl border border-slate-600 shadow-md flex flex-col h-full">
                        <h4 class="font-cinzel text-sky-400 font-bold mb-3 flex items-center gap-2"><i class="fas fa-balance-scale"></i> Obrigações</h4>
                        <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap flex-grow">${escapeHTML(supremacia.obrigacoes || "Nenhuma")}</p>
                    </div>
                    <div class="bg-amber-900/20 p-5 rounded-xl border border-amber-700/50 shadow-md flex flex-col h-full">
                        <h4 class="font-cinzel text-amber-400 font-bold mb-3 flex items-center gap-2"><i class="fas fa-gift"></i> Bônus Especiais</h4>
                        <p class="text-amber-100/90 text-sm md:text-base leading-relaxed whitespace-pre-wrap flex-grow">${escapeHTML(supremacia.bonusEspeciais || "Nenhum")}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-6 w-full">
                ${renderExpandable('História', entity.historia, 'fa-book-journal-whills', 'hist')}
                ${renderExpandable('Características Físicas', entity.caracteristicasFisicas, 'fa-eye', 'fis')}
                ${renderExpandable('Curiosidades', entity.curiosidades, 'fa-scroll', 'cur')}
            </div>

        </div>
    `;
}

// Funções globais da página
window.osDeuses = {
    applyFilter: function(val) {
        currentFilter = val;
        renderFilteredEntities();
    },
    toggleExpand: function(id, btnElement) {
        const contentDiv = document.getElementById(`content-${id}`);
        const fadeDiv = document.getElementById(`fade-${id}`);
        
        if (!contentDiv) return;

        if (contentDiv.classList.contains('max-h-[120px]')) {
            // Expandir
            contentDiv.classList.remove('max-h-[120px]');
            contentDiv.classList.add('max-h-[3000px]'); // Um valor alto para garantir que cabe o texto todo
            if (fadeDiv) fadeDiv.classList.add('hidden');
            btnElement.innerHTML = 'Ocultar <i class="fas fa-chevron-up"></i>';
        } else {
            // Contrair
            contentDiv.classList.add('max-h-[120px]');
            contentDiv.classList.remove('max-h-[3000px]');
            if (fadeDiv) fadeDiv.classList.remove('hidden');
            btnElement.innerHTML = 'Ler Mais <i class="fas fa-chevron-down"></i>';
        }
    },
    openImage: function(url) {
        // Aproveita o modal global que usamos noutras telas, se não existir, cria um
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

