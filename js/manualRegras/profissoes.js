import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allProfessions = [];

export async function renderProfissoesTab() {
    const container = document.getElementById('profissoes-regras-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Profissões</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Os ofícios que forjam a economia e a sobrevivência do mundo</p>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div id="profissoes-list-container" class="w-full relative">
                    <div class="flex flex-col items-center justify-center min-h-[300px]">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-lg text-slate-400 font-cinzel tracking-widest animate-pulse">Lendo os Registros das Guildas...</p>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim dos Registros das Guildas</p>
            </div>
        </div>
    `;

    await fetchProfessionsData();
}

async function fetchProfessionsData() {
    const container = document.getElementById('profissoes-list-container');
    
    try {
        const q = query(collection(db, 'rpg_profissoes'), orderBy("nome"));
        const snapshot = await getDocs(q);
        
        allProfessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (allProfessions.length > 0) {
            renderProfessionsList();
        } else {
            if(container) container.innerHTML = `<div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400">Nenhum ofício registrado pelas Guildas.</div>`;
        }

    } catch (error) {
        console.error("Erro ao carregar Profissões:", error);
        if (container) {
            container.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">As bibliotecas das Guildas estão inacessíveis (Erro de conexão).</div>`;
        }
    }
}

function renderProfessionsList() {
    const container = document.getElementById('profissoes-list-container');
    if (!container) return;

    let html = '<div class="w-full flex flex-col gap-12 md:gap-16 animate-fade-in">';
    allProfessions.forEach((prof, index) => {
        html += generateProfessionCard(prof, index);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateProfessionCard(prof, index) {
    const imgUrl = prof.imagemUrl || 'https://placehold.co/400x400/1e293b/a1a1aa?text=Sem+Retrato';
    
    // Renderiza Missões (Acordeões)
    let missoesHTML = '';
    const missionsMap = prof.missoesEvolucao || {};
    const sortedMissionKeys = Object.keys(missionsMap).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''));
        const numB = parseInt(b.replace(/\D/g, ''));
        return numA - numB;
    });

    if (sortedMissionKeys.length > 0) {
        missoesHTML = `
            <div class="w-full bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg mt-6">
                <h4 class="text-2xl font-bold font-cinzel text-amber-500 mb-6 border-b border-slate-700/80 pb-3 flex items-center gap-3">
                    <i class="fas fa-award text-slate-500"></i> Provações de Evolução
                </h4>
                <div class="space-y-4">
                    ${sortedMissionKeys.map(levelKey => {
                        const mission = missionsMap[levelKey];
                        const accId = `prof-${index}-missao-${levelKey}`;
                        return `
                            <div class="bg-slate-900/80 rounded-xl border border-slate-600 overflow-hidden shadow-sm transition-colors hover:border-slate-500">
                                <button class="w-full flex justify-between items-center p-5 text-left focus:outline-none group" onclick="window.profissoesCompendio.toggleAccordion('${accId}', this)">
                                    <span class="text-lg font-bold text-amber-400 font-cinzel tracking-widest uppercase flex items-center gap-3">
                                        <span class="bg-amber-900/50 text-amber-300 px-3 py-1 rounded-lg text-sm">${levelKey.toUpperCase()}</span>
                                        ${escapeHTML(mission.nomeQuest || "Missão Desconhecida")}
                                    </span>
                                    <i class="fas fa-chevron-down text-slate-500 group-hover:text-amber-400 transition-colors"></i>
                                </button>
                                
                                <div id="content-${accId}" class="max-h-0 overflow-hidden transition-all duration-300 ease-in-out px-5">
                                    <div class="border-t border-slate-700/50 py-5 space-y-5">
                                        <div>
                                            <h5 class="text-sm font-semibold text-slate-400 flex items-center gap-2 mb-2 uppercase tracking-widest font-cinzel"><i class="fas fa-info-circle text-sky-400"></i> O Objetivo</h5>
                                            <p class="text-slate-300 text-base leading-relaxed bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">${escapeHTML(mission.descricaoQuest || "Sem detalhes.")}</p>
                                        </div>
                                        <div>
                                            <h5 class="text-sm font-semibold text-slate-400 flex items-center gap-2 mb-2 uppercase tracking-widest font-cinzel"><i class="fas fa-lightbulb text-amber-400"></i> Notas do Mestre da Guilda</h5>
                                            <p class="text-amber-100/80 text-sm md:text-base italic leading-relaxed bg-amber-900/10 p-4 rounded-lg border border-amber-700/30">${escapeHTML(mission.dicasMestre || "Sem anotações.")}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        missoesHTML = `
            <div class="w-full bg-slate-800/60 p-6 rounded-2xl border border-slate-700 shadow-inner mt-6 text-center">
                <p class="text-slate-500 italic"><i class="fas fa-scroll mr-2"></i>Nenhuma provação de evolução registrada.</p>
            </div>
        `;
    }

    return `
        <article class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-6 group hover:border-amber-900/50 transition-colors">
            
            <div class="flex flex-col xl:flex-row gap-8 lg:gap-12 items-start">
                
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative cursor-pointer simulador-img-wrapper" onclick="window.profissoesCompendio.openImage('${imgUrl}')">
                        <div class="absolute inset-0 bg-emerald-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"></div>
                        <img src="${imgUrl}" alt="${escapeHTML(prof.nome)}" class="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-slate-600 group-hover:border-emerald-500 shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 transition-colors duration-500">
                        <div class="absolute bottom-4 right-4 bg-black/80 text-white p-3 md:p-4 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                            <i class="fas fa-expand-arrows-alt text-lg"></i>
                        </div>
                    </div>
                </div>

                <div class="flex-grow w-full flex flex-col justify-center">
                    <div class="flex items-center gap-4 mb-4">
                        <span class="bg-slate-950/80 border border-slate-700 px-4 py-1.5 rounded-lg flex items-center shadow-md">
                            <i class="fas fa-star text-amber-500 mr-2"></i>
                            <span class="text-slate-400 text-sm font-bold uppercase tracking-widest mr-2">Nível Requerido:</span>
                            <span class="font-black text-xl text-white">${prof.levelRequerido || 1}</span>
                        </span>
                    </div>
                    
                    <h2 class="text-4xl md:text-5xl lg:text-6xl font-black font-cinzel text-white mb-6 drop-shadow-md">${escapeHTML(prof.nome)}</h2>
                    
                    <div class="bg-slate-900/60 p-6 rounded-2xl border border-slate-700 shadow-inner">
                        <h4 class="text-sm font-cinzel font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-book-open"></i> O Ofício</h4>
                        <p class="text-slate-300 text-base md:text-lg leading-relaxed whitespace-pre-wrap">${escapeHTML(prof.descricao || "Nenhuma descrição informada.")}</p>
                    </div>
                </div>
            </div>

            ${missoesHTML}

        </article>
    `;
}

// Funções globais de interação
window.profissoesCompendio = {
    toggleAccordion: function(id, btnElement) {
        const contentDiv = document.getElementById(`content-${id}`);
        const icon = btnElement.querySelector('i.fa-chevron-down, i.fa-chevron-up');
        
        if (!contentDiv) return;

        if (contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px') {
            // Fechar
            contentDiv.style.maxHeight = '0px';
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                icon.classList.remove('text-amber-400');
            }
        } else {
            // Abrir
            contentDiv.style.maxHeight = contentDiv.scrollHeight + 100 + "px"; // +100px para garantir que o padding não corta o conteúdo
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                icon.classList.add('text-amber-400');
            }
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