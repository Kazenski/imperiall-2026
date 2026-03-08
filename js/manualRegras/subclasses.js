import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query, documentId, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allClasses = [];
let allSkills = [];

export async function renderSubclassesTab() {
    const container = document.getElementById('subclasses-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Subclasses</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Especialize as suas habilidades e escolha o seu destino</p>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div class="w-full max-w-2xl mx-auto mb-10 p-6 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl relative z-20">
                    <label htmlFor="class-select" class="block text-sm md:text-base font-cinzel font-bold text-slate-300 mb-3 tracking-widest uppercase">
                        Selecione a Classe de Origem:
                    </label>
                    <div class="relative">
                        <select id="subclass-class-dropdown" class="appearance-none w-full px-5 py-4 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-base md:text-lg" onchange="window.subclassesCompendio.selectClass(this.value)">
                            <option value="" class="bg-slate-900 text-slate-400">Buscando Manuais...</option>
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-amber-500">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>

                <div id="subclasses-list-container" class="w-full relative z-10">
                    <div class="flex items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                        <div class="flex flex-col items-center">
                            <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" id="subclass-loading-spinner"></div>
                            <p class="text-xl text-slate-500 font-cinzel tracking-widest" id="subclass-loading-text">Buscando registros...</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim das Ramificações</p>
            </div>
        </div>
    `;

    await fetchInitialData();
}

async function fetchInitialData() {
    const selectEl = document.getElementById('subclass-class-dropdown');
    const loadingSpinner = document.getElementById('subclass-loading-spinner');
    const loadingText = document.getElementById('subclass-loading-text');

    try {
        // Busca Classes e Habilidades em paralelo
        const [classSnap, skillSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_classes'), orderBy("nome"))),
            getDocs(collection(db, 'rpg_habilidades'))
        ]);

        allSkills = skillSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allClasses = classSnap.docs.map(doc => ({ 
            id: doc.id, 
            name: doc.data().nome,
            subclasses: doc.data().subclasses || [] 
        }));
        
        // Preenche o dropdown
        if (selectEl) {
            selectEl.innerHTML = `<option value="" class="bg-slate-900 text-slate-400">-- Escolha a Classe --</option>` 
                + allClasses.map(c => `<option value="${c.id}" class="bg-slate-900 text-white">${escapeHTML(c.name)}</option>`).join('');
        }

        // Atualiza a tela vazia
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        if (loadingText) loadingText.textContent = "Selecione uma Classe para ver suas ramificações.";

    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        if (selectEl) selectEl.innerHTML = `<option value="">Erro na biblioteca.</option>`;
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        if (loadingText) {
            loadingText.textContent = "Os arquivos foram perdidos (Erro de conexão).";
            loadingText.classList.replace('text-slate-500', 'text-red-500');
        }
    }
}

async function loadSubclassesForClass(classId) {
    const container = document.getElementById('subclasses-list-container');
    if (!container) return;

    if (!classId) {
        container.innerHTML = `
            <div class="flex items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full animate-fade-in">
                <p class="text-xl text-slate-500 font-cinzel tracking-widest">Selecione uma classe acima.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full animate-fade-in">
            <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-xl text-slate-400 font-cinzel tracking-widest animate-pulse">Lendo Ramificações...</p>
        </div>
    `;

    try {
        const selectedClass = allClasses.find(c => c.id === classId);
        const subclassIds = selectedClass?.subclasses;

        if (!subclassIds || subclassIds.length === 0) {
            container.innerHTML = `
                <div class="flex items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full animate-fade-in">
                    <p class="text-xl text-slate-500 font-cinzel tracking-widest">Nenhuma subclasse encontrada para esta classe.</p>
                </div>
            `;
            return;
        }

        // Divide o array de IDs em blocos de 10 por causa das limitações do Firebase (in)
        const chunks = [];
        for (let i = 0; i < subclassIds.length; i += 10) {
            chunks.push(subclassIds.slice(i, i + 10));
        }

        const queries = chunks.map(chunk => 
            getDocs(query(collection(db, 'rpg_subclasses'), where(documentId(), 'in', chunk)))
        );

        const querySnapshots = await Promise.all(queries);
        let subclasses = [];
        querySnapshots.forEach(snap => {
            subclasses = subclasses.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Ordena
        subclasses.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        renderSubclassesCards(subclasses);

    } catch (error) {
        console.error("Erro ao buscar subclasses:", error);
        container.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">Falha ao ler os tomos.</div>`;
    }
}

function renderSubclassesCards(subclasses) {
    const container = document.getElementById('subclasses-list-container');
    if (!container) return;

    let html = '<div class="w-full flex flex-col gap-12 md:gap-16 animate-fade-in">';
    subclasses.forEach(sub => {
        html += generateSubclassCard(sub);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateSubclassCard(subclassData) {
    const imgUrl = subclassData.imagemUrl || 'https://placehold.co/400x400/1e293b/a1a1aa?text=Sem+Retrato';
    const specialAbility = subclassData.habilidadeEspecialSubclasse || "Nenhuma habilidade especial informada.";

    // Filtrar habilidades específicas DESTA subclasse
    const availableSkills = allSkills
        .filter(skill => skill.restricaoSubclasses && skill.restricaoSubclasses.includes(subclassData.id))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const renderStat = (iconClass, colorClass, label, value) => `
        <div class="bg-slate-900/80 p-4 rounded-xl flex items-center gap-4 border border-slate-700 shadow-inner flex-1 min-w-[130px]">
            <div class="${colorClass} text-2xl w-8 text-center"><i class="fas ${iconClass}"></i></div>
            <div>
                <p class="text-[10px] md:text-xs text-slate-400 font-cinzel font-bold tracking-widest uppercase mb-0.5">${label}</p>
                <p class="text-xl md:text-2xl font-black text-white leading-none">${value || 0}</p>
            </div>
        </div>
    `;

    const renderSkillTags = (skills, bgClass, textClass) => {
        if (skills.length === 0) return '<span class="text-slate-500 italic text-sm">Nenhuma técnica registrada.</span>';
        return `<div class="flex flex-wrap gap-2 mt-4">` +
            skills.map(s => `<span class="px-3 py-1.5 ${bgClass} ${textClass} rounded-lg text-sm shadow-sm font-medium border border-current/20 cursor-default hover:brightness-125 transition-all">${escapeHTML(s.nome)}</span>`).join('') +
        `</div>`;
    };

    return `
        <article class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-8 group hover:border-amber-900/50 transition-colors">
            
            <div class="flex flex-col xl:flex-row gap-8 lg:gap-12 items-start">
                
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative cursor-pointer simulador-img-wrapper" onclick="window.subclassesCompendio.openImage('${imgUrl}')">
                        <div class="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"></div>
                        <img src="${imgUrl}" alt="${escapeHTML(subclassData.nome)}" class="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-purple-500/50 group-hover:border-purple-400 shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 transition-colors duration-500">
                        <div class="absolute bottom-4 right-4 bg-black/80 text-white p-3 md:p-4 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                            <i class="fas fa-expand-arrows-alt text-lg"></i>
                        </div>
                    </div>
                </div>

                <div class="flex-grow w-full flex flex-col justify-center">
                    <h2 class="text-4xl md:text-5xl lg:text-6xl font-black font-cinzel text-white mb-6 drop-shadow-md border-b border-slate-700/80 pb-4">${escapeHTML(subclassData.nome)}</h2>
                    
                    <h4 class="text-lg font-cinzel text-slate-400 mb-4 tracking-widest uppercase">Bônus de Especialização</h4>
                    <div class="flex flex-wrap gap-3">
                        ${renderStat('fa-heart', 'text-red-500', 'HP Bônus', subclassData.bonusHpSubclasseBase)}
                        ${renderStat('fa-star', 'text-blue-400', 'MP Bônus', subclassData.bonusMpSubclasseBase)}
                        ${renderStat('fa-khanda', 'text-orange-500', 'ATK Bônus', subclassData.bonusAtaqueSubclasseBase)}
                        ${renderStat('fa-shield-alt', 'text-sky-400', 'DEF Bônus', subclassData.bonusDefesaSubclasseBase)}
                        ${renderStat('fa-feather-alt', 'text-emerald-400', 'EVA Bônus', subclassData.bonusEvasaoSubclasseBase)}
                    </div>
                </div>
            </div>

            <div class="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4 items-stretch">
                
                <div class="w-full bg-slate-900/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-inner flex flex-col">
                    <h4 class="text-2xl font-bold font-cinzel text-amber-500 mb-4 flex items-center gap-3 border-b border-slate-700/50 pb-3">
                        <i class="fas fa-star text-slate-500 text-lg"></i> Dádiva da Subclasse
                    </h4>
                    <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap flex-grow">${escapeHTML(specialAbility)}</p>
                </div>

                <div class="w-full bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg flex flex-col">
                    <h4 class="text-2xl font-bold font-cinzel text-purple-400 mb-4 flex items-center gap-3 border-b border-slate-700/50 pb-3">
                        <i class="fas fa-project-diagram text-slate-500 text-lg"></i> Técnicas Exclusivas
                    </h4>
                    ${renderSkillTags(availableSkills, "bg-purple-900/30", "text-purple-300")}
                </div>

            </div>

        </article>
    `;
}

// Funções Globais da Página
window.subclassesCompendio = {
    selectClass: function(val) {
        loadSubclassesForClass(val);
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