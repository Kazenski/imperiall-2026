import { db, doc, onSnapshot, runTransaction, increment, deleteField } from '../core/firebase.js';
import { globalState, COINS, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML, optimizeCoins, getRankWeight } from '../core/utils.js';
import { getWallet } from '../core/calculos.js';

// Função utilitária para buscar as imagens das moedas e resolver o erro "getCoinImg is not defined"
window.getCoinImg = function(itemId) {
    let item = globalState.cache.allItems?.get(itemId) || 
               globalState.cache.itens?.get(itemId) || 
               globalState.cache.itemConfig?.get(itemId);
    
    // Fallback: garante que mesmo se o item vier, procure a URL ou retorne o placeholder
    if (item && (item.imagemUrl || item.imageUrl)) {
        return item.imagemUrl || item.imageUrl;
    }
    return PLACEHOLDER_IMAGE_URL;
};

function getCoinImg(itemId) {
    return window.getCoinImg(itemId);
}

// Inicializa o estado de comércio para evitar erros
if (!globalState.commerce) {
    globalState.commerce = {
        selectedShopId: "",
        mode: "buy",
        buyQuantities: {},
        sellQuantities: {},
        liveShopUnsubscribe: null,
        liveShopData: null,
        exchange: {
            'gold_silver': { dir: 'down', val: 1 },
            'silver_bronze': { dir: 'down', val: 1 },
            'gold_bronze': { dir: 'down', val: 1 }
        }
    };
}

// Helper para descobrir o período do dia atual
function getSessionTimeAndPeriod() {
    let w = globalState.world?.data || { time: "12:00" };
    if (globalState.activeSessionId && globalState.activeSessionId !== 'world') {
        const sess = globalState.userSessions?.find(s => s.id === globalState.activeSessionId);
        if (sess && sess.customTime) w = { time: sess.customTime };
    }
    const time = w.time || "12:00";
    const h = parseInt(time.split(':')[0]);
    let period = "Madrugada";
    if (h >= 6 && h < 12) period = "Manhã";
    else if (h >= 12 && h < 18) period = "Tarde";
    else if (h >= 18) period = "Noite";
    return { time, period };
}

// RENDER PRINCIPAL DA ABA COMERCIO
export function renderComercioTab(isLoading = false) {
    const container = document.getElementById('comercio-content');
    if (!container) return;

    window.renderComercioTab = renderComercioTab;

    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }

    const sessionId = globalState.activeSessionId;
    let sessionData = null;
    if (sessionId && sessionId !== 'world') {
        sessionData = globalState.userSessions?.find(s => s.id === sessionId);
    }

    // Se estiver em modo global (world) ou não tiver grupo posicionado
    if (!sessionData || !sessionData.groupLocation) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-96 text-slate-500"><i class="fas fa-map-marked-alt text-6xl mb-4 opacity-30"></i><p class="font-cinzel text-xl">Localização Desconhecida</p><p class="text-xs mt-2">Você deve estar dentro de uma Sessão com posição no mapa.</p></div>`;
        return;
    }

    const groupLoc = sessionData.groupLocation;
    const validCityNames = [];
    
    // Matemática dos Hexágonos
    const HEX_SIZE = 17;
    const R = 10; // MAP_CONSTANTS.HEX_RADIUS do seu mapa original, adaptado aqui para bater
    const H = R * 2;
    const W = Math.sqrt(3) * R;
    const VERT_DIST = H * 0.75;

    // Acha a cidade baseada no HexId que o grupo está pisando
    if (globalState.world?.locations) {
        globalState.world.locations.forEach(loc => {
            if (loc.x && loc.y) {
                const lx = Number(loc.x);
                const ly = Number(loc.y);
                const row = Math.round((ly + (H/2)) / VERT_DIST);
                const xOffset = (row % 2 === 1) ? W / 2 : 0;
                const col = Math.round((lx + (W/2) - xOffset) / W);
                const hexId = `${row}-${col}`;
                if (hexId === groupLoc.hexId) validCityNames.push(loc.name);
            }
        });
    }

    if (validCityNames.length === 0) {
        if (globalState.commerce.liveShopUnsubscribe) {
            globalState.commerce.liveShopUnsubscribe();
            globalState.commerce.liveShopUnsubscribe = null;
        }
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-96 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl m-4 bg-slate-900/50"><i class="fas fa-store-slash text-6xl mb-4 opacity-30 text-red-500"></i><p class="font-cinzel text-xl text-slate-400">Ermo Selvagem</p><p class="text-xs mt-2">Nenhum comércio ou banco nesta área.</p></div>`;
        return;
    }

    // Filtra as lojas pela cidade atual
    const availableShops = [...(globalState.cache.lojas?.values() || [])].filter(shop => {
        return shop.disponivel !== false && validCityNames.includes(shop.cidade);
    });

    const wallet = getWallet(charData.ficha);

    if (!globalState.commerce.selectedShopId && availableShops.length > 0) {
        window.switchShop(availableShops[0].id);
    }
    
    const selectedShop = globalState.commerce.liveShopData || availableShops.find(s => s.id === globalState.commerce.selectedShopId);
    const timeInfo = getSessionTimeAndPeriod();
    const isShopOpen = selectedShop && selectedShop.horariosFuncionamento?.includes(timeInfo.period);
    const isAnyShopOpen = availableShops.some(shop => shop.horariosFuncionamento?.includes(timeInfo.period));

    const imgGold = getCoinImg(COINS.GOLD.id);
    const imgSilver = getCoinImg(COINS.SILVER.id);
    const imgBronze = getCoinImg(COINS.BRONZE.id);

    // Lógica do Rank da Loja
    let shopRankLetter = "F";
    if (selectedShop && selectedShop.tierId) {
        if (selectedShop.tierId.length <= 2) {
            shopRankLetter = selectedShop.tierId;
        } else {
            const tierInfo = globalState.cache.shopTiers ? globalState.cache.shopTiers.get(selectedShop.tierId) : null;
            if (tierInfo) {
                shopRankLetter = (tierInfo.nome || tierInfo.id || "F").replace(/rank/i, '').trim().toUpperCase();
            }
        }
    }

    let html = `
        <div class="flex flex-col h-full animate-fade-in">
            <div class="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg mb-4 shrink-0">
                <div class="p-4 flex flex-wrap gap-4 items-end justify-between bg-slate-800">
                    <div>
                        <h2 class="font-cinzel text-2xl text-amber-500 leading-none">Centro Comercial de ${validCityNames[0]}</h2>
                        <div class="flex items-center gap-2 mt-1">
                             <span class="text-xs text-slate-400"><i class="fas fa-clock"></i> ${timeInfo.time} (${timeInfo.period})</span>
                        </div>
                    </div>
                    <div class="flex gap-4 bg-slate-950 px-4 py-2 rounded border border-slate-600 shadow-inner items-center">
                        <div class="flex items-center gap-2 text-amber-400 text-lg font-bold" title="Ouro"><img src="${imgGold}" class="w-6 h-6 object-contain"> ${wallet.gold}</div>
                        <div class="flex items-center gap-2 text-slate-300 text-lg font-bold" title="Prata"><img src="${imgSilver}" class="w-6 h-6 object-contain"> ${wallet.silver}</div>
                        <div class="flex items-center gap-2 text-orange-400 text-lg font-bold" title="Bronze"><img src="${imgBronze}" class="w-6 h-6 object-contain"> ${wallet.bronze}</div>
                    </div>
                </div>

                <div class="p-3 border-t border-slate-700 bg-slate-800/50 flex gap-4 items-center">
                    <div class="flex-grow">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-[9px] text-slate-500 font-bold uppercase block">Estabelecimento Selecionado</label>
                            ${selectedShop ? `<span class="text-[9px] px-2 rounded font-bold uppercase tracking-widest ${isShopOpen ? 'bg-emerald-900/50 border border-emerald-500 text-emerald-400' : 'bg-red-900/50 border border-red-500 text-red-400'}">${isShopOpen ? 'ABERTO' : 'FECHADO'}</span>` : ''}
                        </div>
                        <select id="shop-select" class="std-height w-full bg-slate-900 border border-slate-600 rounded text-slate-200 px-3 outline-none focus:border-amber-500" onchange="window.switchShop(this.value)">
                            ${availableShops.length === 0 ? '<option>Nenhum mercador disponível</option>' : ''}
                            ${availableShops.map(s => {
                                let sRank = "F";
                                if (s.tierId) {
                                    if (s.tierId.length <= 2) sRank = s.tierId;
                                    else {
                                        const tInfo = globalState.cache.shopTiers ? globalState.cache.shopTiers.get(s.tierId) : null;
                                        if (tInfo) sRank = (tInfo.nome || "F").replace(/rank/i, '').trim().toUpperCase();
                                    }
                                }
                                return `<option value="${s.id}" ${s.id === globalState.commerce.selectedShopId ? 'selected' : ''}>[Rank ${sRank}] ${s.nome}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>

                <div class="flex border-t border-slate-700">
                    <div onclick="window.setCommerceMode('buy')" class="commerce-tab ${globalState.commerce.mode === 'buy' ? 'active-buy' : ''}">COMPRAR</div>
                    <div onclick="window.setCommerceMode('sell')" class="commerce-tab ${globalState.commerce.mode === 'sell' ? 'active-sell' : ''}">VENDER</div>
                    <div onclick="window.setCommerceMode('exchange')" class="commerce-tab ${globalState.commerce.mode === 'exchange' ? 'active-exchange' : ''} text-purple-400 hover:text-purple-300">CÂMBIO (BANCO)</div>
                </div>
            </div>
            <div class="bg-slate-900/50 rounded-lg border border-slate-800 flex-grow p-4 overflow-y-auto custom-scroll">
    `;

    // ==========================================
    // MODO CÂMBIO
    // ==========================================
    if (globalState.commerce.mode === 'exchange') {
        if (!isAnyShopOpen) {
            html += `
                <div class="col-span-full flex flex-col items-center justify-center py-10 opacity-50">
                    <i class="fas fa-university text-4xl mb-3 text-red-500"></i>
                    <p class="text-slate-400 font-bold">Os serviços de câmbio estão fechados.</p>
                    <p class="text-[10px] mt-1 text-slate-500">Volte durante o expediente comercial da cidade.</p>
                </div>`;
        } else {
            const exchanges = [
                { id: 'gold_silver', label1: 'Ouro', img1: imgGold, label2: 'Prata', img2: imgSilver, rate: 10 },
                { id: 'silver_bronze', label1: 'Prata', img1: imgSilver, label2: 'Bronze', img2: imgBronze, rate: 10 },
                { id: 'gold_bronze', label1: 'Ouro', img1: imgGold, label2: 'Bronze', img2: imgBronze, rate: 100 }
            ];
            html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
            exchanges.forEach(ex => {
                 const state = globalState.commerce.exchange[ex.id];
                 const isDown = state.dir === 'down';
                 const sourceLabel = isDown ? ex.label1 : ex.label2;
                 const targetLabel = isDown ? ex.label2 : ex.label1;
                 const sourceImg = isDown ? ex.img1 : ex.img2;
                 const targetImg = isDown ? ex.img2 : ex.img1;
                 const inputVal = parseInt(state.val) || 0;
                 let resultText = "";
                 let canAfford = false;
                 let bal = 0;
                 if(sourceLabel === 'Ouro') bal = wallet.gold;
                 else if(sourceLabel === 'Prata') bal = wallet.silver;
                 else bal = wallet.bronze;

                 if (isDown) {
                     const result = inputVal * ex.rate;
                     resultText = `= <span class="text-emerald-400 font-bold">${result}</span> ${targetLabel}`;
                     canAfford = bal >= inputVal && inputVal > 0;
                 } else {
                     const convert = Math.floor(inputVal / ex.rate);
                     resultText = `= <span class="text-emerald-400 font-bold">${convert}</span> ${targetLabel}`;
                     canAfford = bal >= inputVal && inputVal > 0;
                 }
                 
                 html += `
                    <div class="bg-slate-800 border border-slate-600 rounded-lg p-4 flex flex-col gap-3 shadow-lg group">
                        <div class="flex justify-between items-center z-10 relative">
                            <div class="flex flex-col items-center w-20">
                                <img src="${sourceImg}" class="w-10 h-10 object-contain mb-2 drop-shadow-md">
                                <span class="text-xs font-bold text-slate-300 uppercase">${sourceLabel}</span>
                                <span class="text-[10px] text-slate-500">Possui: ${bal}</span>
                            </div>
                            <button onclick="window.toggleExchangeDir('${ex.id}')" class="btn bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-full w-8 h-8 flex items-center justify-center transition-transform hover:rotate-180 z-20">
                                <i class="fas fa-sync-alt text-xs text-purple-400"></i>
                            </button>
                            <div class="flex flex-col items-center w-20">
                                <img src="${targetImg}" class="w-10 h-10 object-contain mb-2 drop-shadow-md">
                                <span class="text-xs font-bold text-slate-300 uppercase">${targetLabel}</span>
                                <span class="text-[10px] text-emerald-500 font-bold">Taxa: ${isDown ? '1:'+ex.rate : ex.rate+':1'}</span>
                            </div>
                        </div>
                        <div class="bg-slate-900/80 p-3 rounded border border-slate-700 z-10 relative mt-2">
                            <div class="flex items-center gap-2">
                                <input type="number" min="1" max="${bal}" value="${inputVal}" onchange="window.updateExchangeInput('${ex.id}', this.value)" class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-center font-bold outline-none focus:border-purple-500">
                            </div>
                            <div class="text-center mt-2 text-sm">${resultText}</div>
                        </div>
                        <button onclick="window.executeExchange('${ex.id}')" class="btn z-10 w-full py-2 text-xs font-bold uppercase rounded shadow-lg transition-all ${canAfford ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-70'}" ${!canAfford ? 'disabled' : ''}>${isDown ? 'Quebrar' : 'Fundir'}</button>
                    </div>`;
            });
            html += `</div>`;
        }
    } 
    // ==========================================
    // MODO COMPRAR
    // ==========================================
    else if (globalState.commerce.mode === 'buy') {
        if(!selectedShop) { 
            html += '<p class="col-span-full text-center text-slate-500 py-10">Nenhuma loja cadastrada nesta área.</p>'; 
        } else if (!isShopOpen) { 
            html += `
                <div class="col-span-full flex flex-col items-center justify-center py-10 opacity-50">
                    <i class="fas fa-store-slash text-4xl mb-3 text-red-500"></i>
                    <p class="text-slate-400 font-bold">A loja está fechada agora.</p>
                </div>`;
        } else {
            const stock = selectedShop.itensEstoque || {};
            const items = Object.entries(stock).map(([id, data]) => ({ id, ...data }));
            
            if(items.length === 0) {
                html += '<p class="col-span-full text-center opacity-50 py-10">Estoque esgotado.</p>';
            } else {
                html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5 content-start">`;
                
                items.forEach(item => {
                    if (item.estoqueAtual <= 0) return;
                    
                    const myQty = globalState.commerce.buyQuantities[item.id] || 1;
                    const totalCost = (item.precoCompra || 0) * myQty;
                    const canBuy = wallet.total >= totalCost && item.estoqueAtual >= myQty;
                    
                    // Busca a imagem no cache caso não venha salva na loja
                    const cacheInfo = globalState.cache.itens?.get(item.id) || globalState.cache.allItems?.get(item.id) || globalState.cache.itemConfig?.get(item.id);
                    const itemImgSafe = item.imagemUrl || cacheInfo?.imagemUrl || cacheInfo?.imageUrl || PLACEHOLDER_IMAGE_URL;
                    const itemNameSafe = escapeHTML(item.nome);

                    html += `
                        <div class="shop-card group border-slate-700">
                            <div class="shop-image-container" style="background-image: url('${itemImgSafe}')">
                                <div class="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-bold border-b border-l border-slate-600">Est: ${item.estoqueAtual}</div>
                                <div class="absolute top-0 left-0 bg-black/60 text-amber-400 text-[10px] px-1.5 py-0.5 font-bold border-b border-r border-slate-600">Rank ${item.tierId || 'F'}</div>
                            </div>
                            <div class="p-3 flex flex-col flex-grow bg-slate-800">
                                <div class="font-bold text-sm text-slate-200 mb-1 truncate" title="${itemNameSafe}">${itemNameSafe}</div>
                                <div class="text-[10px] text-amber-400 font-bold mb-2">${item.precoCompra} CP / unid.</div>
                                <div class="mt-auto">
                                    <div class="qty-control mb-2">
                                        <div class="qty-btn hover:bg-slate-700" onclick="window.adjustBuyQty('${item.id}', -1, ${item.estoqueAtual})">-</div>
                                        <input type="number" class="qty-input" value="${myQty}" onchange="window.setBuyQtyDirect('${item.id}', this.value, ${item.estoqueAtual})">
                                        <div class="qty-btn hover:bg-slate-700" onclick="window.adjustBuyQty('${item.id}', 1, ${item.estoqueAtual})">+</div>
                                    </div>
                                    <button onclick="window.executeBuy('${item.id}', ${item.precoCompra}, '${itemNameSafe.replace(/'/g, "\\'")}')" class="w-full py-2 rounded text-xs font-bold uppercase transition-all ${canBuy ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}" ${!canBuy ? 'disabled' : ''}>Comprar (${totalCost})</button>
                                </div>
                            </div>
                        </div>`;
                });
                html += `</div>`;
            }
        }
    } 
    // ==========================================
    // MODO VENDER 
    // ==========================================
    else {
        const shopCash = selectedShop ? (selectedShop.caixaAtual || 0) : 0;
        
        html += `
            <div class="flex items-center justify-between bg-slate-800 p-2 rounded mb-4 border border-slate-600">
                <span class="text-xs text-slate-400 uppercase font-bold"><i class="fas fa-cash-register mr-2"></i> Caixa da Loja</span>
                <span class="text-sm font-mono font-bold text-emerald-400">${shopCash.toLocaleString()} CP</span>
            </div>
        `;

        if (!selectedShop) {
            html += '<p class="col-span-full text-center text-slate-500 py-10">Selecione uma loja.</p>';
        } 
        else if (!isShopOpen) {
            html += `
                <div class="col-span-full flex flex-col items-center justify-center py-10 opacity-50">
                    <i class="fas fa-store-slash text-4xl mb-3 text-red-500"></i>
                    <p class="text-slate-400 font-bold">O mercador não está atendendo no momento.</p>
                </div>
            `;
        } 
        else {
            const mochila = charData.ficha.mochila || {};
            const itemsToShow = [];
            const coinIds = [COINS.GOLD.id, COINS.SILVER.id, COINS.BRONZE.id];

            Object.keys(mochila).forEach(itemId => {
                if (coinIds.includes(itemId) || mochila[itemId] <= 0) return;

                const config = globalState.cache.itemConfig ? globalState.cache.itemConfig.get(itemId) : null;
                // Amplia a busca para allItems
                const baseItem = globalState.cache.itens?.get(itemId) || globalState.cache.allItems?.get(itemId);
                if (!config && !baseItem) return;

                const itemTierStr = (config ? config.tierId : null) || (baseItem ? baseItem.tier : null) || "F";

                // Vende se for igual ao Rank da loja
                if (itemTierStr.toUpperCase() === shopRankLetter.toUpperCase()) {
                    const precoItem = Number(config?.basePrice || baseItem?.precoBase || 0);
                    if (precoItem > 0) {
                        // Resgata a imagem com fallback
                        const safeImg = config?.imagemUrl || baseItem?.imagemUrl || baseItem?.imageUrl || PLACEHOLDER_IMAGE_URL;

                        itemsToShow.push({
                            id: itemId,
                            nome: (config ? config.nome : null) || (baseItem ? baseItem.nome : "Item sem nome"),
                            imagemUrl: safeImg,
                            basePrice: precoItem,
                            tierId: itemTierStr,
                            maxQty: mochila[itemId]
                        });
                    }
                }
            });

            if (itemsToShow.length === 0) {
                html += `
                    <div class="col-span-full flex flex-col items-center justify-center h-full py-10 opacity-50">
                        <i class="fas fa-box-open text-4xl mb-2"></i>
                        <p>Sua mochila não possui itens compatíveis com este mercador.</p>
                        <p class="text-[10px] mt-1 text-slate-500">Nota: Ele negocia <b>APENAS</b> itens do seu próprio Rank (Rank ${shopRankLetter}).</p>
                    </div>`;
            } else {
                html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5 content-start">`;
                let totalSellValue = 0;
                
                itemsToShow.forEach(item => {
                    const currentSel = globalState.commerce.sellQuantities[item.id] || 0;
                    const sellPrice = Math.floor(item.basePrice * 0.50);
                    totalSellValue += sellPrice * currentSel;
                    
                    const borderClass = currentSel > 0 ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-700';

                    html += `
                        <div class="shop-card group ${borderClass}">
                            <div class="shop-image-container" style="background-image: url('${item.imagemUrl}')">
                                <div class="absolute top-0 left-0 bg-black/60 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-br font-bold border-b border-r border-slate-600">Rank ${item.tierId}</div>
                                <div class="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-bl font-bold border-b border-l border-slate-600">x${item.maxQty}</div>
                                ${currentSel > 0 ? `<div class="absolute inset-0 bg-emerald-900/40 flex items-center justify-center font-bold text-emerald-300 text-xl border-4 border-emerald-500/50">x${currentSel}</div>` : ''}
                            </div>
                            <div class="p-3 flex flex-col flex-grow bg-slate-800">
                                <div class="font-bold text-sm text-slate-200 leading-tight mb-2 line-clamp-2 h-10" title="${escapeHTML(item.nome)}">${escapeHTML(item.nome)}</div>
                                <div class="mt-auto pt-2 border-t border-slate-700/50">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-[10px] text-slate-400 uppercase">Oferta</span>
                                        <span class="text-xs font-bold text-emerald-400">${sellPrice} CP</span>
                                    </div>
                                    <div class="qty-control mb-2">
                                        <div class="qty-btn hover:bg-slate-700" onclick="window.setSellQty('${item.id}', ${currentSel - 1}, ${item.maxQty})">-</div>
                                        <input type="number" class="qty-input" value="${currentSel}" onchange="window.setSellQty('${item.id}', this.value, ${item.maxQty})">
                                        <div class="qty-btn hover:bg-slate-700" onclick="window.setSellQty('${item.id}', ${currentSel + 1}, ${item.maxQty})">+</div>
                                    </div>
                                    <button onclick="window.setSellQty('${item.id}', ${item.maxQty}, ${item.maxQty})" class="w-full text-[10px] text-slate-500 hover:text-emerald-400 uppercase font-bold transition-colors">Vender Tudo</button>
                                </div>
                            </div>
                        </div>`;
                });

                if (totalSellValue > 0) {
                    const shopCanPay = shopCash >= totalSellValue;
                    html = `
                        <div class="col-span-full mb-4 sticky top-0 z-20 bg-emerald-900/95 p-3 rounded-lg border border-emerald-500 flex justify-between items-center shadow-2xl backdrop-blur-md animate-fade-in ring-1 ring-emerald-400/50">
                            <div class="flex items-center gap-3">
                                 <div class="bg-emerald-950 p-2 rounded-full border border-emerald-700"><i class="fas fa-coins text-amber-300 text-lg"></i></div>
                                 <div class="flex flex-col">
                                    <span class="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Total a Receber</span>
                                    <span class="text-lg font-cinzel font-bold text-white leading-none">${totalSellValue} CP</span>
                                 </div>
                            </div>
                            <button onclick="window.executeSellBatch(${totalSellValue})" 
                                class="px-6 py-2 rounded text-xs font-bold uppercase shadow-lg transition transform hover:-translate-y-1 flex items-center gap-2 ${shopCanPay ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-red-900 text-red-300 cursor-not-allowed'}"
                                ${!shopCanPay ? 'disabled title="A loja não tem dinheiro suficiente!"' : ''}>
                                ${shopCanPay ? '<i class="fas fa-hand-holding-usd"></i> Concluir Venda' : '<i class="fas fa-times-circle"></i> Loja sem Caixa'}
                            </button>
                        </div>
                     ` + html;
                }
                html += `</div>`;
            }
        }
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

window.switchShop = function(shopId) {
    if (globalState.commerce && globalState.commerce.liveShopUnsubscribe) {
        globalState.commerce.liveShopUnsubscribe();
        globalState.commerce.liveShopUnsubscribe = null;
    }
    globalState.commerce.selectedShopId = shopId;
    globalState.commerce.liveShopData = null; 
    globalState.commerce.buyQuantities = {};
    globalState.commerce.sellQuantities = {};

    if (!shopId) return;

    globalState.commerce.liveShopUnsubscribe = onSnapshot(doc(db, "rpg_lojas", shopId), (docSnap) => {
        if (docSnap.exists()) {
            globalState.commerce.liveShopData = { id: docSnap.id, ...docSnap.data() };
            // Apenas renderiza se a aba atual for comercio
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab && activeTab.dataset.tab === 'comercio') {
                renderComercioTab();
            }
        }
    });
};

window.setCommerceMode = function(mode) {
    globalState.commerce.mode = mode;
    renderComercioTab();
};

window.adjustBuyQty = function(id, delta, max) {
    const current = globalState.commerce.buyQuantities[id] || 1;
    const newVal = Math.max(1, Math.min(max, current + delta));
    globalState.commerce.buyQuantities[id] = newVal;
    renderComercioTab();
};

window.setBuyQtyDirect = function(id, val, max) {
    const num = parseInt(val);
    if (isNaN(num)) return;
    globalState.commerce.buyQuantities[id] = Math.max(1, Math.min(max, num));
    renderComercioTab();
};

window.setSellQty = function(id, val, max) {
    const num = parseInt(val);
    if (isNaN(num)) return;
    const cleanVal = Math.max(0, Math.min(max, num));
    globalState.commerce.sellQuantities[id] = cleanVal;
    renderComercioTab(); 
};

// Funções de Banco (Compra / Venda / Câmbio)
window.executeBuy = async function(itemId, unitPrice, itemName) {
    const qty = globalState.commerce.buyQuantities[itemId] || 1;
    const totalCostCP = unitPrice * qty; 
    const charId = globalState.selectedCharacterId;
    const shopId = globalState.commerce.selectedShopId;
    const charData = globalState.selectedCharacterData.ficha;
    const wallet = getWallet(charData);

    if (wallet.total < totalCostCP) return alert(`Saldo insuficiente! Custa ${totalCostCP} CP.`);

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const shopRef = doc(db, "rpg_lojas", shopId);
            
            const cDoc = await t.get(charRef);
            const sDoc = await t.get(shopRef);
            
            if(!sDoc.exists()) throw "Loja indisponível.";
            const sData = sDoc.data();
            
            const estoqueLoja = sData.itensEstoque || {};
            const itemNaLoja = estoqueLoja[itemId];

            if (!itemNaLoja) throw "Este item não está mais disponível na loja (Erro de Sincronia). Atualize a página.";
            if (itemNaLoja.estoqueAtual < qty) throw "Estoque insuficiente na loja.";

            const sm = cDoc.data().mochila || {};
            const sTotal = ((sm[COINS.GOLD.id]||0)*100) + ((sm[COINS.SILVER.id]||0)*10) + (sm[COINS.BRONZE.id]||0);
            if (sTotal < totalCostCP) throw "Saldo insuficiente no servidor.";

            const finalCP = sTotal - totalCostCP;
            const finalCoins = optimizeCoins(finalCP);
            const newMochila = { ...sm };
            
            if(finalCoins.gold > 0) newMochila[COINS.GOLD.id] = finalCoins.gold; else delete newMochila[COINS.GOLD.id];
            if(finalCoins.silver > 0) newMochila[COINS.SILVER.id] = finalCoins.silver; else delete newMochila[COINS.SILVER.id];
            if(finalCoins.bronze > 0) newMochila[COINS.BRONZE.id] = finalCoins.bronze; else delete newMochila[COINS.BRONZE.id];
            
            newMochila[itemId] = (newMochila[itemId] || 0) + qty;

            t.update(charRef, { mochila: newMochila });
            t.update(shopRef, { 
                [`itensEstoque.${itemId}.estoqueAtual`]: increment(-qty),
                caixaAtual: increment(totalCostCP) 
            });
        });

        globalState.commerce.buyQuantities[itemId] = 1;
        renderComercioTab(); 

    } catch (e) {
        console.error(e);
        alert("Erro na compra: " + e);
    }
};

window.executeSellBatch = async function(totalValueCP) {
    const charId = globalState.selectedCharacterId;
    const shopId = globalState.commerce.selectedShopId;
    
    const timeInfo = getSessionTimeAndPeriod();
    const shopDataCache = globalState.commerce.liveShopData || globalState.cache.lojas.get(shopId);
    const isShopOpen = shopDataCache && shopDataCache.horariosFuncionamento?.includes(timeInfo.period);

    if (!isShopOpen) return alert("Esta loja está fechada no momento!");
    
    let shopRankLetter = "F";
    if (shopDataCache && shopDataCache.tierId) {
        if (shopDataCache.tierId.length <= 2) {
            shopRankLetter = shopDataCache.tierId;
        } else {
            const tierInfo = globalState.cache.shopTiers ? globalState.cache.shopTiers.get(shopDataCache.tierId) : null;
            if (tierInfo) {
                shopRankLetter = (tierInfo.nome || "F").replace(/rank/i, '').trim().toUpperCase();
            }
        }
    }

    const validIds = new Set();
    Object.keys(globalState.commerce.sellQuantities).forEach(itemId => {
        const config = globalState.cache.itemConfig ? globalState.cache.itemConfig.get(itemId) : null;
        const baseItem = globalState.cache.itens ? globalState.cache.itens.get(itemId) : null;
        const itemTierStr = (config ? config.tierId : null) || (baseItem ? baseItem.tier : null) || "F";
        
        if (itemTierStr.toUpperCase() === shopRankLetter.toUpperCase()) {
            validIds.add(itemId);
        }
    });

    const itemsToSell = Object.entries(globalState.commerce.sellQuantities)
        .filter(([k, v]) => v > 0 && validIds.has(k))
        .map(([k, v]) => [k, Number(v)]); 

    if (itemsToSell.length === 0) return;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const shopRef = doc(db, "rpg_lojas", shopId);
            
            const charSnap = await t.get(charRef);
            const shopSnap = await t.get(shopRef);
            
            if (!charSnap.exists() || !shopSnap.exists()) throw "Dados inválidos.";
            
            const cData = charSnap.data();
            const sData = shopSnap.data();
            
            const serverMochila = cData.mochila || {};
            const serverShopCash = sData.caixaAtual || 0;
            const serverEstoque = sData.itensEstoque || {};
            
            let totalValue = 0;

            for (const [itemId, qty] of itemsToSell) {
                if ((serverMochila[itemId] || 0) < qty) throw "Você não possui essa quantidade no servidor.";
                
                const config = globalState.cache.itemConfig ? globalState.cache.itemConfig.get(itemId) : null;
                // Amplia a busca para allItems aqui também
                const baseItem = globalState.cache.itens?.get(itemId) || globalState.cache.allItems?.get(itemId);
                const basePrice = Number(config?.basePrice || baseItem?.precoBase || 0);
                const sellPrice = Math.floor(basePrice * 0.50);
                
                totalValue += (sellPrice * qty);

                serverMochila[itemId] -= qty;
                if(serverMochila[itemId] <= 0) delete serverMochila[itemId];

                if (serverEstoque[itemId]) {
                    serverEstoque[itemId].estoqueAtual += qty;
                } else {
                    const itemTierStr = (config ? config.tierId : null) || (baseItem ? baseItem.tier : null) || "F";
                    // Fallback da imagem na hora de salvar o estoque novo
                    const safeImg = config?.imagemUrl || baseItem?.imagemUrl || baseItem?.imageUrl || PLACEHOLDER_IMAGE_URL;

                    serverEstoque[itemId] = {
                        nome: (config ? config.nome : null) || (baseItem ? baseItem.nome : "Item sem nome"),
                        imagemUrl: safeImg,
                        estoqueAtual: qty,
                        estoqueMaximo: qty,
                        precoCompra: basePrice,
                        precoVenda: sellPrice,
                        tierId: itemTierStr,
                        slotsOcupados: 1
                    };
                }
            }

            if (serverShopCash < totalValue) throw "O mercador não tem dinheiro suficiente no momento.";

            serverMochila[COINS.BRONZE.id] = (serverMochila[COINS.BRONZE.id] || 0) + totalValue;

            t.update(charRef, { mochila: serverMochila });
            t.update(shopRef, { 
                caixaAtual: serverShopCash - totalValue,
                itensEstoque: serverEstoque 
            });
        });

        globalState.commerce.sellQuantities = {};
        renderComercioTab();
        alert("Venda realizada com sucesso!");

    } catch (e) {
        console.error(e);
        alert("Erro na venda: " + e);
    }
};

window.toggleExchangeDir = function(key) {
    const current = globalState.commerce.exchange[key].dir;
    globalState.commerce.exchange[key].dir = current === 'down' ? 'up' : 'down';
    renderComercioTab();
};

window.updateExchangeInput = function(key, val) {
    const num = parseInt(val);
    if(isNaN(num) || num < 0) return;
    globalState.commerce.exchange[key].val = num;
    renderComercioTab();
};

window.executeExchange = async function(key) {
    const state = globalState.commerce.exchange[key];
    const charId = globalState.selectedCharacterId;
    
    const sessionId = globalState.activeSessionId;
    let isAnyShopOpen = false;
    
    if (sessionId && sessionId !== 'world') {
        const sessionData = globalState.userSessions.find(s => s.id === sessionId);
        const groupLoc = sessionData?.groupLocation;
        
        if (groupLoc && globalState.world.locations) {
            const R = 10; 
            const H = R * 2; 
            const W = Math.sqrt(3) * R; 
            const VERT_DIST = H * 0.75;
            const validCityNames = [];
            
            globalState.world.locations.forEach(loc => {
                if (loc.x && loc.y) {
                    const row = Math.round((Number(loc.y) + (H/2)) / VERT_DIST);
                    const xOffset = (row % 2 === 1) ? W / 2 : 0;
                    const col = Math.round((Number(loc.x) + (W/2) - xOffset) / W);
                    if (`${row}-${col}` === groupLoc.hexId) validCityNames.push(loc.name);
                }
            });
            
            const timeInfo = getSessionTimeAndPeriod();
            isAnyShopOpen = [...globalState.cache.lojas.values()].some(shop => {
                return shop.disponivel !== false && validCityNames.includes(shop.cidade) && shop.horariosFuncionamento?.includes(timeInfo.period);
            });
        }
    }
    
    if (!isAnyShopOpen) return alert("Os serviços de câmbio da cidade estão fechados no momento!");
    
    const charData = globalState.selectedCharacterData.ficha;
    const mochila = { ...charData.mochila };
    const inputVal = state.val;
    const rate = (key === 'gold_silver' || key === 'silver_bronze') ? 10 : 100;
    
    let sourceId, targetId;
    
    if (key === 'gold_silver') {
        sourceId = state.dir === 'down' ? COINS.GOLD.id : COINS.SILVER.id;
        targetId = state.dir === 'down' ? COINS.SILVER.id : COINS.GOLD.id;
    } else if (key === 'silver_bronze') {
        sourceId = state.dir === 'down' ? COINS.SILVER.id : COINS.BRONZE.id;
        targetId = state.dir === 'down' ? COINS.BRONZE.id : COINS.SILVER.id;
    } else { // gold_bronze
        sourceId = state.dir === 'down' ? COINS.GOLD.id : COINS.BRONZE.id;
        targetId = state.dir === 'down' ? COINS.BRONZE.id : COINS.GOLD.id;
    }

    const sourceBalance = mochila[sourceId] || 0;
    if (inputVal > sourceBalance) return alert("Saldo insuficiente.");
    if (inputVal <= 0) return;

    let cost = inputVal;
    let gain = 0;

    if (state.dir === 'down') {
        gain = inputVal * rate;
    } else {
        const effectiveInput = Math.floor(inputVal / rate) * rate; 
        if (effectiveInput === 0) return alert(`Precisa de pelo menos ${rate} moedas para fundir.`);
        
        cost = effectiveInput;
        gain = effectiveInput / rate;
    }

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const serverMochila = d.mochila || {};

            if ((serverMochila[sourceId] || 0) < cost) throw "Saldo insuficiente no servidor.";

            serverMochila[sourceId] -= cost;
            if(serverMochila[sourceId] <= 0) delete serverMochila[sourceId];
            
            serverMochila[targetId] = (serverMochila[targetId] || 0) + gain;

            t.update(ref, { mochila: serverMochila });
        });

        mochila[sourceId] -= cost;
        if(mochila[sourceId] <= 0) delete mochila[sourceId];
        mochila[targetId] = (mochila[targetId] || 0) + gain;
        
        globalState.selectedCharacterData.ficha.mochila = mochila;
        renderComercioTab();
        
        globalState.commerce.exchange[key].val = 1;

    } catch (e) {
        alert("Erro no câmbio: " + e);
    }
};