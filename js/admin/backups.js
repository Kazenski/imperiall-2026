import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

const COLLECTIONS_CONFIG = [
    { active: 'rpg_classes', backup: 'rpg_classes_backup', label: 'Classes' },
    { active: 'rpg_habilidades', backup: 'rpg_habilidades_backup', label: 'Habilidades' },
    { active: 'rpg_profissoes', backup: 'rpg_profissoes_backup', label: 'Profissões' },
    { active: 'rpg_racas', backup: 'rpg_racas_backup', label: 'Raças' },
    { active: 'rpg_subclasses', backup: 'rpg_subclasses_backup', label: 'Subclasses' },
    { active: 'rpg_itensCadastrados', backup: 'rpg_itensCadastrados_backup', label: 'Itens Equipáveis' },
    { active: 'rpg_itensMochila', backup: 'rpg_itensMochila_backup', label: 'Itens de Mochila' }
];

let buState = {
    cache: { active: {}, backup: {}, backupExclusives: {} },
    activeView: 'active', // 'active', 'backup', 'backupExclusives'
    activeCollIndex: 0,
    selectedIds: new Set(),
    filter: ''
};

export async function renderBackupsTab() {
    const container = document.getElementById('backups-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-left">
                    <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-purple-500 tracking-widest drop-shadow-md"><i class="fas fa-server mr-3"></i> Central de Backups</h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Gestão de segurança e controle de versão do banco de dados</p>
                </div>
                <button onclick="window.buTools.updateAllBackups()" id="btn-update-all" class="btn bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-colors flex items-center border border-red-500/50">
                    <i class="fas fa-exclamation-triangle mr-2"></i> Sobrescrever Tudo (Forçar Backup)
                </button>
            </header>

            <nav class="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4" id="bu-views-nav">
                <button class="bu-view-btn active bg-slate-800 text-amber-500 border-b-2 border-amber-500 px-6 py-3 font-bold text-sm uppercase tracking-widest" data-view="active">Sistema Vigente</button>
                <button class="bu-view-btn text-slate-400 hover:text-white px-6 py-3 font-bold text-sm uppercase tracking-widest" data-view="backup">Repositório de Backup</button>
                <button class="bu-view-btn text-slate-400 hover:text-white px-6 py-3 font-bold text-sm uppercase tracking-widest" data-view="backupExclusives">Exclusivos do Backup</button>
            </nav>

            <div class="flex flex-wrap gap-2 mb-8" id="bu-colls-nav">
                ${COLLECTIONS_CONFIG.map((cfg, idx) => `
                    <button class="bu-coll-btn ${idx === 0 ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'} px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors" data-idx="${idx}">${cfg.label}</button>
                `).join('')}
            </div>

            <div id="bu-dynamic-content" class="w-full relative min-h-[400px]">
                <div id="bu-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-500 mb-4"></div>
                    <p class="text-purple-400 font-cinzel tracking-widest" id="bu-loading-text">Analisando Blocos de Dados...</p>
                </div>
                <div id="bu-view" class="w-full hidden"></div>
            </div>

        </div>
    `;

    setupNavListeners();
    await loadAllData();
}

function setupNavListeners() {
    const viewsNav = document.getElementById('bu-views-nav');
    const collsNav = document.getElementById('bu-colls-nav');

    viewsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.bu-view-btn');
        if (btn) {
            viewsNav.querySelectorAll('.bu-view-btn').forEach(b => {
                b.classList.remove('active', 'bg-slate-800', 'text-amber-500', 'border-b-2', 'border-amber-500');
                b.classList.add('text-slate-400');
            });
            btn.classList.add('active', 'bg-slate-800', 'text-amber-500', 'border-b-2', 'border-amber-500');
            btn.classList.remove('text-slate-400');
            
            buState.activeView = btn.dataset.view;
            buState.selectedIds.clear();
            renderActiveView();
        }
    });

    collsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.bu-coll-btn');
        if (btn) {
            collsNav.querySelectorAll('.bu-coll-btn').forEach(b => {
                b.classList.remove('bg-purple-600', 'text-white');
                b.classList.add('bg-slate-800', 'text-slate-400');
            });
            btn.classList.remove('bg-slate-800', 'text-slate-400');
            btn.classList.add('bg-purple-600', 'text-white');
            
            buState.activeCollIndex = parseInt(btn.dataset.idx);
            buState.selectedIds.clear();
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        setLoading(true, "Mapeando coleções...");
        const newCache = { active: {}, backup: {}, backupExclusives: {} };
        const promises = [];

        COLLECTIONS_CONFIG.forEach((cfg, idx) => {
            promises.push(
                Promise.all([
                    getDocs(collection(db, cfg.active)),
                    getDocs(collection(db, cfg.backup))
                ]).then(([activeSnap, backupSnap]) => {
                    const activeData = activeSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
                    const backupData = backupSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
                    
                    const activeIds = new Set(activeData.map(d => d.id));
                    const backupExclusives = backupData.filter(d => !activeIds.has(d.id));

                    newCache.active[idx] = activeData;
                    newCache.backup[idx] = backupData;
                    newCache.backupExclusives[idx] = backupExclusives;
                })
            );
        });

        await Promise.all(promises);
        buState.cache = newCache;
        setLoading(false);
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('bu-loading').innerHTML = '<p class="text-red-500 font-bold p-10">Erro fatal na leitura do banco de dados.</p>';
    }
}

function setLoading(isLoad, msg = "Processando...") {
    const loader = document.getElementById('bu-loading');
    const view = document.getElementById('bu-view');
    const text = document.getElementById('bu-loading-text');
    if(!loader || !view) return;

    if(isLoad) {
        if(text) text.textContent = msg;
        loader.classList.remove('hidden');
        view.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        view.classList.remove('hidden');
    }
}

function renderActiveView() {
    const viewEl = document.getElementById('bu-view');
    if (!viewEl) return;

    const dataList = buState.cache[buState.activeView][buState.activeCollIndex] || [];
    const cfg = COLLECTIONS_CONFIG[buState.activeCollIndex];
    
    const term = buState.filter.toLowerCase();
    const filtered = dataList.filter(i => (i.nome||i.id||'').toLowerCase().includes(term));
    const isAllSelected = filtered.length > 0 && buState.selectedIds.size === filtered.length;

    let sourceColl, destColl, actionLabel, btnClass, iconClass;
    
    if (buState.activeView === 'active') {
        sourceColl = cfg.active;
        destColl = cfg.backup;
        actionLabel = 'Copiar para Backup';
        btnClass = 'bg-sky-700 hover:bg-sky-600 text-white';
        iconClass = 'fa-copy';
    } else {
        sourceColl = cfg.backup;
        destColl = cfg.active;
        actionLabel = 'Restaurar para Sistema';
        btnClass = 'bg-amber-600 hover:bg-amber-500 text-black';
        iconClass = 'fa-upload';
    }

    viewEl.innerHTML = `
        <div class="bg-slate-800/40 p-6 rounded-2xl border border-slate-700">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <input type="text" placeholder="Buscar em ${cfg.label}..." value="${escapeHTML(buState.filter)}" onkeyup="window.buTools.setFilter(this.value)" class="w-full sm:w-1/2 bg-slate-900 border border-slate-600 px-4 py-3 rounded-xl text-white outline-none focus:border-purple-500">
                <button onclick="window.buTools.executeAction('${sourceColl}', '${destColl}')" class="btn ${btnClass} font-bold py-3 px-6 rounded-xl shadow-lg w-full sm:w-auto flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${buState.selectedIds.size === 0 ? 'disabled' : ''}>
                    <i class="fas ${iconClass}"></i> ${actionLabel} (${buState.selectedIds.size})
                </button>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner max-h-[500px] overflow-y-auto custom-scroll">
                <table class="w-full text-left text-sm text-slate-300 relative border-collapse">
                    <thead class="bg-slate-950 text-purple-400 uppercase text-xs sticky top-0 z-10 shadow-md">
                        <tr>
                            <th class="p-4 w-16 text-center border-b border-r border-slate-700">
                                <input type="checkbox" ${isAllSelected ? 'checked' : ''} onchange="window.buTools.toggleAll(this.checked)" class="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500 cursor-pointer">
                            </th>
                            <th class="p-4 border-b border-r border-slate-700">Nome do Registro</th>
                            <th class="p-4 border-b border-slate-700">ID Interno</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${filtered.length === 0 ? `<tr><td colSpan="3" class="text-center py-10 text-slate-500 italic">Lista vazia.</td></tr>` : ''}
                        ${filtered.map(item => `
                            <tr class="hover:bg-slate-800/60 transition-colors ${buState.selectedIds.has(item.id) ? 'bg-purple-900/10' : ''}">
                                <td class="p-4 text-center border-r border-slate-700">
                                    <input type="checkbox" ${buState.selectedIds.has(item.id) ? 'checked' : ''} onchange="window.buTools.toggleSelect('${item.id}')" class="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500 cursor-pointer">
                                </td>
                                <td class="p-4 font-bold text-white border-r border-slate-700">${escapeHTML(item.nome || 'Sem Nome')}</td>
                                <td class="p-4 font-mono text-xs text-slate-500">${escapeHTML(item.id)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// AÇÕES EXPOSTAS (WINDOW)
// ------------------------------------------------------------------------------------
window.buTools = {
    setFilter: function(val) {
        buState.filter = val;
        renderActiveView();
    },

    toggleSelect: function(id) {
        if(buState.selectedIds.has(id)) buState.selectedIds.delete(id);
        else buState.selectedIds.add(id);
        renderActiveView();
    },

    toggleAll: function(isChecked) {
        const dataList = buState.cache[buState.activeView][buState.activeCollIndex] || [];
        const term = buState.filter.toLowerCase();
        const filtered = dataList.filter(i => (i.nome||i.id||'').toLowerCase().includes(term));
        
        if (isChecked) {
            filtered.forEach(i => buState.selectedIds.add(i.id));
        } else {
            buState.selectedIds.clear();
        }
        renderActiveView();
    },

    executeAction: async function(sourceColl, destColl) {
        if (buState.selectedIds.size === 0) return;
        
        const actionName = buState.activeView === 'active' ? 'salvar no Backup' : 'restaurar para o Sistema';
        if (!confirm(`Deseja ${actionName} ${buState.selectedIds.size} documento(s)?`)) return;

        setLoading(true, "Transferindo dados...");
        try {
            const batch = writeBatch(db);
            let count = 0;

            for (const docId of buState.selectedIds) {
                const docSnap = await getDoc(doc(db, sourceColl, docId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    batch.set(doc(db, destColl, docId), data);
                    count++;
                }
            }

            await batch.commit();
            alert(`Transferência concluída: ${count} arquivo(s) copiado(s).`);
            buState.selectedIds.clear();
            await loadAllData(); // Recarrega os caches
        } catch (e) {
            console.error(e);
            alert("Falha na transferência: " + e.message);
            setLoading(false);
        }
    },

    updateAllBackups: async function() {
        if (!confirm("⚠️ ALERTA VERMELHO!\nIsto irá apagar e sobrescrever todos os dados do Backup com o estado exato atual do Sistema.\nDeseja prosseguir?")) return;
        
        setLoading(true, "Iniciando Backup Global...");
        try {
            const batch = writeBatch(db);
            
            for (const cfg of COLLECTIONS_CONFIG) {
                const snap = await getDocs(collection(db, cfg.active));
                snap.forEach(document => {
                    batch.set(doc(db, cfg.backup, document.id), document.data());
                });
            }

            await batch.commit();
            alert("Backup Global Concluído com Sucesso!");
            await loadAllData();
        } catch (e) {
            console.error(e);
            alert("Falha Crítica no Backup: " + e.message);
            setLoading(false);
        }
    }
};