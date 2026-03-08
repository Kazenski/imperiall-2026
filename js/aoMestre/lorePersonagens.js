import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allCharacters = [];
let availableSessions = [];
let currentSessionFilter = '';

export async function renderLorePersonagensTab() {
    const container = document.getElementById('lore-personagens-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full flex flex-col items-center gap-4">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md"><i class="fas fa-scroll mr-3"></i> O Livro dos Heróis</h1>
                <p class="text-slate-400 mt-2 text-sm md:text-base italic">As histórias entrelaçadas daqueles que moldam o destino de Imperiall</p>
                
                <div class="mt-4 w-full max-w-sm relative">
                    <select id="lore-session-filter" class="appearance-none w-full px-5 py-3 bg-slate-900 text-slate-200 border border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-sm font-bold tracking-widest text-center uppercase" onchange="window.loreCompendio.filterBySession(this.value)">
                        <option value="" class="bg-slate-900 text-slate-400">Vasculhando Sessões...</option>
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-amber-500">
                        <i class="fas fa-filter"></i>
                    </div>
                </div>
            </header>

            <div class="w-full flex-grow flex flex-col">
                <div id="lore-list-container" class="w-full relative">
                    <div class="flex flex-col items-center justify-center min-h-[300px]">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-lg text-slate-400 font-cinzel tracking-widest animate-pulse">Lendo crónicas...</p>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim dos Registros Históricos</p>
            </div>
        </div>
    `;

    await fetchLoreData();
}

async function fetchLoreData() {
    const container = document.getElementById('lore-list-container');
    const selectEl = document.getElementById('lore-session-filter');
    
    try {
        const [charSnap, racaSnap, classeSnap, subClasseSnap, xpDoc, sessionsSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_fichas'), orderBy("nome"))),
            getDocs(collection(db, 'rpg_racas')),
            getDocs(collection(db, 'rpg_classes')),
            getDocs(collection(db, 'rpg_subclasses')),
            getDoc(doc(db, "rpg_configuracoes", "tabela_xp")),
            getDocs(collection(db, 'rpg_sessions'))
        ]);

        const racaCache = {};
        racaSnap.forEach(d => racaCache[d.id] = d.data().nome);
        
        const classeCache = {};
        classeSnap.forEach(d => classeCache[d.id] = d.data().nome);
        
        const subClasseCache = {};
        subClasseSnap.forEach(d => subClasseCache[d.id] = d.data().nome);
        
        const tabelaXP = xpDoc.exists() ? xpDoc.data() : null;

        // Mapeia e organiza as sessões garantindo o campo 'name'
        const allSessions = sessionsSnap.docs.map(s => {
            const data = s.data();
            return {
                id: s.id,
                name: data.name || data.nome || 'Sessão Sem Nome',
                playerIds: data.playerIds || []
            };
        });

        const calculateLevel = (xp) => {
            if (!tabelaXP?.niveis) return 1;
            const niveisOrdenados = Object.keys(tabelaXP.niveis).map(Number).sort((a, b) => b - a);
            return niveisOrdenados.find(lvl => xp >= (tabelaXP.niveis[String(lvl)]?.experienciaParaProximoNivel || 0)) || 1;
        };

        const sessionsWithPlayers = new Map(); 
        
        allCharacters = charSnap.docs.map(docSnap => {
            const data = docSnap.data();
            const charId = docSnap.id;
            const lvl = calculateLevel(data.experienciapersonagemBase || 0);
            
            const charSessions = allSessions.filter(session => Array.isArray(session.playerIds) && session.playerIds.includes(charId));
            
            const sessionIds = charSessions.map(s => s.id);
            const sessionNames = charSessions.map(s => s.name);

            charSessions.forEach(s => {
                sessionsWithPlayers.set(s.id, s.name);
            });

            return {
                id: charId,
                nome: data.nome || 'Desconhecido',
                imageUrls: data.imageUrls || {},
                historia: data.historia || '',
                level: lvl,
                racaName: racaCache[data.racaId] || 'Raça Oculta',
                classeName: classeCache[data.classeId] || 'Sem Classe',
                subclasseName: subClasseCache[data.subclasseId] || '',
                sessionIds: sessionIds,       
                sessionNames: sessionNames    
            };
        });

        // Monta o select colocando o ID no value, mas exibindo o Nome
        availableSessions = Array.from(sessionsWithPlayers.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
        
        if (selectEl) {
            let options = `<option value="" class="bg-slate-900 text-amber-500">Todas as Sessões</option>`;
            availableSessions.forEach(s => {
                options += `<option value="${s.id}" class="bg-slate-900 text-slate-200">${escapeHTML(s.name)}</option>`;
            });
            selectEl.innerHTML = options;
        }

        renderLoreList();

    } catch (error) {
        console.error("Erro ao carregar Lore:", error);
        if (container) {
            container.innerHTML = `<div class="text-center p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">As crónicas foram perdidas (Erro de conexão).</div>`;
        }
    }
}

function renderLoreList() {
    const container = document.getElementById('lore-list-container');
    if (!container) return;

    let filtered = allCharacters;
    
    if (currentSessionFilter) {
        filtered = allCharacters.filter(c => c.sessionIds.includes(currentSessionFilter));
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center p-10 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 italic">Nenhum aventureiro encontrado nesta pesquisa.</div>`;
        return;
    }

    let html = '<div class="w-full flex flex-col gap-10 md:gap-14 animate-fade-in">';
    filtered.forEach((char) => {
        html += generateLoreCard(char);
    });
    html += '</div>';

    container.innerHTML = html;
}

function generateLoreCard(char) {
    const imgUrl = char.imageUrls?.imagem1 || 'https://placehold.co/400x400/1e293b/a1a1aa?text=Desconhecido';
    
    const rawHistory = char.historia || 'As brumas do tempo escondem o passado deste aventureiro...';
    const formattedHistory = escapeHTML(rawHistory).replace(/\n/g, '<br>');

    // Lógica para determinar se precisa do botão "Ler Mais" (Mais de 250 chars ou 4 quebras de linha)
    const isLongLore = rawHistory.length > 250 || rawHistory.split('\n').length > 4;

    let subHtml = '';
    if (char.subclasseName && char.subclasseName !== 'Desconhecida') {
        subHtml = `<span class="bg-purple-900/40 border border-purple-700/50 text-purple-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm">${escapeHTML(char.subclasseName)}</span>`;
    }

    const sessionText = char.sessionNames.join(', ');
    const sessionHtml = sessionText 
        ? `<div class="absolute top-6 right-6 bg-slate-900/80 border border-amber-500/30 px-3 py-1 rounded text-[10px] text-amber-500 font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm z-20"><i class="fas fa-bookmark mr-1"></i> ${escapeHTML(sessionText)}</div>`
        : '';

    return `
        <article class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col md:flex-row gap-8 lg:gap-12 items-start relative group hover:border-amber-900/50 transition-colors">
            
            ${sessionHtml}

            <div class="flex-shrink-0 w-full md:w-64 xl:w-72 flex flex-col items-center">
                <div class="relative cursor-pointer simulador-img-wrapper" onclick="window.loreCompendio.openImage('${imgUrl}')">
                    <div class="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"></div>
                    <img src="${imgUrl}" alt="${escapeHTML(char.nome)}" class="w-48 h-48 md:w-56 md:h-56 xl:w-64 xl:h-64 rounded-full object-cover object-top border-4 border-slate-600 group-hover:border-amber-500 shadow-[0_10px_25px_rgba(0,0,0,0.8)] relative z-10 transition-colors duration-500">
                    <div class="absolute bottom-4 right-4 bg-black/80 text-white p-3 md:p-4 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
                        <i class="fas fa-expand-arrows-alt text-lg"></i>
                    </div>
                </div>

                <div class="mt-6 flex flex-col items-center w-full gap-2 relative z-10">
                    <span class="bg-amber-600 text-black px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-md">
                        Nível ${char.level}
                    </span>
                    
                    <div class="flex flex-wrap justify-center gap-2 mt-2 w-full">
                        <span class="bg-sky-900/40 border border-sky-700/50 text-sky-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm">${escapeHTML(char.racaName)}</span>
                        <span class="bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm">${escapeHTML(char.classeName)}</span>
                        ${subHtml}
                    </div>
                </div>
            </div>

            <div class="flex-grow w-full flex flex-col pt-2 md:pt-4">
                <h2 class="text-4xl md:text-5xl font-black font-cinzel text-white mb-6 drop-shadow-md border-b border-slate-700 pb-4 pr-16">${escapeHTML(char.nome)}</h2>
                
                <div class="bg-slate-900/40 p-6 rounded-2xl border border-slate-700/80 shadow-inner relative overflow-hidden transition-all duration-500">
                    <i class="fas fa-quote-left absolute top-4 left-4 text-4xl text-slate-700/30"></i>
                    
                    <div class="relative z-10">
                        <p id="lore-text-${char.id}" class="text-slate-300 text-base md:text-lg leading-relaxed font-serif text-justify ${isLongLore ? 'line-clamp-5' : ''} transition-all duration-500">
                            ${formattedHistory}
                        </p>
                    </div>

                    ${isLongLore ? `
                        <div class="relative z-10 mt-4 border-t border-slate-700/50 pt-3">
                            <button onclick="window.loreCompendio.toggleLore('${char.id}')" id="btn-lore-${char.id}" class="text-amber-500 hover:text-amber-300 text-xs font-bold uppercase tracking-widest flex items-center transition-colors group">
                                <i class="fas fa-chevron-down mr-2 group-hover:translate-y-1 transition-transform"></i> 
                                <span>Revelar Crônica Completa</span>
                            </button>
                        </div>
                    ` : ''}

                </div>
            </div>

        </article>
    `;
}

// Funções globais de interação
window.loreCompendio = {
    filterBySession: function(val) {
        currentSessionFilter = val;
        renderLoreList();
    },
    
    // Função para Expandir/Encolher a Lore
    toggleLore: function(charId) {
        const textEl = document.getElementById(`lore-text-${charId}`);
        const btnEl = document.getElementById(`btn-lore-${charId}`);
        
        if (!textEl || !btnEl) return;

        if (textEl.classList.contains('line-clamp-5')) {
            textEl.classList.remove('line-clamp-5');
            btnEl.innerHTML = '<i class="fas fa-chevron-up mr-2 group-hover:-translate-y-1 transition-transform"></i> <span>Ocultar Crônica</span>';
        } else {
            textEl.classList.add('line-clamp-5');
            btnEl.innerHTML = '<i class="fas fa-chevron-down mr-2 group-hover:translate-y-1 transition-transform"></i> <span>Revelar Crônica Completa</span>';
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