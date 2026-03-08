import { db, doc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

const ID_SKILL_DOMA = "FYNjwW0wmCHcnUL70XB2"; 
const IMG_FALLBACK = PLACEHOLDER_IMAGE_URL;

// --- SINCRONIA DE XP ---
export async function syncPetXpWithPlayer() {
    const charId = globalState.selectedCharacterId;
    if (!charId) return;
    
    const ficha = globalState.selectedCharacterData.ficha;
    const pets = ficha.pets || [];
    let updated = false;

    const playerXpAtual = Number(ficha.experienciapersonagemBase) || 0;

    pets.forEach(pet => {
        if (typeof pet.lastKnownPlayerXp === 'undefined') {
            pet.lastKnownPlayerXp = playerXpAtual;
            updated = true;
        }

        if (playerXpAtual > pet.lastKnownPlayerXp) {
            const diff = playerXpAtual - pet.lastKnownPlayerXp;
            
            if (pet.ativo === true) {
                let template = null;
                if (globalState.cache.pets) {
                    globalState.cache.pets.forEach(p => { if (p.mobBaseId === pet.mobBaseId) template = p; });
                }
                const taxa = Number(pet.taxaXpJogador) || Number(template?.taxaXpJogador) || 10; 
                
                const xpGanho = Math.floor(diff * (taxa / 100));

                if (xpGanho > 0) {
                    let currentXp = (pet.experienciaAtual || 0) + xpGanho;
                    let currentLevel = pet.level;
                    
                    const xpTable = globalState.cache.tabelaXpPet?.niveis || {};
                    let loops = 0;
                    while(loops < 100) {
                        const reqNext = Number(xpTable[currentLevel + 1]);
                        if (reqNext && currentXp >= reqNext) {
                            currentLevel++;
                        } else {
                            if (!reqNext && currentXp >= (currentLevel * 100)) currentLevel++; 
                            else break;
                        }
                        loops++;
                    }

                    pet.experienciaAtual = currentXp;
                    pet.level = currentLevel;
                    console.log(`[PET SYNC] ${pet.nome} ganhou ${xpGanho} XP.`);
                }
            }
            pet.lastKnownPlayerXp = playerXpAtual;
            updated = true;
        } 
        else if (playerXpAtual < pet.lastKnownPlayerXp) {
            pet.lastKnownPlayerXp = playerXpAtual;
            updated = true;
        }
    });

    if (updated) {
        try {
            const ref = doc(db, "rpg_fichas", charId);
            await updateDoc(ref, { pets: pets });
        } catch(e) { console.error("Erro no sync XP:", e); }
    }
}

// --- RENDERIZAÇÃO DA ABA ---
export function renderPetsTab() {
    const container = document.getElementById('meus-pets-content');
    if (!container) return;

    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }
    
    syncPetXpWithPlayer();

    const ficha = charData.ficha;
    const pets = ficha.pets || []; 
    
    if (globalState.petsUI.tamingMode) {
        renderTamingArena(container);
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[800px]">
            <aside class="lg:col-span-4 bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex flex-col h-full">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                    <h3 class="font-cinzel text-emerald-400 text-lg">Grimório de Vínculos</h3>
                    <span class="text-xs text-slate-500">${pets.length} / 5</span>
                </div>
                
                <div class="flex-grow overflow-y-auto pr-2 space-y-2 custom-scroll mb-4" id="pet-list-container">
                    ${pets.length === 0 ? '<p class="text-slate-500 text-sm text-center italic mt-10 opacity-50">Você ainda não formou vínculos.</p>' : ''}
                </div>

                <button onclick="window.startTamingProcess()" class="btn btn-primary w-full py-4 flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition border border-emerald-500/50">
                    <i class="fas fa-paw"></i> Novo Vínculo (Doma)
                </button>
            </aside>

            <main class="lg:col-span-8 bg-slate-900/50 p-6 rounded-xl border border-slate-700 relative overflow-hidden" id="pet-details-container">
                <div class="h-full flex flex-col items-center justify-center text-slate-500 opacity-30">
                    <i class="fas fa-dragon text-8xl mb-4"></i>
                    <p class="font-cinzel">Selecione um companheiro.</p>
                </div>
            </main>
        </div>
    `;

    const listContainer = document.getElementById('pet-list-container');
    pets.forEach((pet, index) => {
        const isActive = pet.ativo === true;
        const el = document.createElement('div');
        el.className = `pet-list-item ${isActive ? 'active' : ''} ${globalState.petsUI.selectedPetIndex === index ? 'border-emerald-500' : 'border-slate-700'}`;
        el.innerHTML = `
            <img src="${pet.imagemUrl || IMG_FALLBACK}" class="pet-avatar-small ${isActive ? 'border-amber-400' : 'border-slate-600'}">
            <div class="flex-grow">
                <div class="font-bold text-slate-200 text-sm">${escapeHTML(pet.nome)}</div>
                <div class="text-[10px] text-slate-400">Nível ${pet.level} • ${pet.classe || 'Criatura'}</div>
            </div>
            ${isActive ? '<i class="fas fa-star text-amber-400 text-xs animate-pulse" title="Pet Ativo"></i>' : ''}
        `;
        el.onclick = () => {
            globalState.petsUI.selectedPetIndex = index;
            renderPetsTab();
        };
        listContainer.appendChild(el);
    });

    if (globalState.petsUI.selectedPetIndex !== null && pets[globalState.petsUI.selectedPetIndex]) {
        renderPetDetails(document.getElementById('pet-details-container'), pets[globalState.petsUI.selectedPetIndex], globalState.petsUI.selectedPetIndex);
    }
}

function renderPetDetails(container, pet, index) {
    let template = null;
    if (globalState.cache.pets) {
        for (const [id, tpl] of globalState.cache.pets) {
            if (tpl.mobBaseId === pet.mobBaseId) {
                template = tpl; break;
            }
        }
    }

    const itensProducao = (pet.itensProducao && pet.itensProducao.length > 0) ? pet.itensProducao : (template?.itensProducao || []);
    const habilidadesIds = (pet.habilidadesConhecidas && pet.habilidadesConhecidas.length > 0) ? pet.habilidadesConhecidas : (template?.habilidadesConhecidas || []);
    const efeitoTexto = pet.efeitoEspecial || template?.efeitoEspecial;
    const taxaXP = pet.taxaXpJogador || template?.taxaXpJogador || 10;
    
    const isApproved = pet.aprovado !== false; 

    const xpTable = globalState.cache.tabelaXpPet?.niveis || {};
    const xpNext = xpTable[pet.level + 1] || (pet.level * 100);
    const xpPrev = xpTable[pet.level] || 0;
    const xpDiff = Math.max(1, xpNext - xpPrev);
    const pct = Math.min(100, Math.max(0, ((pet.experienciaAtual - xpPrev) / xpDiff) * 100));

    let prodHtml = '';
    if (itensProducao.length > 0) {
        const qtd = Math.ceil(pet.level / 5);
        prodHtml = `
            <div class="bg-slate-800 p-4 rounded border border-slate-600 mb-4 shadow-lg">
                <h4 class="text-xs font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                    <i class="fas fa-gift"></i> Coleta Diária (Automática)
                </h4>
                <div class="grid grid-cols-1 gap-2">
                    ${itensProducao.map(i => {
                        const itemCache = globalState.cache.itens.get(i.id); 
                        const imgUrl = itemCache?.imagemUrl || IMG_FALLBACK;
                        return `
                            <div class="flex items-center gap-3 bg-slate-900 p-2 rounded border border-slate-700">
                                <img src="${imgUrl}" class="w-8 h-8 rounded bg-black object-contain">
                                <div class="flex-grow text-sm text-slate-300">${escapeHTML(i.nome)}</div>
                                <span class="font-bold text-emerald-400 bg-emerald-900/30 px-2 rounded">x${qtd}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        prodHtml = `<div class="text-xs text-slate-500 mb-4 italic p-2 border border-dashed border-slate-700 rounded text-center">Este pet não coleta recursos.</div>`;
    }

    let effectHtml = '';
    if (efeitoTexto) {
        effectHtml = `
            <div class="bg-indigo-900/20 p-4 rounded border border-indigo-500/30 mb-4 text-xs text-indigo-200 shadow-lg">
                <strong class="text-indigo-400 block mb-2 uppercase font-bold flex items-center gap-2"><i class="fas fa-star"></i> Vínculo Especial</strong>
                ${escapeHTML(efeitoTexto)}
            </div>
        `;
    }

    let invokeBtnHtml = '';
    if (isApproved) {
        invokeBtnHtml = pet.ativo 
            ? `<button onclick="window.togglePetActive(${index}, false)" class="btn bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700 text-xs w-full">Recolher</button>`
            : `<button onclick="window.togglePetActive(${index}, true)" class="btn btn-green text-xs shadow-lg w-full">Invocar</button>`;
    } else {
        invokeBtnHtml = `<button class="btn bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed text-xs w-full" disabled><i class="fas fa-lock mr-1"></i> Bloqueado</button>`;
    }

    let actionBtnsHtml = '';
    if (isApproved) {
        actionBtnsHtml = `
            <div class="mt-auto grid grid-cols-2 gap-3">
                <button onclick="window.openFeedingModal(${index})" class="btn bg-slate-800 border border-slate-600 text-slate-300 hover:text-white text-xs py-3">
                    <i class="fas fa-drumstick-bite mr-2"></i> Alimentar
                </button>
                <button onclick="window.releasePet(${index})" class="btn bg-red-900/10 border border-red-900 text-red-500 hover:bg-red-900/30 text-xs py-3">
                    <i class="fas fa-heart-broken mr-2"></i> Libertar
                </button>
            </div>
        `;
    } else {
        actionBtnsHtml = `
            <div class="mt-auto bg-amber-900/20 border border-amber-800 text-amber-500 p-4 rounded text-center text-xs font-bold shadow-lg">
                <i class="fas fa-hourglass-half mr-2 animate-pulse text-lg mb-2"></i><br>
                Aguardando Aprovação do Mestre
                ${globalState.isAdmin ? `<br><button onclick="window.approvePet(${index})" class="mt-3 btn btn-green w-full py-2 shadow-lg text-white tracking-widest uppercase"><i class="fas fa-check-circle mr-1"></i> Confirmar Vínculo Agora</button>` : ''}
            </div>
            <button onclick="window.releasePet(${index})" class="mt-2 btn bg-red-900/10 border border-red-900 text-red-500 hover:bg-red-900/30 text-[10px] py-2 w-full">Cancelar Vínculo</button>
        `;
    }

    container.innerHTML = `
        <div class="flex flex-col h-full overflow-y-auto pr-2 custom-scroll relative">
            <div id="feeding-modal-area"></div>

            <div class="flex flex-col md:flex-row items-center md:items-start justify-between mb-6 gap-4 border-b border-slate-700 pb-6">
                <div class="flex items-center gap-5">
                    <div class="w-28 h-28 rounded-full border-4 ${pet.ativo ? 'pet-rainbow-border border-transparent' : 'border-slate-600'} overflow-hidden bg-black shadow-2xl shrink-0 relative ${!isApproved ? 'grayscale opacity-70' : ''}">
                        <img src="${pet.imagemUrl || IMG_FALLBACK}" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <h2 class="text-3xl font-cinzel ${pet.ativo ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-emerald-400' : 'text-slate-200'} font-bold mb-1">${escapeHTML(pet.nome)}</h2>
                        <div class="text-sm text-slate-500 uppercase tracking-widest font-bold mb-2">Nível ${pet.level} • ${escapeHTML(template?.nome || 'Criatura')}</div>
                        <div class="flex gap-2">
                             <span class="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-600 text-slate-400" title="Taxa de XP compartilhada">${taxaXP}% XP Share</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-2 min-w-[120px]">
                    ${invokeBtnHtml}
                </div>
            </div>

            <div class="mb-8 relative group ${!isApproved ? 'opacity-50' : ''}">
                <div class="flex justify-between text-[10px] text-slate-400 mb-1 font-bold uppercase">
                    <span>Experiência</span>
                    <span>${Math.floor(pet.experienciaAtual)} / ${xpNext}</span>
                </div>
                <div class="w-full h-4 bg-slate-950 rounded-full border border-slate-700 overflow-hidden shadow-inner">
                    <div class="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700 relative" style="width: ${pct}%"></div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div class="flex flex-col gap-4">
                    ${prodHtml}
                    ${effectHtml}
                    ${actionBtnsHtml}
                </div>

                <div class="bg-slate-900 p-4 rounded border border-slate-700 flex flex-col h-full min-h-[300px]">
                    <h4 class="text-xs font-bold text-slate-400 uppercase mb-4 border-b border-slate-700 pb-2">Habilidades Despertadas</h4>
                    <div class="space-y-3 flex-grow overflow-y-auto custom-scroll pr-2 ${!isApproved ? 'opacity-50 blur-[1px]' : ''}">
                        ${renderPetSkillsList(pet, habilidadesIds)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPetSkillsList(pet, skillIds) {
    if (!skillIds || skillIds.length === 0) return '<div class="text-slate-600 text-xs italic text-center mt-10">Este pet ainda não despertou habilidades.</div>';

    return skillIds.map(skillId => {
        const skillData = globalState.cache.habilidadesPet.get(skillId);
        if (!skillData) return ''; 
        
        const isUnlocked = pet.level >= (skillData.levelRequerido || 1);
        
        return `
            <div class="bg-slate-800 p-3 rounded border ${isUnlocked ? 'border-slate-600' : 'border-slate-800 opacity-40 grayscale'} transition-all hover:border-slate-500">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-bold ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}">${escapeHTML(skillData.nome)}</span>
                    ${!isUnlocked ? `<span class="text-[9px] text-red-400 border border-red-900/50 bg-red-900/10 px-2 py-0.5 rounded font-mono">Req Lv ${skillData.levelRequerido}</span>` : ''}
                </div>
                <div class="text-[11px] text-slate-300 leading-snug mb-2">${escapeHTML(skillData.descricao)}</div>
                ${isUnlocked && skillData.efeito ? `<div class="text-[10px] text-blue-300 font-mono bg-black/30 p-2 rounded border border-blue-900/30"><i class="fas fa-code mr-1"></i> ${escapeHTML(skillData.efeito)}</div>` : ''}
            </div>
        `;
    }).join('');
}

// --- ALIMENTAÇÃO ---
window.openFeedingModal = function(petIndex) {
    const ficha = globalState.selectedCharacterData.ficha;
    const pet = ficha.pets[petIndex];
    const modal = document.getElementById('feeding-modal-area');
    
    let template = null;
    globalState.cache.pets.forEach(p => { if (p.mobBaseId === pet.mobBaseId) template = p; });
    const itensDieta = pet.itensConsumiveis || template?.itensConsumiveis || [];
    
    if (itensDieta.length === 0) {
        alert("Este pet não possui uma dieta configurada.");
        return;
    }

    const mochila = ficha.mochila || {};
    const validItems = [];
    
    itensDieta.forEach(dietItem => {
        if (mochila[dietItem.itemId] > 0) {
            const itemInfo = globalState.cache.itens.get(dietItem.itemId);
            if (itemInfo) {
                validItems.push({
                    ...dietItem,
                    qtd: mochila[dietItem.itemId],
                    img: itemInfo.imagemUrl,
                    nome: itemInfo.nome
                });
            }
        }
    });

    modal.innerHTML = `
        <div class="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur flex items-center justify-center p-6 rounded-xl animate-fade-in">
            <div class="w-full max-w-lg bg-slate-800 border border-slate-600 rounded-lg p-6 shadow-2xl relative">
                <button onclick="document.getElementById('feeding-modal-area').innerHTML = ''" class="absolute top-3 right-3 text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                <h3 class="text-xl font-cinzel text-emerald-400 mb-4">Alimentar ${escapeHTML(pet.nome)}</h3>
                <p class="text-sm text-slate-400 mb-4">Selecione um item da mochila:</p>
                <div class="food-grid max-h-60 overflow-y-auto custom-scroll p-1">
                    ${validItems.length > 0 ? validItems.map(item => `
                        <div onclick="window.feedPet(${petIndex}, '${item.itemId}', ${item.xp})" class="food-slot group">
                            <img src="${item.img || IMG_FALLBACK}" class="w-full h-full object-cover rounded">
                            <span class="food-qty">x${item.qtd}</span>
                            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-green-400 transition-opacity rounded">+${item.xp} XP</div>
                        </div>
                    `).join('') : '<p class="col-span-full text-center text-slate-500 italic py-4">Você não tem nada que ele goste.</p>'}
                </div>
            </div>
        </div>
    `;
};

window.feedPet = async function(petIndex, itemId, xpAmount) {
    document.getElementById('feeding-modal-area').innerHTML = ''; 
    const charId = globalState.selectedCharacterId;
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const mochila = d.mochila || {};
            const pets = d.pets || [];
            
            if (!pets[petIndex]) throw "Pet não encontrado.";
            if (!mochila[itemId] || mochila[itemId] < 1) throw "Item acabou.";
            
            if (mochila[itemId] === 1) delete mochila[itemId]; else mochila[itemId]--;
            
            const pet = pets[petIndex];
            let currentXp = (pet.experienciaAtual || 0) + xpAmount;
            let currentLevel = pet.level;
            
            const xpTable = globalState.cache.tabelaXpPet?.niveis || {};
            let loops = 0;
            while(loops < 100) {
                const reqNext = xpTable[currentLevel + 1];
                if (reqNext && currentXp >= reqNext) {
                    currentLevel++;
                } else {
                    break;
                }
                loops++;
            }
            pet.level = currentLevel;
            pet.experienciaAtual = currentXp;
            t.update(ref, { mochila, pets });
        });
    } catch (e) {
        console.error(e);
        alert("Erro ao alimentar: " + e);
    }
};

// --- SISTEMA DE DOMA ---
window.startTamingProcess = function() {
    const mochila = globalState.selectedCharacterData.ficha.mochila || {};
    const SELA_ID = 'FYNjwW0wmCHcnUL70XB2';
    
    if (!mochila[SELA_ID] || mochila[SELA_ID] < 1) {
        alert("Você precisa de uma 'Sela do Vínculo' na mochila para tentar domar uma criatura.");
        return;
    }

    const container = document.getElementById('pet-details-container');
    let mobs = Array.from(globalState.cache.mobs.values());
    mobs.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));

    if (mobs.length === 0) {
        container.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-slate-500"><i class="fas fa-ghost text-4xl mb-4"></i><p>Nenhuma criatura avistada.</p><button onclick="window.renderPetsTab()" class="mt-4 btn btn-secondary btn-sm">Voltar</button></div>`;
        return;
    }
    
    container.innerHTML = `
        <div class="h-full flex flex-col animate-fade-in overflow-hidden">
            <h3 class="text-xl font-cinzel text-amber-400 mb-4 flex items-center gap-2"><i class="fas fa-dragon"></i> Criaturas Avistadas (${mobs.length})</h3>
            
            <p class="text-sm text-slate-400 mb-6 bg-slate-800/50 p-3 rounded border border-slate-700 flex items-start gap-2">
                <i class="fas fa-info-circle mt-1 text-sky-500"></i>
                <span>Escolha uma criatura para iniciar o <b>Ritual do Vínculo</b>.<br><span class="text-amber-500 text-xs uppercase font-bold">Requerimento:</span> 1x Sela do Vínculo. <br><span class="text-emerald-400">Sujeito à aprovação do Mestre.</span></span>
            </p>
            
            <div class="tame-grid custom-scroll w-full">
                ${mobs.map(m => `
                    <div onclick="window.initTameMinigame('${m.id}')" class="mob-card group">
                        <div class="relative">
                            <img src="${m.imageUrls?.imagem1 || IMG_FALLBACK}" class="opacity-80 group-hover:opacity-100 transition-opacity">
                            ${!m.domavel ? '<span class="absolute top-1 right-1 bg-red-900/90 text-[9px] text-white px-2 py-0.5 rounded font-bold shadow z-10">Boss/NPC</span>' : ''}
                            <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black to-transparent h-12"></div>
                        </div>
                        <div class="p-2 bg-slate-900">
                            <div class="font-bold text-slate-200 group-hover:text-amber-400 text-sm truncate mb-2">${escapeHTML(m.nome || "Criatura")}</div>
                            <div class="flex justify-between items-center bg-slate-800 rounded px-2 py-1 border border-slate-700">
                                <span class="text-[10px] text-slate-400">Nvl ${m.level || 1}</span>
                                <span class="text-[10px] font-mono text-emerald-400 font-bold">${Math.max(10, 90 - (m.level || 1))}% <i class="fas fa-paw"></i></span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="window.renderPetsTab()" class="mt-auto btn btn-secondary self-start px-6 py-2"><i class="fas fa-arrow-left mr-2"></i> Voltar</button>
        </div>
    `;
};

window.initTameMinigame = function(mobId) {
    const mob = globalState.cache.mobs.get(mobId);
    if (!mob) return;

    globalState.petsUI.tamingMode = true;
    globalState.petsUI.tamingTarget = mob;
    globalState.petsUI.tamingProgress = 50; 
    globalState.petsUI.tamingLog = [{ text: `> Você se aproxima de ${mob.nome}...`, type: 'info' }];
    globalState.petsUI.showRules = true; 
    
    const charSkills = globalState.selectedCharacterData.ficha.habilidades || {};
    const skillLevel = charSkills[ID_SKILL_DOMA]?.nivel || 0;
    globalState.petsUI.tamingBonus = 30 + parseInt(skillLevel);

    renderTamingArena(document.getElementById('meus-pets-content'));
};

function renderTamingArena(container) {
    const { tamingTarget: mob, tamingProgress, tamingLog, showRules } = globalState.petsUI;
    const ficha = globalState.selectedCharacterData.ficha;
    const playerKey = ficha.imagemPrincipal;
    const playerImg = (playerKey && ficha.imageUrls && ficha.imageUrls[playerKey]) ? ficha.imageUrls[playerKey] : IMG_FALLBACK;
    
    let barColor = 'bg-amber-500';
    if (tamingProgress < 30) barColor = 'bg-red-500';
    if (tamingProgress > 70) barColor = 'bg-emerald-500';

    container.innerHTML = `
        <div class="flex flex-col h-[650px] max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative mt-4">
            ${showRules ? `
                <div class="tame-rules-overlay" onclick="window.toggleTamingRules(false)">
                    <div class="bg-slate-800 p-8 rounded-xl border border-amber-500/50 max-w-lg shadow-2xl transform transition-all scale-100" onclick="event.stopPropagation()">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-2xl text-amber-400 font-cinzel font-bold">Ritual do Vínculo</h3>
                            <button onclick="window.toggleTamingRules(false)" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                        </div>
                        <p class="text-slate-400 text-sm mb-4">Prove sua força de vontade para domar a criatura. Puxe a barra para 100% para vencer.</p>
                        <ul class="text-left text-xs text-slate-300 space-y-2 mb-4 bg-black/20 p-3 rounded">
                             <li><strong class="text-red-400">Impor Vontade:</strong> Arriscado. Avança muito, recua muito.</li>
                             <li><strong class="text-blue-400">Acalmar:</strong> Seguro. Avança pouco, recua pouco.</li>
                             <li><strong class="text-green-400">Alimentar:</strong> Garante avanço sem risco (requer sorte).</li>
                        </ul>
                        <div class="text-xs text-center text-slate-500 border-t border-slate-700 pt-3">
                            Seu Bônus de Doma: <span class="text-white font-bold bg-slate-700 px-2 py-1 rounded">+${globalState.petsUI.tamingBonus}%</span>
                            <div class="text-[9px] mt-1">(Base 30% Sela + Nível Skill Doma)</div>
                        </div>
                        <button onclick="window.toggleTamingRules(false)" class="mt-6 btn btn-primary w-full py-3 font-bold uppercase tracking-wider">Começar Ritual</button>
                    </div>
                </div>
            ` : ''}
            <div class="h-48 bg-black relative flex items-center justify-between px-16 border-b border-slate-700 overflow-hidden">
                <button onclick="window.toggleTamingRules(true)" class="absolute top-4 right-4 text-slate-400 hover:text-white z-30 bg-black/50 p-2 rounded-full"><i class="fas fa-question-circle text-xl"></i></button>
                <div class="text-center z-10 flex flex-col items-center">
                    <div class="w-24 h-24 rounded-full border-4 border-emerald-500 bg-slate-800 overflow-hidden mb-3 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                         <img src="${playerImg}" class="w-full h-full object-cover"> 
                    </div>
                    <div class="font-bold text-emerald-400 text-lg bg-black/50 px-3 py-1 rounded">Você</div>
                </div>
                <div class="text-6xl font-cinzel text-white/20 font-bold italic z-10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">VS</div>
                <div class="text-center z-10 flex flex-col items-center">
                    <div class="w-24 h-24 rounded-full border-4 border-red-500 bg-slate-800 overflow-hidden mb-3 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                         <img src="${mob.imageUrls?.imagem1 || IMG_FALLBACK}" class="w-full h-full object-cover">
                    </div>
                    <div class="font-bold text-red-400 text-lg bg-black/50 px-3 py-1 rounded">${escapeHTML(mob.nome)}</div>
                </div>
                <div class="absolute inset-0 opacity-30 bg-cover bg-center blur-sm transform scale-110" style="background-image: url('${mob.imageUrls?.imagem1}')"></div>
            </div>
            <div class="p-8 bg-slate-800 border-b border-slate-700 shadow-inner">
                <div class="flex justify-between text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">
                    <span><i class="fas fa-skull mr-1"></i> Fuga</span>
                    <span>Vínculo <i class="fas fa-link ml-1"></i></span>
                </div>
                <div class="tame-progress-container h-6 bg-black/50">
                    <div class="tame-center-line"></div>
                    <div class="tame-progress-bar ${barColor}" style="width: ${tamingProgress}%"></div>
                </div>
            </div>
            <div class="flex-grow flex flex-col p-6 gap-6 bg-slate-900">
                <div class="flex-grow bg-black/20 rounded-lg border border-slate-700/50 p-4 overflow-y-auto font-mono text-sm space-y-2 h-32 custom-scroll shadow-inner" id="taming-log-area">
                    ${tamingLog.map(l => `<div class="${l.type === 'success' ? 'text-green-400' : (l.type === 'fail' ? 'text-red-400' : 'text-slate-400')} border-l-2 ${l.type === 'success' ? 'border-green-500' : (l.type === 'fail' ? 'border-red-500' : 'border-slate-500')} pl-2">${l.text}</div>`).join('')}
                </div>
                <div class="grid grid-cols-3 gap-4 mt-auto">
                    <button onclick="window.processTameTurn('force')" class="btn bg-red-950 border border-red-800 hover:bg-red-900 hover:border-red-500 text-red-200 flex flex-col items-center justify-center gap-2 py-4 transition-all hover:-translate-y-1 shadow-lg group"><i class="fas fa-fist-raised text-2xl group-hover:scale-110 transition-transform"></i><span class="font-bold text-xs uppercase tracking-wide">Impor Vontade</span></button>
                    <button onclick="window.processTameTurn('calm')" class="btn bg-blue-950 border border-blue-800 hover:bg-blue-900 hover:border-blue-500 text-blue-200 flex flex-col items-center justify-center gap-2 py-4 transition-all hover:-translate-y-1 shadow-lg group"><i class="fas fa-hand-holding-heart text-2xl group-hover:scale-110 transition-transform"></i><span class="font-bold text-xs uppercase tracking-wide">Acalmar</span></button>
                    <button onclick="window.processTameTurn('feed')" class="btn bg-green-950 border border-green-800 hover:bg-green-900 hover:border-green-500 text-green-200 flex flex-col items-center justify-center gap-2 py-4 transition-all hover:-translate-y-1 shadow-lg group"><i class="fas fa-apple-alt text-2xl group-hover:scale-110 transition-transform"></i><span class="font-bold text-xs uppercase tracking-wide">Alimentar</span></button>
                </div>
                <div class="text-center"><button onclick="window.cancelTaming()" class="text-xs text-slate-500 hover:text-red-400 underline transition-colors">Desistir e fugir (Perder Progresso)</button></div>
            </div>
        </div>
    `;
    setTimeout(() => { const logArea = document.getElementById('taming-log-area'); if(logArea) logArea.scrollTop = logArea.scrollHeight; }, 50);
}

window.processTameTurn = function(action) {
    const state = globalState.petsUI;
    const mobLevel = state.tamingTarget.level || 1;
    let roll = Math.floor(Math.random() * 100) + 1;
    let progressGain = 0, progressLoss = 0, msg = "", type = "info";
    let baseDifficulty = Math.max(10, 90 - mobLevel); 
    let finalChance = baseDifficulty + (state.tamingBonus || 0);

    if (action === 'force') {
        finalChance -= 20; progressGain = 25; progressLoss = 20; 
        if (roll <= finalChance) { state.tamingProgress += progressGain; msg = `> Vontade imposta! Sucesso. (+${progressGain}%)`; type = "success"; } 
        else { state.tamingProgress -= progressLoss; msg = `> A criatura resistiu! (-${progressLoss}%)`; type = "fail"; }
    } else if (action === 'calm') {
        finalChance += 10; progressGain = 10; progressLoss = 5;  
        if (roll <= finalChance) { state.tamingProgress += progressGain; msg = `> Você acalmou a criatura. (+${progressGain}%)`; type = "success"; } 
        else { state.tamingProgress -= progressLoss; msg = `> A criatura ignorou. (-${progressLoss}%)`; type = "fail"; }
    } else if (action === 'feed') {
        state.tamingProgress += 15; msg = `> Criatura alimentada. (+15%)`; type = "success";
    }

    state.tamingProgress = Math.max(0, Math.min(100, state.tamingProgress));
    state.tamingLog.push({ text: msg, type });

    if (state.tamingProgress >= 100) finishTaming(true);
    else if (state.tamingProgress <= 0) finishTaming(false);
    else renderTamingArena(document.getElementById('meus-pets-content'));
};

async function finishTaming(success) {
    const charId = globalState.selectedCharacterId;
    const mob = globalState.petsUI.tamingTarget;
    const SELA_ID = 'FYNjwW0wmCHcnUL70XB2';

    if (success) {
        if(!confirm(`VÍNCULO BEM SUCEDIDO!\nVocê acalmou ${mob.nome}.\nDeseja selar o contrato e enviar para o Mestre? (Consome 1 Sela)`)) {
            window.cancelTaming(); return;
        }

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "rpg_fichas", charId);
                const d = (await t.get(ref)).data();
                
                const mochila = d.mochila || {};
                if (!mochila[SELA_ID] || mochila[SELA_ID] < 1) throw "Você perdeu a sela!";
                if (mochila[SELA_ID] === 1) delete mochila[SELA_ID]; else mochila[SELA_ID]--;
                
                let template = null;
                globalState.cache.pets.forEach(p => { 
                    if(p.mobBaseId === mob.id) template = p; 
                });

                const xpDonoAgora = Number(d.experienciapersonagemBase) || 0;

                const newPet = {
                    nome: mob.nome,
                    mobBaseId: mob.id,
                    level: 1,
                    experienciaAtual: 0,
                    ativo: false,
                    dataDoma: Date.now(),
                    imagemUrl: mob.imageUrls?.imagem1 || null,
                    itensProducao: template ? template.itensProducao : [],
                    itensConsumiveis: template ? template.itensConsumiveis : [],
                    habilidadesConhecidas: template ? template.habilidadesConhecidas : [],
                    efeitoEspecial: template ? template.efeitoEspecial : "",
                    taxaXpJogador: template ? template.taxaXpJogador : 10,
                    lastKnownPlayerXp: xpDonoAgora,
                    aprovado: globalState.isAdmin ? true : false
                };

                const pets = d.pets || [];
                pets.push(newPet);

                t.update(ref, { mochila, pets });
            });
            alert("Contrato selado! Aguarde o Mestre confirmar o vínculo para que você possa utilizá-lo.");
        } catch (e) { alert("Erro ao salvar: " + e); }
    } else {
        alert("A criatura fugiu!");
    }
    
    globalState.petsUI.tamingMode = false;
    renderPetsTab();
}

window.cancelTaming = function() {
    if(confirm("Tem certeza? O progresso será perdido.")) {
        globalState.petsUI.tamingMode = false;
        renderPetsTab();
    }
};

window.toggleTamingRules = function(show) {
    globalState.petsUI.showRules = show;
    renderTamingArena(document.getElementById('meus-pets-content'));
};

window.togglePetActive = async function(index, state) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const pets = d.pets || [];
            if (state) pets.forEach(p => p.ativo = false); 
            if (pets[index]) pets[index].ativo = state;
            t.update(ref, { pets });
        });
    } catch (e) { console.error(e); }
};

window.releasePet = async function(index) {
    if(!confirm("Tem certeza que deseja libertar este pet? Ele será removido para sempre.")) return;
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const pets = d.pets || [];
            pets.splice(index, 1); 
            t.update(ref, { pets });
        });
        globalState.petsUI.selectedPetIndex = null;
    } catch (e) { console.error(e); }
};

window.approvePet = async function(petIndex) {
    const charId = globalState.selectedCharacterId;
    if(!confirm("Aprovar o vínculo deste pet? Ele ficará disponível para o jogador.")) return;
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const pets = d.pets || [];
            
            if(pets[petIndex]) {
                pets[petIndex].aprovado = true;
                t.update(ref, { pets: pets });
            }
        });
        alert("Pet aprovado com sucesso!");
    } catch (e) { 
        console.error(e);
        alert("Erro ao aprovar: " + e); 
    }
};