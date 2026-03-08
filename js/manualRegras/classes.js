import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allClasses = [];
let subclassCache = {}; 
let allSkills = [];

export async function renderClassesTab() {
    const container = document.getElementById('classes-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Classes</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Conheça os caminhos de combate e magia de Imperiall</p>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div id="classes-list-container" class="w-full relative">
                    <div class="flex flex-col items-center justify-center min-h-[300px]">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-lg text-slate-400 font-cinzel tracking-widest animate-pulse">Lendo os Manuais de Combate...</p>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim dos Manuais</p>
            </div>
        </div>
    `;

    await fetchClassesData();
}

async function fetchClassesData() {
    const container = document.getElementById('classes-list-container');
    
    try {
        // Busca Paralela de tudo o que precisamos
        const [classSnap, subClassSnap, skillSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_classes'), orderBy("nome"))),
            getDocs(collection(db, 'rpg_subclasses')),
            getDocs(collection(db, 'rpg_habilidades'))
        ]);

        // Cache de Subclasses (ID -> Nome)
        subClassSnap.docs.forEach(doc => {
            subclassCache[doc.id] = doc.data().nome;
        });

        // Salva todas as habilidades
        allSkills = skillSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Salva as classes
        allClasses = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (allClasses.length > 0) {
            renderClassesList();
        } else {
            if(container) container.innerHTML = `<div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400">Nenhuma classe encontrada no compêndio.</div>`;
        }

    } catch (error) {
        console.error("Erro ao carregar Classes:", error);
        if (container) {
            container.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">Os manuais foram destruídos (Erro de conexão).</div>`;
        }
    }
}

function renderClassesList() {
    const container = document.getElementById('classes-list-container');
    if (!container) return;

    let html = '<div class="w-full flex flex-col gap-12 md:gap-16 animate-fade-in">';
    allClasses.forEach((classData, index) => {
        html += generateClassCard(classData, index);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateClassCard(classData, index) {
    const imgUrl = classData.imagemUrl || 'https://placehold.co/400x400/1e293b/a1a1aa?text=Sem+Retrato';
    const specialAbility = classData.habilidadeEspecialClasse || "Nenhuma habilidade especial documentada.";

    // Lógica de Habilidades (Classes e Subclasses)
    const classSkills = allSkills
        .filter(skill => skill.restricaoClasses && skill.restricaoClasses.includes(classData.id))
        .sort((a, b) => (a.nome||'').localeCompare(b.nome||''));
        
    const classSubclassIds = new Set(classData.subclasses || []);
    const subclassSkills = allSkills
        .filter(skill => skill.restricaoSubclasses && skill.restricaoSubclasses.some(subId => classSubclassIds.has(subId)))
        .sort((a, b) => (a.nome||'').localeCompare(b.nome||''));

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

    // Renderizador da Classificação (Radar)
    const renderClassification = (map) => {
        if (!map) return '';
        let html = '<div class="flex flex-wrap gap-2 text-sm md:text-sm">';
        const iconMap = {
            "escalabilidade": "fa-scale-balanced text-slate-400",
            "facilidade": "fa-bolt text-slate-400",
            "utilidadeGrupo": "fa-users text-slate-400",
            "controleGrupo": "fa-bullseye text-slate-400",
            "capacidadeDefesa": "fa-shield-alt text-slate-400",
            "poderAtaque": "fa-bolt-lightning text-slate-400"
        };
        
        Object.entries(map).forEach(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
            const icon = iconMap[key] || "fa-star text-slate-400";
            html += `
                <span class="bg-slate-950/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center shadow-md">
                    <i class="fas ${icon} mr-2"></i>
                    <span class="capitalize text-slate-300 mr-2">${formattedKey}:</span>
                    <span class="font-bold text-amber-400">${value}</span>
                </span>
            `;
        });
        html += '</div>';
        return html;
    };

    // Renderizador de Subclasses
    let subclassesHTML = '<span class="text-slate-500 text-sm">Nenhuma ramificação conhecida.</span>';
    if (classData.subclasses && classData.subclasses.length > 0) {
        subclassesHTML = `<div class="flex flex-wrap gap-2">` + 
            classData.subclasses.map(id => `
                <span class="px-3 py-1.5 bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 text-sm font-bold tracking-widest uppercase rounded-lg shadow-sm">
                    ${escapeHTML(subclassCache[id] || id)}
                </span>
            `).join('') + `</div>`;
    }

    // Renderizador de Nomes de Habilidades (Tags simples)
    const renderSkillTags = (skills, bgClass, textClass) => {
        if (skills.length === 0) return '<span class="text-slate-500 italic text-sm">Nenhuma técnica registrada.</span>';
        return `<div class="flex flex-wrap gap-2">` +
            skills.map(s => `<span class="px-3 py-1.5 ${bgClass} ${textClass} rounded-lg text-sm shadow-sm font-medium border border-current/20 cursor-default hover:brightness-125 transition-all">${escapeHTML(s.nome)}</span>`).join('') +
        `</div>`;
    };

    return `
        <article class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-8 group hover:border-amber-900/50 transition-colors">
            
            <div class="flex flex-col xl:flex-row gap-8 lg:gap-12 items-start">
                
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative cursor-pointer simulador-img-wrapper" onclick="window.classesCompendio.openImage('${imgUrl}')">
                        <div class="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"></div>
                        <img src="${imgUrl}" alt="${escapeHTML(classData.nome)}" class="w-48 h-64 md:w-64 md:h-80 rounded-2xl object-cover object-top border-4 border-slate-600 group-hover:border-amber-500 shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 transition-colors duration-500">
                        <div class="absolute bottom-4 right-4 bg-black/80 text-white p-3 md:p-4 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                            <i class="fas fa-expand-arrows-alt text-lg"></i>
                        </div>
                    </div>
                </div>

                <div class="flex-grow w-full flex flex-col justify-center">
                    <h2 class="text-4xl md:text-5xl lg:text-6xl font-black font-cinzel text-white mb-4 drop-shadow-md">${escapeHTML(classData.nome)}</h2>
                    <div class="mb-8 pb-6 border-b border-slate-700/80">
                        ${renderClassification(classData.classificacao)}
                    </div>
                    
                    <h4 class="text-lg font-cinzel text-slate-400 mb-4 tracking-widest uppercase">Atributos Iniciais</h4>
                    <div class="flex flex-wrap gap-3 mb-8">
                        ${renderStat('fa-heart', 'text-red-500', 'HP Base', classData.bonusHpClasseBase)}
                        ${renderStat('fa-star', 'text-blue-400', 'MP Base', classData.bonusMpClasseBase)}
                        ${renderStat('fa-khanda', 'text-orange-500', 'ATK Base', classData.bonusAtaqueClasseBase)}
                        ${renderStat('fa-shield-alt', 'text-sky-400', 'DEF Base', classData.bonusDefesaClasseBase)}
                        ${renderStat('fa-feather-alt', 'text-emerald-400', 'EVA Base', classData.bonusEvasaoClasseBase)}
                    </div>

                    <h4 class="text-lg font-cinzel text-slate-400 mb-3 tracking-widest uppercase">Caminhos (Subclasses)</h4>
                    ${subclassesHTML}
                </div>
            </div>

            <div class="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4 items-stretch">
                
                <div class="w-full bg-slate-900/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-inner flex flex-col">
                    <h4 class="text-2xl font-bold font-cinzel text-amber-500 mb-4 flex items-center gap-3 border-b border-slate-700/50 pb-3">
                        <i class="fas fa-star text-slate-500 text-lg"></i> Dádiva da Classe
                    </h4>
                    <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap flex-grow">${escapeHTML(specialAbility)}</p>
                </div>

                <div class="w-full bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg flex flex-col gap-6">
                    <div>
                        <h5 class="text-sm font-cinzel font-bold text-sky-400 flex items-center gap-2 mb-3 uppercase tracking-widest"><i class="fas fa-book-open"></i> Técnicas Desta Classe</h5>
                        ${renderSkillTags(classSkills, "bg-sky-900/30", "text-sky-300")}
                    </div>
                    <div class="border-t border-slate-700/50 pt-6">
                        <h5 class="text-sm font-cinzel font-bold text-purple-400 flex items-center gap-2 mb-3 uppercase tracking-widest"><i class="fas fa-project-diagram"></i> Técnicas Exclusivas de Subclasse</h5>
                        ${renderSkillTags(subclassSkills, "bg-purple-900/30", "text-purple-300")}
                    </div>
                </div>

            </div>

        </article>
    `;
}

// Funções globais de interação
window.classesCompendio = {
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