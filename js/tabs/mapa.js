// ARQUIVO: js/tabs/mapa.js

import { db, doc, onSnapshot, updateDoc } from '../core/firebase.js';
import { globalState } from '../core/state.js';

let mapInstance = null;
let mapOverlay = null;
let partyMarker = null;
let fogLayerGroup = null;
let locationMarkersGroup = null;
let sessionUnsubscribe = null;

// Constantes exatas do seu sistema funcional (v2.2)
const HEX_RADIUS = 10;
const R = HEX_RADIUS;
const H = R * 2;
const W = Math.sqrt(3) * R;
const VERT_DIST = H * 0.75;
const MAP_WIDTH = 2048;
const MAP_HEIGHT = 1536;

export function renderMapaTab() {
    const container = document.getElementById('mapa-movimento-content');
    if (!container) return;

    const sessionId = globalState.activeSessionId;

    // Bloqueio se estiver no modo "world"
    if (!sessionId || sessionId === 'world') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-700 shadow-inner">
                <i class="fas fa-map-marked-alt text-6xl text-slate-600 mb-4 opacity-50"></i>
                <h2 class="text-2xl font-cinzel text-slate-400">Cartografia Indisponível</h2>
                <p class="text-slate-500 mt-2 text-sm text-center max-w-md px-4">Selecione uma Sessão de Jogo no topo para carregar o mapa e a névoa de guerra.</p>
            </div>
        `;
        limparInstanciaMapa();
        return;
    }

    // Injeta a estrutura visual idêntica ao site anterior
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
            <div>
                <h2 class="font-cinzel text-2xl text-amber-500 m-0 border-none p-0">Mapa Mundi</h2>
                <p class="text-xs text-slate-400 mt-1">Áreas descobertas pela sua sessão atual.</p>
            </div>
            <div id="map-session-info" class="text-xs font-bold text-emerald-400 uppercase bg-slate-900 px-3 py-1.5 rounded border border-emerald-900 shadow-lg">
                Sessão Ativa
            </div>
        </div>
        
        <div class="relative w-full h-[700px] bg-[#020617] rounded-lg border border-slate-700 overflow-hidden shadow-2xl">
            <div id="map-player-container-inner" class="w-full h-full z-0"></div>

            <div class="absolute top-4 right-4 z-[400] bg-slate-900/95 p-3 rounded-lg border border-slate-700 shadow-xl backdrop-blur-md text-[10px] text-slate-300 pointer-events-none">
                <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 font-cinzel uppercase tracking-wider">Exploração</h4>
                <div class="flex items-center gap-2 mt-2"><div class="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-[0_0_8px_blue]"></div> Posição do Grupo</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 rounded-full bg-amber-500 border border-white"></div> Local / Cidade</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 bg-black border border-slate-800"></div> Terra Desconhecida</div>
            </div>
        </div>
    `;

    setTimeout(inicializarLeaflet, 100);
}

function inicializarLeaflet() {
    const mapDiv = document.getElementById('map-player-container-inner');
    if (!mapDiv) return;

    if (mapInstance) mapInstance.remove();

    mapInstance = L.map('map-player-container-inner', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true // Necessário para desenhar a névoa sem lag
    });

    const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
    mapOverlay = L.imageOverlay("https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media", bounds).addTo(mapInstance);
    mapInstance.fitBounds(bounds);

    fogLayerGroup = L.layerGroup().addTo(mapInstance);
    locationMarkersGroup = L.layerGroup().addTo(mapInstance);

    const groupIcon = L.divIcon({
        className: 'custom-party-marker',
        html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_blue] flex items-center justify-center animate-bounce text-white"><i class="fas fa-users text-sm"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    partyMarker = L.marker([-9999, -9999], { icon: groupIcon, zIndexOffset: 20000 }).addTo(mapInstance);

    conectarFirebase();
}

function conectarFirebase() {
    const sessionId = globalState.activeSessionId;
    if (!sessionId || sessionId === 'world') return;

    sessionUnsubscribe = onSnapshot(doc(db, "rpg_sessions", sessionId), (docSnap) => {
        if (!docSnap.exists()) return;

        const sessionData = docSnap.data();
        
        // LEITURA CORRETA (Baseada no código antigo funcional v2.2)
        // Hexágonos revelados e Posição do Grupo estão na raiz do documento da sessão
        const revealed = sessionData.revealedHexes || [];
        const groupLoc = sessionData.groupLocation || null;

        // 1. Desenha Névoa (Escuro Total)
        desenharNevoa(revealed);

        // 2. Posiciona o Grupo
        if (groupLoc) {
            const xOffset = (groupLoc.row % 2 === 1) ? W / 2 : 0;
            const centerX = (groupLoc.col * W) + xOffset - (W / 2);
            const centerY = (groupLoc.row * VERT_DIST) - (H / 2);
            partyMarker.setLatLng([centerY, centerX]);
        }

        // 3. Renderiza Cidades
        renderizarLocais(revealed);

        // 4. Radar de Descoberta
        if (window.checkAndDiscoverCities) {
            window.checkAndDiscoverCities(revealed);
        }

        // 5. Controle do Mestre (Reposicionar Grupo)
        const isMaster = globalState.isAdmin || (globalState.currentUser && sessionData.ownerUid === globalState.currentUser.uid);
        mapInstance.off('click');
        if (isMaster) {
            document.getElementById('map-player-container-inner').style.cursor = 'crosshair';
            mapInstance.on('click', (e) => handleSetPartyPosition(e.latlng, sessionId));
        }
    });
}

function desenharNevoa(revealedIds) {
    if (!fogLayerGroup) return;
    fogLayerGroup.clearLayers();

    const revealedSet = new Set(revealedIds);
    const cols = Math.ceil(MAP_WIDTH / W) + 1;
    const rows = Math.ceil(MAP_HEIGHT / VERT_DIST) + 1;

    const fogStyle = {
        color: '#000000', 
        weight: 0.8,
        fillColor: '#020617', // Cor do fundo do seu site
        fillOpacity: 1.0,     // TOTALMENTE ESCURO
        interactive: false
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const hexId = `${r}-${c}`;
            if (!revealedSet.has(hexId)) {
                const xOffset = (r % 2 === 1) ? W / 2 : 0;
                const cx = (c * W) + (W / 2) - xOffset;
                const cy = (r * VERT_DIST) - (H / 2);

                if (cx >= -W && cx <= MAP_WIDTH + W && cy >= -H && cy <= MAP_HEIGHT + H) {
                    const latlngs = [];
                    for (let i = 0; i < 6; i++) {
                        const rad = Math.PI / 180 * (60 * i - 30);
                        latlngs.push([cy + R * Math.sin(rad), cx + R * Math.cos(rad)]);
                    }
                    L.polygon(latlngs, fogStyle).addTo(fogLayerGroup);
                }
            }
        }
    }
}

async function handleSetPartyPosition(latlng, sessionId) {
    const lx = latlng.lng;
    const ly = latlng.lat;
    
    // Converte clique de volta para ID de Hexágono
    const row = Math.round((ly + (H / 2)) / VERT_DIST);
    const xOffset = (row % 2 === 1) ? W / 2 : 0;
    const col = Math.round((lx + (W / 2) - xOffset) / W);

    if (!confirm(`Reposicionar o grupo neste ponto?\nHexágono: ${row}-${col}`)) return;

    try {
        await updateDoc(doc(db, "rpg_sessions", sessionId), {
            groupLocation: { row, col, hexId: `${row}-${col}`, updatedAt: Date.now() }
        });
    } catch (e) {
        console.error("Erro ao mover grupo:", e);
    }
}

function renderizarLocais(revealedIds) {
    if (!locationMarkersGroup) return;
    locationMarkersGroup.clearLayers();

    const revealedSet = new Set(revealedIds);
    const locations = globalState.world?.locations || [];
    const charFicha = globalState.selectedCharacterData?.ficha || {};
    const descobertasNoDiario = charFicha.colecao_cidades || {};

    const cityIcon = L.divIcon({
        className: 'city-marker',
        html: `<div class="w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    locations.forEach(loc => {
        if (!loc.x || !loc.y) return;
        const lx = Number(loc.x);
        const ly = Number(loc.y);

        const row = Math.round((ly + (H / 2)) / VERT_DIST);
        const xOffset = (row % 2 === 1) ? W / 2 : 0;
        const col = Math.round((lx + (W / 2) - xOffset) / W);
        const hexId = `${row}-${col}`;

        // Só mostra se estiver revelado pelo mapa ou já resgatado no diário de coleção
        if (revealedSet.has(hexId) || descobertasNoDiario[loc.id]) {
            L.marker([ly, lx], { icon: cityIcon })
                .bindTooltip(`<div class="font-cinzel font-bold text-amber-500 text-xs px-1">${loc.name}</div>`, {
                    direction: 'top', offset: [0, -5], className: 'bg-slate-900 border border-slate-700 text-white rounded p-1 shadow-lg'
                })
                .addTo(locationMarkersGroup);
        }
    });
}

function limparInstanciaMapa() {
    if (sessionUnsubscribe) { sessionUnsubscribe(); sessionUnsubscribe = null; }
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
}