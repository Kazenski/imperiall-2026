import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allClasses = [];
let allSubclasses = [];
let allSkills = [];

let selectedClassId = '';
let currentSearchTerm = '';
let currentSortKey = 'nome';
let currentSortDirection = 'asc';

export async function renderHabilidadesTab() {
    const container = document.getElementById('habilidades-regras-content');
    if (!container) return;

    // Reset de estado ao abrir a aba
    selectedClassId = '';
    currentSearchTerm = '';
    currentSortKey = 'nome';
    currentSortDirection = 'asc';

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Habilidades</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">O grimório definitivo das artes e magias de combate</p>
            </header>

            <div class="w-full flex-grow flex flex-col gap-6">
                
                <div class="w-full max-w-4xl mx-auto p-6 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl relative z-20 flex flex-col md:flex-row gap-4">
                    
                    <div class="flex-1 relative">
                        <label class="block text-xs font-cinzel font-bold text-slate-400 mb-2 tracking-widest uppercase">Origem do Poder</label>
                        <select id="habilidade-class-select" class="appearance-none w-full px-4 py-3 bg-slate-900 text-white border border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-sm" onchange="window.habilidadesCompendio.handleClassSelect(this.value)">
                            <option value="" class="bg-slate-900 text-slate-400">Vasculhando Grimórios...</option>
                        </select>
                        <div class="pointer-events-none absolute bottom-0 right-0 h-[46px] flex items-center px-4 text-amber-500">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>

                    <div class="flex-1 relative">
                        <label class="block text-xs font-cinzel font-bold text-slate-400 mb-2 tracking-widest uppercase">Pesquisar Técnica</label>
                        <input type="text" id="habilidade-search-input" placeholder="Ex: Fogo, Cura, Corte..." class="w-full px-4 py-3 bg-slate-900 text-white border border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors text-sm disabled:opacity-50" disabled onkeyup="window.habilidadesCompendio.handleSearch(this.value)">
                        <div class="absolute bottom-0 right-0 h-[46px] flex items-center px-4 text-slate-500 pointer-events-none">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>

                </div>

                <div id="habilidades-table-container" class="w-full relative z-10 hidden mt-4 bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                    <div class="w-full overflow-x-auto custom-scroll">
                        <table class="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr class="bg-slate-800 text-amber-500 font-cinzel tracking-widest border-b-2 border-amber-600 select-none">
                                    <th class="py-4 px-4 font-bold text-sm uppercase cursor-pointer hover:bg-slate-700 transition-colors w-1/5" onclick="window.habilidadesCompendio.handleSort('nome')">
                                        Técnica <i id="sort-icon-nome" class="fas fa-sort text-slate-500 ml-1"></i>
                                    </th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase w-1/3">
                                        Descrição
                                    </th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase cursor-pointer hover:bg-slate-700 transition-colors" onclick="window.habilidadesCompendio.handleSort('duracaoHabilidade')">
                                        Duração <i id="sort-icon-duracaoHabilidade" class="fas fa-sort text-slate-500 ml-1"></i>
                                    </th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase cursor-pointer hover:bg-slate-700 transition-colors" onclick="window.habilidadesCompendio.handleSort('gastoMpUso')">
                                        Custo MP <i id="sort-icon-gastoMpUso" class="fas fa-sort text-slate-500 ml-1"></i>
                                    </th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase cursor-pointer hover:bg-slate-700 transition-colors" onclick="window.habilidadesCompendio.handleSort('efeitoDanoBaseUsoHabilidade')">
                                        Dano Base <i id="sort-icon-efeitoDanoBaseUsoHabilidade" class="fas fa-sort text-slate-500 ml-1"></i>
                                    </th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="habilidades-table-body" class="text-slate-300">
                                </tbody>
                        </table>
                    </div>
                </div>

                <div id="habilidades-feedback-container" class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                    <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" id="habilidade-loading-spinner"></div>
                    <p class="text-xl text-slate-400 font-cinzel tracking-widest animate-pulse" id="habilidade-loading-text">Reunindo pergaminhos...</p>
                </div>
            </div>
            
        </div>

        <div id="habilidade-modal" class="fixed inset-0 z-[100] bg-black/95 hidden flex-col items-center justify-center p-4 md:p-10 animate-fade-in">
            <div class="w-full max-w-4xl bg-slate-900 border-2 border-amber-600 rounded-2xl shadow-2xl relative flex flex-col max-h-full">
                <button class="absolute top-4 right-6 text-slate-400 hover:text-red-500 text-3xl font-bold transition-colors outline-none z-10" onclick="document.getElementById('habilidade-modal').classList.add('hidden'); document.getElementById('habilidade-modal').classList.remove('flex');">&times;</button>
                <div class="p-6 md:p-10 overflow-y-auto custom-scroll" id="habilidade-modal-content"></div>
            </div>
        </div>
    `;

    await fetchInitialData();
}

async function fetchInitialData() {
    const selectEl = document.getElementById('habilidade-class-select');
    const spinner = document.getElementById('habilidade-loading-spinner');
    const textEl = document.getElementById('habilidade-loading-text');

    try {
        const [classSnap, subClassSnap, skillSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_classes'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_subclasses'), orderBy("nome"))),
            getDocs(collection(db, 'rpg_habilidades'))
        ]);

        allClasses = classSnap.docs.map(doc => ({ id: doc.id, name: doc.data().nome }));
        allSubclasses = subClassSnap.docs.map(doc => ({ id: doc.id, name: doc.data().nome }));
        allSkills = skillSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (selectEl) {
            let optionsHTML = `<option value="" class="bg-slate-900">-- Selecione a Origem --</option>`;
            
            optionsHTML += `<optgroup label="Classes" class="bg-slate-900 text-sky-400">`;
            allClasses.forEach(c => optionsHTML += `<option value="${c.id}" class="text-white">${c.name}</option>`);
            optionsHTML += `</optgroup>`;

            optionsHTML += `<optgroup label="Subclasses" class="bg-slate-900 text-purple-400">`;
            allSubclasses.forEach(s => optionsHTML += `<option value="${s.id}" class="text-white">${s.name}</option>`);
            optionsHTML += `</optgroup>`;

            selectEl.innerHTML = optionsHTML;
        }

        if (spinner) spinner.classList.add('hidden');
        if (textEl) {
            textEl.textContent = "Selecione uma Classe ou Subclasse para revelar suas habilidades.";
            textEl.classList.remove('animate-pulse');
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (selectEl) selectEl.innerHTML = `<option value="">Erro Crítico.</option>`;
        if (spinner) spinner.classList.add('hidden');
        if (textEl) {
            textEl.textContent = "Os grimórios foram selados (Erro de conexão).";
            textEl.classList.replace('text-slate-400', 'text-red-500');
        }
    }
}

// -------------------------------------------------------------
// LÓGICA DE FILTRAGEM E ORDENAÇÃO
// -------------------------------------------------------------

function applyFiltersAndSort() {
    const tableContainer = document.getElementById('habilidades-table-container');
    const feedbackContainer = document.getElementById('habilidades-feedback-container');
    const feedbackText = document.getElementById('habilidade-loading-text');
    const searchInput = document.getElementById('habilidade-search-input');

    if (!selectedClassId) {
        tableContainer.classList.add('hidden');
        feedbackContainer.classList.remove('hidden');
        feedbackText.textContent = "Selecione uma Classe ou Subclasse para revelar suas habilidades.";
        if(searchInput) searchInput.disabled = true;
        return;
    }

    if(searchInput) searchInput.disabled = false;

    // 1. Filtra pela Classe/Subclasse selecionada
    let filteredSkills = allSkills.filter(skill => {
        const inClass = skill.restricaoClasses && skill.restricaoClasses.includes(selectedClassId);
        const inSubclass = skill.restricaoSubclasses && skill.restricaoSubclasses.includes(selectedClassId);
        return inClass || inSubclass;
    });

    // 2. Filtra pelo texto de pesquisa
    if (currentSearchTerm.trim() !== '') {
        const term = currentSearchTerm.toLowerCase();
        filteredSkills = filteredSkills.filter(skill => 
            (skill.nome && skill.nome.toLowerCase().includes(term)) ||
            (skill.descricaoEfeito && skill.descricaoEfeito.toLowerCase().includes(term))
        );
    }

    if (filteredSkills.length === 0) {
        tableContainer.classList.add('hidden');
        feedbackContainer.classList.remove('hidden');
        feedbackText.textContent = "Nenhuma habilidade encontrada com estes filtros.";
        return;
    }

    feedbackContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');

    // 3. Ordena os resultados
    filteredSkills.sort((a, b) => {
        const valA = getSortValue(a, currentSortKey);
        const valB = getSortValue(b, currentSortKey);

        if (typeof valA === 'string' && typeof valB === 'string') {
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
    });

    renderTableRows(filteredSkills);
    updateSortIcons();
}

function getSortValue(skill, key) {
    if (key === 'nome' || key === 'duracaoHabilidade') {
        return (skill[key] || '').toString().toLowerCase();
    }
    
    const data = skill[key];
    if (typeof data === 'number') return data;
    if (typeof data === 'object' && data !== null) {
        if (data.lvl1 !== undefined) return Number(data.lvl1) || 0;
        const firstKey = Object.keys(data).sort()[0];
        return Number(data[firstKey]) || 0;
    }
    return 0;
}

function updateSortIcons() {
    const keys = ['nome', 'duracaoHabilidade', 'gastoMpUso', 'efeitoDanoBaseUsoHabilidade'];
    keys.forEach(k => {
        const icon = document.getElementById(`sort-icon-${k}`);
        if (icon) {
            icon.className = 'fas ml-1 text-slate-500'; // Reset
            if (k === currentSortKey) {
                icon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                icon.classList.add('text-amber-500');
                icon.classList.remove('text-slate-500');
            } else {
                icon.classList.add('fa-sort', 'opacity-30');
            }
        }
    });
}

// -------------------------------------------------------------
// RENDERIZAÇÃO VISUAL
// -------------------------------------------------------------

function formatLvlMap(data) {
    if (!data) return '<span class="text-slate-500">N/A</span>';
    if (typeof data === 'number') return `<span class="text-amber-400 font-bold">${data}</span>`;
    
    if (typeof data === 'object') {
        const firstKey = Object.keys(data).sort()[0];
        if (firstKey) {
            return `<span class="text-amber-400 font-bold">${data[firstKey]}</span> <span class="text-xs text-slate-500">(${firstKey})</span>`;
        }
    }
    return '<span class="text-slate-500">N/A</span>';
}

function renderTableRows(skillsToRender) {
    const tbody = document.getElementById('habilidades-table-body');
    if (!tbody) return;

    let html = '';
    skillsToRender.forEach((skill) => {
        const desc = skill.descricaoEfeito || '';
        const shortDesc = desc.length > 90 ? desc.substring(0, 90) + '...' : desc;

        html += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800 transition-colors">
                <td class="py-4 px-4 font-bold text-white align-top">${escapeHTML(skill.nome || 'Desconhecida')}</td>
                <td class="py-4 px-4 text-sm align-top leading-relaxed text-slate-300 pr-8">
                    ${escapeHTML(shortDesc)}
                </td>
                <td class="py-4 px-4 text-sm align-top">${escapeHTML(skill.duracaoHabilidade || 'N/A')}</td>
                <td class="py-4 px-4 text-sm align-top font-mono bg-slate-900/30">${formatLvlMap(skill.gastoMpUso)}</td>
                <td class="py-4 px-4 text-sm align-top font-mono bg-slate-900/30">${formatLvlMap(skill.efeitoDanoBaseUsoHabilidade)}</td>
                <td class="py-4 px-4 text-center align-top">
                    <button onclick="window.habilidadesCompendio.openModal('${skill.id}')" class="px-4 py-2 bg-slate-700 border border-slate-600 hover:bg-amber-600 hover:border-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors shadow-md">
                        Detalhes
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// -------------------------------------------------------------
// MODAL DE DETALHES DA HABILIDADE
// -------------------------------------------------------------
function openSkillModal(skillId) {
    const modal = document.getElementById('habilidade-modal');
    const content = document.getElementById('habilidade-modal-content');
    if (!modal || !content) return;

    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return;

    // --- LÓGICA DO ÍCONE DA HABILIDADE (BOLINHA) ---
    // Se existir 'imagemUrl', renderiza a imagem em formato circular. 
    // Se não, renderiza um ícone genérico com o mesmo formato circular.
    const iconHTML = skill.imagemUrl 
        ? `<img src="${escapeHTML(skill.imagemUrl)}" alt="${escapeHTML(skill.nome)}" class="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0 bg-slate-900">`
        : `<div class="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-full flex items-center justify-center border-2 border-amber-500/50 text-amber-500 text-3xl shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
             <i class="fas fa-book-open"></i>
           </div>`;

    const renderFullMap = (data, unit) => {
        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return '<span class="text-slate-500">N/A</span>';
        if (typeof data === 'number') return `<span class="bg-slate-800 px-3 py-1 rounded text-amber-400 font-mono border border-slate-700 shadow-sm">${data} ${unit}</span>`;
        
        const sortedKeys = Object.keys(data).sort((a, b) => parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,'')));
        return `<div class="flex flex-wrap gap-2">` + 
            sortedKeys.map(k => `<span class="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm font-mono text-sm"><span class="text-slate-400 mr-2">${k}:</span><span class="text-amber-400 font-bold">${data[k]}</span> ${unit}</span>`).join('') +
        `</div>`;
    };

    content.innerHTML = `
        <div class="flex items-center gap-4 md:gap-6 border-b border-slate-700 pb-6 mb-6">
            ${iconHTML}
            <div>
                <h2 class="text-3xl md:text-4xl font-black font-cinzel text-white">${escapeHTML(skill.nome)}</h2>
                <p class="text-amber-500 font-bold tracking-widest text-sm uppercase mt-1 drop-shadow-md">Técnica Registrada</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div class="space-y-6">
                <div class="bg-slate-800/30 p-5 rounded-2xl border border-slate-700">
                    <h4 class="text-slate-400 font-cinzel font-bold text-sm tracking-widest mb-3 uppercase flex items-center gap-2"><i class="fas fa-bolt text-amber-500"></i> Custo de Poder (MP)</h4>
                    ${renderFullMap(skill.gastoMpUso, 'MP')}
                </div>
                <div class="bg-slate-800/30 p-5 rounded-2xl border border-slate-700">
                    <h4 class="text-slate-400 font-cinzel font-bold text-sm tracking-widest mb-3 uppercase flex items-center gap-2"><i class="fas fa-khanda text-orange-500"></i> Potência Base</h4>
                    ${renderFullMap(skill.efeitoDanoBaseUsoHabilidade, 'Dano')}
                </div>
            </div>
            <div class="space-y-6">
                <div class="bg-slate-800/50 p-5 rounded-xl border border-slate-700 shadow-inner">
                    <h4 class="text-slate-400 font-cinzel text-xs tracking-widest uppercase mb-1 flex items-center gap-2"><i class="fas fa-hourglass-half"></i> Duração</h4>
                    <p class="text-xl text-white font-medium">${escapeHTML(skill.duracaoHabilidade || 'Instantânea')}</p>
                </div>
                <div class="bg-slate-800/50 p-5 rounded-xl border border-slate-700 shadow-inner">
                    <h4 class="text-slate-400 font-cinzel text-xs tracking-widest uppercase mb-1 flex items-center gap-2"><i class="fas fa-bullseye"></i> Área de Efeito</h4>
                    <p class="text-xl text-white font-medium">${escapeHTML(skill.areaHabilidade || 'Alvo Único')}</p>
                </div>
            </div>
        </div>

        <div class="bg-slate-800/80 p-8 rounded-2xl border border-slate-600 shadow-xl relative overflow-hidden">
            <i class="fas fa-scroll absolute -right-4 -top-4 text-8xl text-slate-700/30 pointer-events-none"></i>
            <h4 class="text-xl font-cinzel font-bold text-amber-400 mb-4 flex items-center gap-2 relative z-10"><i class="fas fa-align-left text-slate-400"></i> Efeito da Habilidade</h4>
            <p class="text-slate-300 text-base md:text-lg leading-relaxed whitespace-pre-wrap relative z-10 font-serif text-justify">${escapeHTML(skill.descricaoEfeito || 'O manual encontra-se ilegível neste trecho.')}</p>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Funções Globais expostas para o HTML
window.habilidadesCompendio = {
    handleClassSelect: function(val) {
        selectedClassId = val;
        applyFiltersAndSort();
    },
    handleSearch: function(val) {
        currentSearchTerm = val;
        applyFiltersAndSort();
    },
    handleSort: function(key) {
        if (currentSortKey === key) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortKey = key;
            currentSortDirection = 'asc';
        }
        applyFiltersAndSort();
    },
    openModal: function(id) {
        openSkillModal(id);
    }
};