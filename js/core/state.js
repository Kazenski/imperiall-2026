export const ADMIN_EMAIL = 'kazenski.developer@gmail.com';
export const PLACEHOLDER_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media&token=f9512409-7ab9-459f-b3b4-9091f4d59f68";

// Constantes da Constelação
export const CURRENCY_ID = 'zWRejvWyS04xgdMoNZA5'; // Orbe da Ascensão
export const RESET_ID = '29Y4Q92RdP6emmC6RYJK';    // Lágrima do Destino

// Moedas do Jogo
export const COINS = {
    BRONZE: { id: 'fidZh2ozLmMfPvJ1Cez4', val: 1, name: 'Cobre' },
    SILVER: { id: 'DVnZSPTXYLZOCuQsvJ77', val: 10, name: 'Prata' },
    GOLD:   { id: 'TkJZyIyySo9goVil3EDy', val: 100, name: 'Ouro' }
};

// Estado Global do Sistema
export const globalState = {
    currentUser: null,
    isAdmin: false,
    selectedCharacterId: null,
    selectedCharacterData: null,
    activeSessionId: "world", 
    userSessions: [],
    cache: {
        personagens: new Map(),
        all_personagens: new Map(),
        tabela_xp: null,
        racas: new Map(),
        classes: new Map(),
        subclasses: new Map(),
        itens: new Map(),
        habilidades: new Map(),
        efeitos: new Map(),
        tiposItens: new Map(),
        receitas: new Map(),
        armasEspirituais: new Map(),
        tabelaXpEspirito: null,
        habilidadesEspirito: new Map(),
        pets: new Map(),         
        habilidadesPet: new Map(), 
        tabelaXpPet: null,       
        mobs: new Map(),
        buildings: new Map(),
        allies: new Map(),
        allItems: new Map(),
        itemConfig: new Map(),
        shopTiers: new Map()
    },
    commerce: {
        liveShopUnsubscribe: null, 
        liveShopData: null,        
        selectedShopId: "",
        mode: "buy",
        buyQuantities: {}, 
        sellQuantities: {}, 
        exchange: {
            'gold_silver': { dir: 'down', val: 1 },
            'silver_bronze': { dir: 'down', val: 1 },
            'gold_bronze': { dir: 'down', val: 1 },
            sellableCache: null,
            lastShopTierVerified: null
        }
    },
    world: {
        data: null,
        locations: [],
        events: [],
        seasons: [],
        selectedLocId: "" 
    },
    extracao: { selectedItem: null, recipe: null },
    crafting: { 
        selectedRecipe: null, 
        step: 'prepare',
        rollResult: 0,
        quality: 0,
        finalChance: 0
    },
    painelFichas: {
        pontos: { disponiveis: 0, baseAtk: 0, baseDef: 0, baseEva: 0, tempAtk: 0, tempDef: 0, tempEva: 0 },
        bonusBase: { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 }
    },
    itensEquipados: { equipamentoOriginal: {} },
    mochila: { lastSelectedItem: null },
    habilidades: { lastSelectedSkill: null },
    constelacao: {
        transform: { x: 0, y: 0, scale: 1 },
        isDragging: false,
        startPos: { x: 0, y: 0 }
    },
    petsUI: {
        selectedPetIndex: null,
        tamingMode: false,
        tamingTarget: null,
        tamingProgress: 50,
        tamingLog: [],
        tamingBonus: 0,
        showRules: false
    }
};

// Variáveis para controlar os listeners (escutadores) em tempo real do Firebase
export let listeners = {
    unsubscribeChar: null,
    unsubscribeSessions: null,
    storageUnsubscribe: null
};

// ============================================================================
// CONSTANTES GLOBAIS DE REGRAS DO RPG (Itens, Bônus, Escalas)
// ============================================================================

// Categorias e Tipos de Bônus de Atributos do Sistema
export const BONUS_LIST = {
    "Ataque": ["Fisico", "Magico", "Elemental", "Espiritual", "Divino", "Imunidade", "Hibrido", "Definitivo"],
    "Defesa": ["Fisica", "Magica", "Elemental", "Espiritual", "Divina", "Imunidade", "Hibrida", "Definitiva"],
    "Evasao": ["Fisica", "Magica", "Elemental", "Espiritual", "Divina", "Imunidade", "Hibrida", "Definitiva"]
};

// Escalas de Poder para Geração Procedural de Itens (Base, Bônus, Efeitos, Durabilidade, Peso)
export const POWER_RANGES = {
    comum:   { base: [1, 5],   bonus: [1, 10],   efeito: [1, 2], durabilidade: [50, 100], peso: [0.5, 5] },
    incomum: { base: [5, 15],  bonus: [10, 25],  efeito: [1, 5], durabilidade: [100, 250], peso: [1, 10] },
    raro:    { base: [15, 30], bonus: [25, 60],  efeito: [3, 8], durabilidade: [250, 500], peso: [2, 15] },
    epico:   { base: [30, 60], bonus: [60, 150], efeito: [5, 12], durabilidade: [500, 1000], peso: [3, 20] },
    lendario:{ base: [60, 120],bonus: [150, 350],efeito: [10, 20],durabilidade: [1000, 2500], peso: [5, 30] }
};