import { db, doc, updateDoc, runTransaction, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// 1. Controle das Sub-Abas do Diário
window.switchCollectionTab = function(tabId) {
    if (!globalState.collectionUI) globalState.collectionUI = { activeTab: 'crafts' };
    
    globalState.collectionUI.activeTab = tabId;
    window.renderCollectionTab(); 
};

// 2. Renderizador Principal da Aba
export function renderCollectionTab() {
    const container = document.getElementById('colecao-craft-content');
    if (!container) return;
    
    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }

    if (!globalState.collectionUI) globalState.collectionUI = { activeTab: 'crafts' };
    const active = globalState.collectionUI.activeTab;

    let html = `
        <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2 relative z-20">
            <div>
                <h2 class="font-cinzel text-2xl text-amber-500 m-0 border-none p-0">Enciclopédia & Coleções</h2>
                <p class="text-xs text-slate-400">Seu diário pessoal de conquistas, mapas e bestiário.</p>
            </div>
        </div>

        <div class="sub-nav-container mb-6 overflow-x-auto pb-0">
            <button class="sub-tab-btn ${active === 'crafts' ? 'active' : ''}" onclick="window.switchCollectionTab('crafts')"><i class="fas fa-hammer mr-2"></i>Crafts Feitos</button>
            <button class="sub-tab-btn ${active === 'players' ? 'active' : ''}" onclick="window.switchCollectionTab('players')"><i class="fas fa-users mr-2"></i>Aventureiros</button>
            <button class="sub-tab-btn ${active === 'npcs' ? 'active' : ''}" onclick="window.switchCollectionTab('npcs')"><i class="fas fa-user-tie mr-2"></i>Personagens (NPCs)</button>
            <button class="sub-tab-btn ${active === 'monsters' ? 'active' : ''}" onclick="window.switchCollectionTab('monsters')"><i class="fas fa-dragon mr-2"></i>Bestiário</button>
            <button class="sub-tab-btn ${active === 'cities' ? 'active' : ''}" onclick="window.switchCollectionTab('cities')"><i class="fas fa-city mr-2"></i>Locais Descobertos</button>
        </div>

        <div id="collection-dynamic-content" class="min-h-[500px]">
        </div>
    `;

    container.innerHTML = html;
    const dynContainer = document.getElementById('collection-dynamic-content');

    // Distribuidor de Telas
    if (active === 'crafts') renderCollectionCrafts(dynContainer, charData);
    else if (active === 'players') renderCollectionEntities(dynContainer, charData, 'colecao_jogadores', 'Aventureiros Conhecidos');
    else if (active === 'npcs') renderCollectionEntities(dynContainer, charData, 'colecao_npcs', 'Habitantes do Mundo');
    else if (active === 'monsters') renderCollectionEntities(dynContainer, charData, 'colecao_monstros', 'Bestiário de Combate');
    else if (active === 'cities') renderCollectionCities(dynContainer, charData);
}
window.renderCollectionTab = renderCollectionTab;

// 3. Tela de Crafts (Expandível/Sanfona Mantido)
function renderCollectionCrafts(container, charData) {
    container.innerHTML = `
        <div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
            <div class="text-center mb-8">
                <p class="text-slate-400 text-sm">Registre seus feitos artesanais. Itens criados pela primeira vez concedem recompensas.</p>
            </div>
            <div id="collection-grid-container" class="space-y-8"></div>
            <div class="mt-10 p-4 bg-slate-800 rounded-lg border border-slate-600 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
                <div class="text-left space-y-1">
                    <h4 class="text-amber-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-gift mr-2"></i>Recompensas de Maestria</h4>
                    <p class="text-slate-300 text-xs">a. Crafte um item inédito para liberar o resgate.</p>
                    <p class="text-emerald-400 text-xs font-bold">b. Cada resgate concede +200 XP imediato.</p>
                    <p class="text-sky-400 text-xs font-bold">c. A cada 5 resgates, ganhe +20 AP (Permanente).</p>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-500 uppercase font-bold mb-1">Total Resgatado</div>
                    <div id="collection-total-count" class="text-4xl font-cinzel text-white font-bold">0</div>
                </div>
            </div>
        </div>
    `;

    const gridContainer = document.getElementById('collection-grid-container');
    const totalDisplay = document.getElementById('collection-total-count');
    
    const progresso = charData.ficha.livro_receitas || {};
    const totalResgatados = Object.values(progresso).filter(p => p.resgatado).length;
    totalDisplay.textContent = totalResgatados;

    const recipesByProf = {};
    globalState.cache.receitas.forEach(rec => {
        const profId = rec.profissaoId || 'geral'; 
        if (!recipesByProf[profId]) recipesByProf[profId] = [];
        recipesByProf[profId].push(rec);
    });

    Object.keys(recipesByProf).sort().forEach(profId => {
        const recipes = recipesByProf[profId];
        const profInfo = globalState.cache.profissoes.get(profId);
        const profName = profInfo ? profInfo.nome : (profId === 'geral' ? 'Geral' : profId);
        
        const totalProf = recipes.length;
        const unlockedProf = recipes.filter(r => progresso[r.id]?.resgatado).length;
        const pct = Math.floor((unlockedProf / totalProf) * 100);
        
        const pctColor = pct === 100 ? 'text-emerald-400' : 'text-amber-400';

        const groupDiv = document.createElement('div');
        groupDiv.className = 'collection-group';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'collection-header-accordion';
        headerDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-book text-slate-500"></i>
                <span class="text-slate-200 font-bold uppercase text-sm tracking-wide">${profName}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-xs font-mono font-bold ${pctColor}">${pct}% Completo</span>
                <i class="fas fa-chevron-down collection-arrow"></i>
            </div>
        `;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'collection-content-accordion collection-grid';
        contentDiv.style.gridTemplateColumns = "repeat(auto-fill, minmax(70px, 1fr))";
        contentDiv.style.gap = "0.75rem";

        recipes.forEach(rec => {
            const itemInfo = globalState.cache.itens.get(rec.itemId);
            const status = progresso[rec.id] || { craftado: false, resgatado: false };
            
            const slot = document.createElement('div');
            let classes = 'collection-slot';
            let tooltip = 'Não descoberto';

            if (status.resgatado) {
                classes += ' collected';
                tooltip = 'Resgatado';
            } else if (status.craftado) {
                classes += ' claimable';
                tooltip = 'CLIQUE PARA RESGATAR!';
                slot.onclick = (e) => {
                    e.stopPropagation(); 
                    window.claimReward(rec.id, rec.nome);
                };
            }

            slot.className = classes;
            slot.title = `${rec.nome}\n(${tooltip})`;
            slot.innerHTML = `<img src="${itemInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL}">`;
            contentDiv.appendChild(slot);
        });

        headerDiv.addEventListener('click', () => {
            const isClosed = !contentDiv.classList.contains('show');
            if (isClosed) {
                contentDiv.classList.add('show');
                headerDiv.classList.add('active');
            } else {
                contentDiv.classList.remove('show');
                headerDiv.classList.remove('active');
            }
        });

        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(contentDiv);
        gridContainer.appendChild(groupDiv);
    });
}

// 4. Tela de Entidades (Filtragem Melhorada para NPCs vs Monstros)
function renderCollectionEntities(container, charData, collectionKey, title) {
    const colecao = charData.ficha[collectionKey] || {};
    const knownIds = Object.keys(colecao);
    
    let allEntities = [];
    if (collectionKey === 'colecao_jogadores') {
        const cacheToUse = globalState.cache.players || new Map();
        knownIds.forEach(id => { const p = cacheToUse.get(id); if(p) allEntities.push(p); });
    } 
    else if (collectionKey === 'colecao_npcs') {
        const cacheNpcs = globalState.cache.npcs || new Map();
        cacheNpcs.forEach(n => allEntities.push(n));
        
        const cacheMobs = globalState.cache.mobs || new Map();
        cacheMobs.forEach(m => {
            const mTipo = String(m.tipo || '').toLowerCase().trim();
            const mCat = String(m.categoria || '').toLowerCase().trim();
            const mType = String(m.type || '').toLowerCase().trim();

            const isNpc = mType === 'npc' || 
                          m.collection === 'rpg_Npcs' || 
                          mTipo === 'npc' || mTipo === 'personagem' || 
                          mCat === 'npc' || mCat === 'personagem';

            if (isNpc && !allEntities.some(e => e.id === m.id)) {
                allEntities.push(m);
            }
        });
    } 
    else if (collectionKey === 'colecao_monstros') {
        const cacheMobs = globalState.cache.mobs || new Map();
        cacheMobs.forEach(m => {
            const mTipo = String(m.tipo || '').toLowerCase().trim();
            const mCat = String(m.categoria || '').toLowerCase().trim();
            const mType = String(m.type || '').toLowerCase().trim();

            const isNpc = mType === 'npc' || 
                          m.collection === 'rpg_Npcs' || 
                          mTipo === 'npc' || mTipo === 'personagem' || 
                          mCat === 'npc' || mCat === 'personagem';

            if (!isNpc) {
                allEntities.push(m);
            }
        });
    }

    allEntities.sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));

    if (allEntities.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-10 italic">Nenhum registro encontrado nesta categoria.</p>`;
        return;
    }

    const total = allEntities.length;
    const discovered = collectionKey === 'colecao_jogadores' ? total : allEntities.filter(e => knownIds.includes(e.id)).length;
    const totalClaimed = allEntities.filter(e => typeof colecao[e.id] === 'object' && colecao[e.id].resgatado).length;
    const pct = total > 0 ? Math.floor((discovered / total) * 100) : 0;

    let rewardText = "";
    if (collectionKey === 'colecao_jogadores') rewardText = "<p class='text-emerald-400 text-xs font-bold'>b. +20 EXP e +2 Reputação por aventureiro.</p>";
    else if (collectionKey === 'colecao_npcs') rewardText = "<p class='text-amber-400 text-xs font-bold'>b. +5 de Reputação por NPC.</p>";
    else if (collectionKey === 'colecao_monstros') rewardText = "<p class='text-rose-400 text-xs font-bold'>b. +25 EXP e +1 AP por monstro.</p>";

    let html = `
        <div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
            <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h3 class="text-xl font-cinzel text-amber-400">${title}</h3>
                    <p class="text-xs text-slate-400">Progresso de Descoberta: <span class="text-white font-bold">${discovered} / ${total}</span></p>
                </div>
                <div class="w-1/3 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div class="h-full bg-amber-500 transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
            </div>
            <div class="collection-grid" style="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 1rem;">
    `;

    allEntities.forEach(ent => {
        const status = colecao[ent.id];
        const isKnown = status !== undefined;
        const isClaimed = typeof status === 'object' && status.resgatado === true;
        const canClaim = isKnown && !isClaimed;

        const img = ent.imageUrls?.imagem1 || ent.imagemUrl || PLACEHOLDER_IMAGE_URL;
        const name = ent.nome || 'Desconhecido';

        let classes = 'collection-slot relative group';
        let tooltip = isKnown ? (isClaimed ? 'Resgatado' : 'CLIQUE PARA RESGATAR!') : 'Não Encontrado';
        let clickAttr = '';

        if (isClaimed) {
            classes += ' collected';
        } else if (canClaim) {
            classes += ' claimable';
            clickAttr = `onclick="window.claimCollectionReward('${collectionKey}', '${ent.id}', '${escapeHTML(name)}')"`;
        }

        html += `
            <div>
                <div class="${classes}" title="${name}\n(${tooltip})" ${clickAttr}>
                    <img src="${img}">
                    ${!isKnown ? '<i class="fas fa-question text-3xl text-slate-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-md"></i>' : ''}
                </div>
                <div class="mt-2 text-center">
                    <div class="text-[10px] font-bold ${isKnown ? 'text-slate-200' : 'text-slate-600'} truncate" title="${name}">${isKnown ? name : '???'}</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            
            <div class="mt-10 p-4 bg-slate-800 rounded-lg border border-slate-600 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
                <div class="text-left space-y-1">
                    <h4 class="text-amber-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-gift mr-2"></i>Recompensas de Exploração</h4>
                    <p class="text-slate-300 text-xs">a. Encontre pelo mundo (Arena) para liberar o resgate.</p>
                    ${rewardText}
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-500 uppercase font-bold mb-1">Total Resgatado</div>
                    <div class="text-4xl font-cinzel text-white font-bold">${totalClaimed}</div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// 5. Tela de Cidades (Exploração)
function renderCollectionCities(container, charData) {
    const collectionKey = 'colecao_cidades';
    const colecao = charData.ficha[collectionKey] || {};
    const knownIds = Object.keys(colecao);
    const allLocations = globalState.world.locations || [];
    
    allLocations.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    if (allLocations.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-10 italic">Nenhum local cadastrado no mundo.</p>`;
        return;
    }

    const total = allLocations.length;
    const discovered = allLocations.filter(e => knownIds.includes(e.id)).length;
    const totalClaimed = allLocations.filter(e => typeof colecao[e.id] === 'object' && colecao[e.id].resgatado).length;
    const pct = total > 0 ? Math.floor((discovered / total) * 100) : 0;

    let html = `
        <div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
            <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h3 class="text-xl font-cinzel text-sky-400">Cartografia & Locais</h3>
                    <p class="text-xs text-slate-400">Progresso de Exploração: <span class="text-white font-bold">${discovered} / ${total}</span></p>
                </div>
                <div class="w-1/3 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div class="h-full bg-sky-500 transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
            </div>
            <div class="collection-grid" style="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 1rem;">
    `;

    allLocations.forEach(loc => {
        const status = colecao[loc.id];
        const isKnown = status !== undefined;
        const isClaimed = typeof status === 'object' && status.resgatado === true;
        const canClaim = isKnown && !isClaimed;

        const name = loc.name || 'Local Desconhecido';
        const img = loc.imagemUrl || PLACEHOLDER_IMAGE_URL;

        let classes = 'collection-slot relative group';
        let tooltip = isKnown ? (isClaimed ? 'Resgatado' : 'CLIQUE PARA RESGATAR!') : 'Não Encontrado';
        let clickAttr = '';

        if (isClaimed) {
            classes += ' collected';
        } else if (canClaim) {
            classes += ' claimable';
            clickAttr = `onclick="window.claimCollectionReward('${collectionKey}', '${loc.id}', '${escapeHTML(name)}')"`
        }

        html += `
            <div>
                <div class="${classes}" title="${name}\n(${tooltip})" ${clickAttr}>
                    <img src="${img}">
                    ${!isKnown ? '<i class="fas fa-question text-3xl text-slate-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-md"></i>' : ''}
                </div>
                <div class="mt-2 text-center">
                    <div class="text-[10px] font-bold ${isKnown ? 'text-sky-400' : 'text-slate-600'} truncate" title="${name}">${isKnown ? name : '???'}</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            
            <div class="mt-10 p-4 bg-slate-800 rounded-lg border border-slate-600 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
                <div class="text-left space-y-1">
                    <h4 class="text-amber-400 font-bold uppercase text-xs tracking-widest"><i class="fas fa-gift mr-2"></i>Recompensas de Cartografia</h4>
                    <p class="text-slate-300 text-xs">a. Dissipe a névoa no mapa para descobrir novas cidades.</p>
                    <p class="text-sky-400 text-xs font-bold">b. Cada cidade mapeada concede +10 de Reputação.</p>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-500 uppercase font-bold mb-1">Total Resgatado</div>
                    <div class="text-4xl font-cinzel text-white font-bold">${totalClaimed}</div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// 6. Resgate de Recompensas de Coleção
window.claimCollectionReward = async function(collectionKey, entityId, entityName) {
    if (!confirm(`Resgatar recompensa por descobrir "${entityName}"?`)) return;

    const charId = globalState.selectedCharacterId;
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            
            const colecao = d[collectionKey] || {};
            const status = colecao[entityId];

            if (!status || (typeof status === 'object' && status.resgatado)) {
                throw "Recompensa já resgatada ou inválida.";
            }

            const dataDescoberta = typeof status === 'object' ? status.dataDescoberta : status;

            const updates = {
                [`${collectionKey}.${entityId}`]: {
                    dataDescoberta: dataDescoberta,
                    dataResgate: Date.now(),
                    resgatado: true
                }
            };

            let msgExtra = "";
            if (collectionKey === 'colecao_jogadores') {
                updates.experienciapersonagemBase = increment(20);
                msgExtra = "Você recebeu +20 EXP e +2 de Reputação!";
            } else if (collectionKey === 'colecao_npcs') {
                msgExtra = "Você recebeu +5 de Reputação!";
            } else if (collectionKey === 'colecao_monstros') {
                updates.experienciapersonagemBase = increment(25);
                updates.apBonusColecao = increment(1); 
                updates.apPersonagemBase = increment(1);
                msgExtra = "Você recebeu +25 EXP e +1 AP!";
            } else if (collectionKey === 'colecao_cidades') {
                msgExtra = "Você mapeou este local e recebeu +10 de Reputação!";
            }

            t.update(ref, updates);
            return msgExtra;
            
        }).then(msg => {
            alert(`Recompensa resgatada com sucesso!\n${msg}`);
            window.renderCollectionTab();
        });
        
    } catch(e) {
        console.error(e);
        alert("Erro ao resgatar: " + e);
    }
};

// 7. Resgate de Craft
window.claimReward = async function(recipeId, recipeName) {
    const charId = globalState.selectedCharacterId;
    if (!confirm(`Resgatar recompensa de "${recipeName}"?\n(+200 XP)`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const livro = d.livro_receitas || {};

            if (!livro[recipeId]?.craftado || livro[recipeId]?.resgatado) throw "Inválido.";

            let count = 0;
            for (let k in livro) { if (livro[k].resgatado) count++; }
            const novoTotal = count + 1;

            const updates = {
                [`livro_receitas.${recipeId}.resgatado`]: true,
                [`livro_receitas.${recipeId}.dataResgate`]: Date.now(),
                experienciapersonagemBase: increment(200)
            };

            let msgExtra = "";
            if (novoTotal % 5 === 0) {
                updates.apBonusColecao = increment(20); 
                updates.apPersonagemBase = increment(20);
                msgExtra = "\nBÔNUS: +20 AP por completar 5 resgates!";
            }

            t.update(ref, updates);
            return msgExtra;
        }).then(msg => {
            alert("Recompensa resgatada com sucesso! (+200 XP)" + msg);
            window.renderCollectionTab();
        });
    } catch (e) {
        console.error(e);
        alert("Erro: " + e);
    }
};

// 8. Radar de Cidades (Chamado pelo Mapa)
export async function checkAndDiscoverCities(revealedHexes) {
    if (!revealedHexes || revealedHexes.length === 0) return;
    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    const ficha = globalState.selectedCharacterData.ficha;
    const colecaoCidades = ficha.colecao_cidades || {};
    let hasNewDiscoveries = false;
    const updates = {};

    // Baseado nas constantes do Mapa
    const HEX_RADIUS = 10;
    const R = HEX_RADIUS;
    const H = R * 2;
    const W = Math.sqrt(3) * R;
    const VERT_DIST = H * 0.75;
    const revealedSet = new Set(revealedHexes);

    globalState.world.locations.forEach(loc => {
        if (loc.x && loc.y) {
            const lx = Number(loc.x);
            const ly = Number(loc.y);
            
            const row = Math.round((ly + (H/2)) / VERT_DIST);
            const xOffset = (row % 2 === 1) ? W / 2 : 0;
            const col = Math.round((lx + (W/2) - xOffset) / W);
            const hexId = `${row}-${col}`;

            if (revealedSet.has(hexId) && !colecaoCidades[loc.id]) {
                updates[`colecao_cidades.${loc.id}`] = Date.now();
                hasNewDiscoveries = true;
            }
        }
    });

    if (hasNewDiscoveries) {
        try {
            await updateDoc(doc(db, "rpg_fichas", charId), updates);
            console.log("Novos locais registrados automaticamente no diário!");
        } catch (e) {
            console.error("Erro ao salvar novos locais:", e);
        }
    }
}
window.checkAndDiscoverCities = checkAndDiscoverCities;