// ARQUIVO: js/main.js

import { auth, db, storage, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, getDocs, doc, getDoc, onSnapshot, query, where, orderBy, writeBatch, runTransaction, deleteField, increment, updateDoc, addDoc, serverTimestamp } from './core/firebase.js';
import { globalState, ADMIN_EMAIL, PLACEHOLDER_IMAGE_URL, COINS } from './core/state.js';
import { createBonusObject, calculateMainStats, getFomeDebuffMultiplier } from './core/calculos.js';
import { renderPainelFichas, renderFichaEditor } from './tabs/painelFichas.js';
import { renderRolagemDados } from './tabs/rolagemDados.js';
import { renderCalculadoraCombate } from './tabs/calcCombate.js';
import { renderMinhasHabilidades } from './tabs/habilidades.js';
import { renderMochila, setupMochilaListeners } from './tabs/mochila.js';
import { renderItensEquipados, renderSlotsEquipamento } from './tabs/itensEquipados.js';
import { renderCalculadoraAtributos } from './tabs/calcAtributos.js';
import { renderConstelacaoTab, setupConstelacaoListeners } from './tabs/constelacao.js';
import { renderCraftingTab, setupCraftingListeners } from './tabs/crafting.js';
import { renderExtracaoTab, setupExtracaoListeners } from './tabs/extracao.js';
import { renderCollectionTab, checkAndDiscoverCities } from './tabs/colecao.js';
import { renderArmaEspiritualTab } from './tabs/armaEspiritual.js';
import { renderPetsTab } from './tabs/pets.js';
import { renderReputacaoTab } from './tabs/reputacao.js';
import { renderComercioTab } from './tabs/comercio.js';
import { renderMapaTab } from './tabs/mapa.js';
import './tabs/arena.js';
import { renderAtualizacoesTab } from './atualizacoes/atualizacoes.js';
import { renderSimularFichaTab } from './aoJogador/simularFicha.js';
import { renderInicioTab } from './inicio/inicio.js';
import { renderConhecaMundoTab } from './oMundo/conhecaMundo.js';
import { renderOsDeusesTab } from './oMundo/osDeuses.js';
import { renderLendasMundoTab } from './oMundo/lendasMundo.js';
import { renderNpcsGeralTab } from './oMundo/npcsGeral.js';
import { renderRacasTab } from './manualRegras/racas.js';
import { renderClassesTab } from './manualRegras/classes.js';
import { renderSubclassesTab } from './manualRegras/subclasses.js';
import { renderHabilidadesTab } from './manualRegras/habilidades.js';
import { renderProfissoesTab } from './manualRegras/profissoes.js';
import { renderComandosMestreTab } from './aoMestre/comandos.js';
import { renderCadastroNpcsTab } from './aoMestre/cadastroNpcs.js';
import { renderCadastroMonstrosTab } from './aoMestre/cadastroMonstrosSeres.js';
import { renderCadastroItensTab } from './aoMestre/cadastroItens.js';
import { renderLorePersonagensTab } from './aoMestre/lorePersonagens.js';
import { renderBackofficeTab } from './admin/backoffice.js';
import { renderBackupsTab } from './admin/backups.js';
import { renderCadastroConstelacoesTab } from './admin/cadastroConstelacoes.js'; 
import { renderCadastroCraftTab } from './admin/cadastroCraft.js';
import { renderCadastroDeusesTab } from './admin/cadastroDeuses.js';
import { renderCadastroEgoTab } from './admin/cadastroEgo.js';
import { renderCadastroLojasTab } from './admin/cadastroLojas.js';
import { renderCadastroNoticiasTab } from './admin/cadastroNoticias.js';
import { renderCadastroPetsTab } from './admin/cadastroPets.js';
import { renderCadastroReputacaoTab } from './admin/cadastroReputacao.js';
import { renderFirebaseMudaAllTab } from './admin/firebaseMudaAll.js';
import { renderFirebaseMudaIfTab } from './admin/firebaseMudaIf.js';
import { renderGerarTabelaXpTab } from './admin/gerarTabelaXp.js';
import { renderMapaMundialTab } from './admin/mapaMundial.js';
import { rtdb, rtdbRef, push, set, onValue, off, rtdbQuery, limitToLast, rtdbServerTimestamp } from './core/firebase.js';

const dom = {};
document.querySelectorAll('[id]').forEach(el => dom[el.id.replace(/-/g, '_')] = el);

window.gatherAllCharacterData = gatherAllCharacterData;
window.preencherCacheTodosPersonagens = preencherCacheTodosPersonagens;
window.carregarPersonagensNoSeletor = carregarPersonagensNoSeletor;
window.handleCharacterSelect = handleCharacterSelect;
window.renderMapTab = renderMapaTab;
window.checkAndDiscoverCities = checkAndDiscoverCities;
window.renderFichaEditor = renderFichaEditor;

// --- FUNÇÃO GLOBAL DE RENDERIZAÇÃO DE PÁGINAS EM BRANCO ---
window.renderBlankPage = function(title) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    
    let target = document.getElementById('default-view');
    if (!target) {
        target = document.createElement('div');
        target.id = 'default-view';
        target.className = "h-full w-full flex flex-col items-center justify-center opacity-20 pointer-events-none select-none overflow-y-auto p-6";
        document.getElementById('content-container').appendChild(target);
    }
    
    target.classList.remove('hidden');
    target.innerHTML = `
        <i class="fas fa-tools text-[8rem] mb-6 text-slate-700"></i>
        <h2 class="font-cinzel text-4xl tracking-widest uppercase text-slate-500">${title}</h2>
        <p class="mt-4 text-xl uppercase tracking-tighter text-slate-600">Página em construção</p>
    `;
};

// --- FUNÇÃO GLOBAL PARA EXIBIR UMA DAS 16 ABAS ---
window.showTab = function(tabId) {
    
    // SALVA A ÚLTIMA ABA ACESSADA NO CACHE DO NAVEGADOR
    localStorage.setItem('ultimaAbaAcessada', tabId);

    // Controle de Exibição das Barras Laterais para a Tela de Início Absoluta
    const mainSidebar = document.getElementById('main-sidebar');
    const subMenuBar = document.getElementById('sub-menu-bar');
    const contentContainer = document.getElementById('content-container');

    if (tabId === 'inicio-content' || tabId === 'inicio') {
        if (mainSidebar) mainSidebar.classList.add('hidden');
        if (subMenuBar) subMenuBar.classList.add('hidden');
        if (contentContainer) {
            contentContainer.classList.remove('p-6');
            contentContainer.classList.add('p-0'); // Remove padding para ocupar 100% da tela
        }
    } else {
        if (mainSidebar) mainSidebar.classList.remove('hidden');
        if (subMenuBar) subMenuBar.classList.remove('hidden');
        if (contentContainer) {
            contentContainer.classList.remove('p-0');
            contentContainer.classList.add('p-6'); // Devolve o padding padrão
        }
    }

    // 1. Esconde todas as abas e ARRANCA a classe 'active'
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('active'); 
    });
    
    const defaultView = document.getElementById('default-view');
    if (defaultView) defaultView.classList.add('hidden');

    // 2. Prepara o container alvo
    const target = document.getElementById(`${tabId.replace('-content', '')}-content`) || document.getElementById(tabId);
    if (!target) return;

    target.classList.remove('hidden');
    target.classList.add('active', 'h-full'); 

    // 3. Atualiza a cor visual na barra de ícones (Coluna 2)
    document.querySelectorAll('#sub-menu-bar button').forEach(btn => {
        if (btn.dataset.tabId) {
            if (btn.dataset.tabId === tabId.replace('-content', '')) {
                btn.classList.add('bg-slate-800', 'border-amber-500');
                btn.classList.remove('border-transparent');
                btn.querySelector('i')?.classList.replace('text-slate-400', 'text-amber-500');
            } else {
                btn.classList.remove('bg-slate-800', 'border-amber-500');
                btn.classList.add('border-transparent');
                btn.querySelector('i')?.classList.replace('text-amber-500', 'text-slate-400');
            }
        }
    });

    // --- ROTEAMENTO DAS ABAS ---

    // Aba de Novidades (Livre para todos, sem personagem)
    if (tabId === 'atualizacoes-novidades-content' || tabId === 'atualizacoes-novidades') {
        target.innerHTML = ''; // Limpa o container
        if (typeof renderAtualizacoesTab === 'function') renderAtualizacoesTab();
        return; // Sai imediatamente!
    }

    // Aba de Simular Ficha (Livre para todos, sem personagem)
    if (tabId === 'simular-ficha-content' || tabId === 'simular-ficha') {
        target.innerHTML = ''; 
        if (typeof renderSimularFichaTab === 'function') renderSimularFichaTab();
        return;
    }

    // Aba de Início
    if (tabId === 'inicio-content' || tabId === 'inicio') {
        target.innerHTML = ''; 
        if (typeof renderInicioTab === 'function') renderInicioTab();
        return; 
    }

    // Aba "Conheça o Mundo" (Livre para todos, sem personagem)
    if (tabId === 'conheca-mundo-content' || tabId === 'conheca-mundo') {
        target.innerHTML = ''; 
        if (typeof renderConhecaMundoTab === 'function') renderConhecaMundoTab();
        return;
    }

    // Aba "Os Deuses"
    if (tabId === 'os-deuses-content' || tabId === 'os-deuses') {
        target.innerHTML = ''; 
        if (typeof renderOsDeusesTab === 'function') renderOsDeusesTab();
        return;
    }

    // Aba "Lendas do Mundo"
    if (tabId === 'lendas-mundo-content' || tabId === 'lendas-mundo') {
        target.innerHTML = ''; 
        if (typeof renderLendasMundoTab === 'function') renderLendasMundoTab();
        return;
    }

    // Aba "NPCs Importantes"
    if (tabId === 'npcs-geral-content' || tabId === 'npcs-geral') {
        target.innerHTML = ''; 
        if (typeof renderNpcsGeralTab === 'function') renderNpcsGeralTab();
        return;
    }

    // Aba "Raças"
    if (tabId === 'racas-content' || tabId === 'racas') {
        target.innerHTML = ''; 
        if (typeof renderRacasTab === 'function') renderRacasTab();
        return;
    }

    // Aba "Classes"
    if (tabId === 'classes-content' || tabId === 'classes') {
        target.innerHTML = ''; 
        if (typeof renderClassesTab === 'function') renderClassesTab();
        return;
    }

    // Aba "Subclasses"
    if (tabId === 'subclasses-content' || tabId === 'subclasses') {
        target.innerHTML = ''; 
        if (typeof renderSubclassesTab === 'function') renderSubclassesTab();
        return;
    }

    // Aba "Habilidades (Manual)"
    if (tabId === 'habilidades-regras-content' || tabId === 'habilidades-regras') {
        target.innerHTML = ''; 
        if (typeof renderHabilidadesTab === 'function') renderHabilidadesTab();
        return;
    }

    // Aba "Profissões"
    if (tabId === 'profissoes-regras-content' || tabId === 'profissoes-regras') {
        target.innerHTML = ''; 
        if (typeof renderProfissoesTab === 'function') renderProfissoesTab();
        return;
    }

    // --- NOVA ABA: COMANDOS DO MESTRE ---
    if (tabId === 'comandos-mestre-content' || tabId === 'comandos-mestre') {
        target.innerHTML = ''; 
        if (typeof renderComandosMestreTab === 'function') renderComandosMestreTab();
        return;
    }

    // Aba "Cad. NPCs"
    if (tabId === 'cadastro-npcs-content' || tabId === 'cadastro-npcs') {
        target.innerHTML = ''; 
        if (typeof renderCadastroNpcsTab === 'function') renderCadastroNpcsTab();
        return;
    }

    // Aba "Cad. Monstros"
    if (tabId === 'cadastro-monstros-content' || tabId === 'cadastro-monstros') {
        target.innerHTML = ''; 
        if (typeof renderCadastroMonstrosTab === 'function') renderCadastroMonstrosTab();
        return;
    }

    // Aba "Cad. Itens"
    if (tabId === 'cadastro-itens-content' || tabId === 'cadastro-itens') {
        target.innerHTML = ''; 
        if (typeof renderCadastroItensTab === 'function') renderCadastroItensTab();
        return;
    }

    // Aba "Lore Personagens"
    if (tabId === 'lore-personagens-content' || tabId === 'lore-personagens') {
        target.innerHTML = ''; 
        if (typeof renderLorePersonagensTab === 'function') renderLorePersonagensTab();
        return;
    }

    // Aba "Backoffice" (Admin)
    if (tabId === 'backoffice-content' || tabId === 'backoffice') {
        target.innerHTML = ''; 
        if (typeof renderBackofficeTab === 'function') renderBackofficeTab();
        return;
    }

    // Aba "Gerenciador de Backups" (Admin)
    if (tabId === 'backups-content' || tabId === 'backups') {
        target.innerHTML = ''; 
        if (typeof renderBackupsTab === 'function') renderBackupsTab();
        return;
    }

    // Aba "Editor de Constelações" (Admin)
    if (tabId === 'cadastro-constelacoes-content' || tabId === 'cadastro-constelacoes') {
        target.innerHTML = ''; 
        if (typeof renderCadastroConstelacoesTab === 'function') renderCadastroConstelacoesTab();
        return;
    }

    // Aba "Gerenciador de Crafts" (Admin)
    if (tabId === 'cadastro-craft-content' || tabId === 'cadastro-craft') {
        target.innerHTML = ''; 
        if (typeof renderCadastroCraftTab === 'function') renderCadastroCraftTab();
        return;
    }

    // Aba "Gerenciador de Deuses" (Admin)
    if (tabId === 'cadastro-deuses-content' || tabId === 'cadastro-deuses') {
        target.innerHTML = ''; 
        if (typeof renderCadastroDeusesTab === 'function') renderCadastroDeusesTab();
        return;
    }

    // Aba "Forja Espiritual / EGO" (Admin)
    if (tabId === 'cadastro-ego-content' || tabId === 'cadastro-ego') {
        target.innerHTML = ''; 
        if (typeof renderCadastroEgoTab === 'function') renderCadastroEgoTab();
        return;
    }

    // Aba "Engine Econômica / Lojas" (Admin)
    if (tabId === 'cadastro-lojas-content' || tabId === 'cadastro-lojas') {
        target.innerHTML = ''; 
        if (typeof renderCadastroLojasTab === 'function') renderCadastroLojasTab();
        return;
    }

    // Aba "Gerenciador de Notícias" (Admin)
    if (tabId === 'cadastro-noticias-content' || tabId === 'cadastro-noticias') {
        target.innerHTML = ''; 
        if (typeof renderCadastroNoticiasTab === 'function') renderCadastroNoticiasTab();
        return;
    }

    // Aba "Gestor de Pets" (Admin)
    if (tabId === 'cadastro-pets-content' || tabId === 'cadastro-pets') {
        target.innerHTML = ''; 
        if (typeof renderCadastroPetsTab === 'function') renderCadastroPetsTab();
        return;
    }

    // Aba "Gestor de Império / Reputação" (Admin)
    if (tabId === 'cadastro-reputacao-content' || tabId === 'cadastro-reputacao') {
        target.innerHTML = ''; 
        if (typeof renderCadastroReputacaoTab === 'function') renderCadastroReputacaoTab();
        return;
    }

    // Aba "Firebase Batch Updater" (Admin)
    if (tabId === 'firebase-muda-all-content' || tabId === 'firebase-muda-all') {
        target.innerHTML = ''; 
        if (typeof renderFirebaseMudaAllTab === 'function') renderFirebaseMudaAllTab();
        return;
    }

    // Aba "Firebase Conditional Updater" (Admin)
    if (tabId === 'firebase-muda-if-content' || tabId === 'firebase-muda-if') {
        target.innerHTML = ''; 
        if (typeof renderFirebaseMudaIfTab === 'function') renderFirebaseMudaIfTab();
        return;
    }

    // Aba "Gerador de Tabela XP" (Admin)
    if (tabId === 'gerar-tabela-xp-content' || tabId === 'gerar-tabela-xp') {
        target.innerHTML = ''; 
        if (typeof renderGerarTabelaXpTab === 'function') renderGerarTabelaXpTab();
        return;
    }

    // Aba "Mapa Mundial (God Mode)" (Admin)
    if (tabId === 'mapa-mundial-content' || tabId === 'mapa-mundial') {
        target.innerHTML = ''; 
        if (typeof renderMapaMundialTab === 'function') renderMapaMundialTab();
        return;
    }

    if (tabId === 'painel-fichas') {
        if (globalState.selectedCharacterId) {
            window.renderFichaEditor(globalState.selectedCharacterId);
        } else {
            renderPainelFichas();
        }
        return;
    } 
    
    // Abas que requerem personagem
    if (globalState.selectedCharacterId) {
        if(tabId === 'rolagem-dados') { renderRolagemDados(); return; }
        if(tabId === 'calculadora-combate') { renderCalculadoraCombate(); return; }
        if(tabId === 'minhas-habilidades') { renderMinhasHabilidades(); if(window.renderSkillUsageLogs) window.renderSkillUsageLogs(); return; }
        if(tabId === 'mochila') { renderMochila(); return; }
        if(tabId === 'itens-equipados') { renderItensEquipados(); return; }
        if(tabId === 'calculadora-atributos') { renderCalculadoraAtributos(); return; }
        if(tabId === 'constelacao') { renderConstelacaoTab(); return; }
        if(tabId === 'crafting') { renderCraftingTab(); return; }
        if(tabId === 'extracao') { renderExtracaoTab(); return; }
        if(tabId === 'colecao-craft') { renderCollectionTab(); return; }
        if(tabId === 'arma-espiritual') { renderArmaEspiritualTab(); return; }
        if(tabId === 'meus-pets') { renderPetsTab(); return; }
        if(tabId === 'recursos-reputacao') { renderReputacaoTab(); return; }
        if(tabId === 'comercio') { if(globalState.commerce) globalState.commerce.sellableCache = null; renderComercioTab(); return; }
        if(tabId === 'mapa-movimento') { setTimeout(() => window.renderMapTab(), 100); return; }
        if(tabId === 'arena-combate') { if (window.arena && window.arena.init) window.arena.init(); return; }
        
        // Se chegou aqui, a aba não tem função e exibe o "Página em construção"
        window.renderBlankPage('Em Construção');
    } else {
        if (target) target.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500"><p>Selecione um personagem na barra lateral para acessar.</p></div>';
    }
};
 
// --- AUTENTICAÇÃO E LOGIN ---
dom.btn_login?.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, dom.auth_email.value, dom.auth_password.value)
        .catch(err => alert("Erro no login: " + err.message));
});

dom.btn_logout?.addEventListener('click', () => signOut(auth));

// --- ARQUITETURA DE MENUS DO MESTRE ---
const MASTER_ARCHITECTURE = {
    'Início': [
        { id: 'inicio', icon: 'fa-home', label: 'Página Inicial', render: () => window.showTab('inicio-content') }    ],
    'O Mundo': [
        { id: 'conheca-mundo', icon: 'fa-globe', label: 'Conheça o mundo', render: () => window.showTab('conheca-mundo-content') },
        { id: 'os-deuses', icon: 'fa-bolt', label: 'Os Deuses', render: () => window.showTab('os-deuses-content') },
        { id: 'lendas-mundo', icon: 'fa-book-dead', label: 'Lendas do Mundo', render: () => window.showTab('lendas-mundo-content') },
        { id: 'npcs-geral', icon: 'fa-users', label: 'NPCs Importantes', render: () => window.showTab('npcs-geral-content') }
    ],
    'Manual e Regras': [
        { id: 'blank', icon: 'fa-book', label: 'Manual', render: () => window.renderBlankPage('Manual') },
        { id: 'racas', icon: 'fa-dna', label: 'Raças', render: () => window.showTab('racas-content') },
        { id: 'classes', icon: 'fa-khanda', label: 'Classes', render: () => window.showTab('classes-content') },
        { id: 'subclasses', icon: 'fa-project-diagram', label: 'Subclasses', render: () => window.showTab('subclasses-content') },
        { id: 'habilidades-regras', icon: 'fa-book-open', label: 'Habilidades', render: () => window.showTab('habilidades-regras-content') },
        { id: 'profissoes-regras', icon: 'fa-hammer', label: 'Profissões', render: () => window.showTab('profissoes-regras-content') }
    ],
    'Ao Mestre': [
        { id: 'comandos-mestre', icon: 'fa-crown', label: 'Comandos Mestre', render: () => window.showTab('comandos-mestre-content') },
        { id: 'cadastro-npcs', icon: 'fa-user-plus', label: 'Cad. NPCs', render: () => window.showTab('cadastro-npcs-content') },
        //{ id: 'blank', icon: 'fa-tools', label: 'Cad. Crafts', render: () => window.renderBlankPage('Cad. Crafts') },
        { id: 'cadastro-monstros', icon: 'fa-dragon', label: 'Cad. Monstros', render: () => window.showTab('cadastro-monstros-content') },
        { id: 'cadastro-itens', icon: 'fa-gem', label: 'Cad. Itens', render: () => window.showTab('cadastro-itens-content') },
        { id: 'lore-personagens', icon: 'fa-scroll', label: 'Lore Personagens', render: () => window.showTab('lore-personagens-content') }
    ],
    'Painel Admin': [
        { id: 'backoffice', icon: 'fa-database', label: 'Backoffice', render: () => window.showTab('backoffice-content'), requiresAdmin: true },
        { id: 'backups', icon: 'fa-server', label: 'Backups', render: () => window.showTab('backups-content'), requiresAdmin: true },
        { id: 'cadastro-constelacoes', icon: 'fa-project-diagram', label: 'Matriz de Estrelas', render: () => window.showTab('cadastro-constelacoes-content'), requiresAdmin: true },
        { id: 'cadastro-craft', icon: 'fa-tools', label: 'Engenharia Craft', render: () => window.showTab('cadastro-craft-content'), requiresAdmin: true },
        { id: 'cadastro-deuses', icon: 'fa-om', label: 'Panteão Divino', render: () => window.showTab('cadastro-deuses-content'), requiresAdmin: true },
        { id: 'cadastro-ego', icon: 'fa-gavel', label: 'Forja Espiritual', render: () => window.showTab('cadastro-ego-content'), requiresAdmin: true },
        { id: 'cadastro-lojas', icon: 'fa-coins', label: 'Engine Econômica', render: () => window.showTab('cadastro-lojas-content'), requiresAdmin: true },
        { id: 'cadastro-noticias', icon: 'fa-newspaper', label: 'Diário Mestre', render: () => window.showTab('cadastro-noticias-content'), requiresAdmin: true },
        { id: 'cadastro-pets', icon: 'fa-paw', label: 'Gestor Bestiário', render: () => window.showTab('cadastro-pets-content'), requiresAdmin: true },
        { id: 'cadastro-reputacao', icon: 'fa-chess-rook', label: 'Gestor Império', render: () => window.showTab('cadastro-reputacao-content'), requiresAdmin: true },
        { id: 'firebase-muda-all', icon: 'fa-biohazard', label: 'Injeção DB', render: () => window.showTab('firebase-muda-all-content'), requiresAdmin: true },
        { id: 'firebase-muda-if', icon: 'fa-filter', label: 'Mutação DB (IF)', render: () => window.showTab('firebase-muda-if-content'), requiresAdmin: true },
        { id: 'gerar-tabela-xp', icon: 'fa-chart-line', label: 'Engine de Níveis', render: () => window.showTab('gerar-tabela-xp-content'), requiresAdmin: true },
        { id: 'mapa-mundial', icon: 'fa-map', label: 'Mapa (Fog of War)', render: () => window.showTab('mapa-mundial-content'), requiresAdmin: true }
    ],
    'Ao Jogador': [
        { id: 'simular-ficha', icon: 'fa-flask', label: 'Simular Ficha', render: () => window.showTab('simular-ficha-content') },
        { id: 'ficha-menu', icon: 'fa-id-card', label: 'Ficha de Personagem', render: () => window.openFichaPersonagemMenu() },
        { id: 'blank', icon: 'fa-images', label: 'Galeria de Imagens', render: () => window.renderBlankPage('Galeria de Imagens') }
    ],
    'Atualizações': [
        { id: 'atualizacoes-novidades', icon: 'fa-bullhorn', label: 'Novidades', render: () => window.showTab('atualizacoes-novidades-content') }    ]
};

// --- AS 16 ABAS DA FICHA ---
const FICHA_TABS = [
    { id: 'painel-fichas', icon: 'fa-user', label: 'Painel de Ficha', render: () => window.showTab('painel-fichas') },
    //{ id: 'rolagem-dados', icon: 'fa-dice-d20', label: 'Rolagem de Dados', render: () => window.showTab('rolagem-dados') },
    { id: 'minhas-habilidades', icon: 'fa-fire', label: 'Minhas Habilidades', render: () => window.showTab('minhas-habilidades') },
    { id: 'mochila', icon: 'fa-briefcase', label: 'Mochila', render: () => window.showTab('mochila') },    { id: 'itens-equipados', icon: 'fa-tshirt', label: 'Itens Equipados', render: () => window.showTab('itens-equipados') },
    { id: 'calculadora-atributos', icon: 'fa-chart-bar', label: 'Status Base', render: () => window.showTab('calculadora-atributos') },
    { id: 'constelacao', icon: 'fa-star', label: 'Constelação', render: () => window.showTab('constelacao') },
    { id: 'crafting', icon: 'fa-hammer', label: 'Oficina de Criação', render: () => window.showTab('crafting') },
    { id: 'extracao', icon: 'fa-recycle', label: 'Extração e Reciclagem', render: () => window.showTab('extracao') },
    { id: 'colecao-craft', icon: 'fa-book-atlas', label: 'Diário de Coleção', render: () => window.showTab('colecao-craft') },
    { id: 'arma-espiritual', icon: 'fa-ghost', label: 'Arma Espiritual', render: () => window.showTab('arma-espiritual') },
    { id: 'meus-pets', icon: 'fa-dragon', label: 'Meus Pets', render: () => window.showTab('meus-pets') },
    { id: 'recursos-reputacao', icon: 'fa-crown', label: 'Império (Recursos)', render: () => window.showTab('recursos-reputacao') },
    { id: 'comercio', icon: 'fa-coins', label: 'Comércio Local', render: () => window.showTab('comercio') },
    { id: 'mapa-movimento', icon: 'fa-map-marked-alt', label: 'Mapa Mundi', render: () => window.showTab('mapa-movimento') },
    { id: 'arena-combate', icon: 'fa-chess-board', label: 'Arena de Combate', render: () => window.showTab('arena-combate') }
];

window.openFichaPersonagemMenu = function(autoClick = true) {
    localStorage.setItem('ultimoMenuAcessado', 'Ficha'); // Salva o menu no cache
    populateSidebar(FICHA_TABS, true);
    
    if (autoClick) {
        setTimeout(() => {
            const botoesSidebar = document.querySelectorAll('#sub-menu-bar button');
            if(botoesSidebar[1]) botoesSidebar[1].click();
        }, 10);
    }
};

window.setMasterContext = function(menuName, autoClick = true) {
    localStorage.setItem('ultimoMenuAcessado', menuName); 
    
    document.querySelectorAll('#global-top-nav button.master-nav-btn').forEach(b => {
        const txt = b.textContent.trim();
        const isActive = txt.startsWith(menuName);
        
        // Remove estados visuais ativos
        b.classList.remove('bg-amber-600', 'text-black', 'border-amber-500', 'bg-red-600', 'bg-purple-500', 'shadow-inner');
        
        if (!isActive) {
            b.classList.add('bg-slate-800');
            // Mantém as cores especiais mesmo inativo
            if(txt.includes('Mestre')) {
                b.classList.add('text-red-500', 'border-red-900/50');
                b.classList.remove('text-amber-500', 'text-slate-300', 'border-slate-700');
            } else if(txt.includes('Admin')) {
                b.classList.add('text-purple-400', 'border-purple-900/50');
                b.classList.remove('text-amber-500', 'text-slate-300', 'border-slate-700');
            } else {
                b.classList.add('text-slate-300', 'border-slate-700');
                b.classList.remove('text-amber-500', 'text-red-500', 'text-purple-400');
            }
        } else {
            // Aplica estado Ativo
            b.classList.remove('bg-slate-800', 'text-slate-300', 'text-red-500', 'text-purple-400', 'border-slate-700', 'border-red-900/50', 'border-purple-900/50');
            b.classList.add('text-black', 'shadow-inner');
            
            if(txt.includes('Mestre')) {
                b.classList.add('bg-red-600', 'border-red-500');
            } else if(txt.includes('Admin')) {
                b.classList.add('bg-purple-400', 'border-purple-300');
            } else {
                b.classList.add('bg-amber-600', 'border-amber-500');
            }
        }
    });

    if (MASTER_ARCHITECTURE[menuName]) {
        populateSidebar(MASTER_ARCHITECTURE[menuName], false);
        if (autoClick) {
            setTimeout(() => {
                const firstBtn = document.querySelector('#sub-menu-bar button');
                if (firstBtn) firstBtn.click();
            }, 10);
        }
    }
};

function populateSidebar(subAbaArray, isFichaMenu = false) {
    const sidebar = document.getElementById('sub-menu-bar');
    if(!sidebar) return;
    sidebar.innerHTML = '';

    if (isFichaMenu) {
        const backBtn = document.createElement('button');
        backBtn.className = "w-full h-12 flex items-center justify-start px-4 bg-red-900/10 text-red-500 hover:bg-red-900/30 transition-all border-l-4 border-red-500 shrink-0 mb-2";
        backBtn.innerHTML = `
            <i class="fas fa-arrow-left text-lg w-6 text-center"></i>
            <span class="ml-3 font-bold uppercase tracking-widest text-[10px]">Voltar ao Menu</span>
        `;
        backBtn.onclick = () => window.setMasterContext('Ao Jogador');
        sidebar.appendChild(backBtn);
        
        const div = document.createElement('div');
        div.className = "w-[80%] h-px bg-slate-800 mb-2 shrink-0 mx-auto";
        sidebar.appendChild(div);
    }

    subAbaArray.forEach(subAba => {
        
        if (subAba.requiresAdmin && globalState.userRole !== 'admin') return;
        
        const btn = document.createElement('button');
        btn.dataset.tabId = subAba.id; 
        // Layout de botão expansivo (ícone na esquerda, texto que acompanha)
        btn.className = "w-full h-11 flex items-center justify-start px-4 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all border-l-4 border-transparent shrink-0";
        btn.innerHTML = `
            <i class="fas ${subAba.icon} text-[1.1rem] transition-colors w-6 text-center shrink-0"></i>
            <span class="ml-3 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">${subAba.label}</span>
        `;

        btn.onclick = () => {
            const defaultView = document.getElementById('default-view');
            if (defaultView) defaultView.classList.add('hidden');

            document.querySelectorAll('#sub-menu-bar button').forEach(b => {
                if(!b.classList.contains('text-red-500')) {
                    b.classList.remove('bg-slate-800', 'border-amber-500', 'text-amber-500');
                    b.classList.add('text-slate-400', 'border-transparent');
                    b.querySelector('i')?.classList.replace('text-amber-500', 'text-slate-400');
                }
            });
            
            btn.classList.add('bg-slate-800', 'border-amber-500', 'text-amber-500');
            btn.classList.remove('text-slate-400', 'border-transparent');
            btn.querySelector('i')?.classList.replace('text-slate-400', 'text-amber-500');
            
            subAba.render();
        };
        sidebar.appendChild(btn);
    });
}

// Vincula cliques no Menu Superior
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.master-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.textContent.trim();
            let targetContext = 'Início';
            if(text.includes('O Mundo')) targetContext = 'O Mundo';
            if(text.includes('Manual')) targetContext = 'Manual e Regras';
            if(text.includes('Mestre')) targetContext = 'Ao Mestre';
            if(text.includes('Admin')) targetContext = 'Painel Admin';
            if(text.includes('Jogador')) targetContext = 'Ao Jogador';
            if(text.includes('Atualizações')) targetContext = 'Atualizações';
            
            window.setMasterContext(targetContext);
        });
    });
});

// Inicialização Principal
onAuthStateChanged(auth, async (user) => {
    if (user) {
        globalState.currentUser = user;
        globalState.isAdmin = user.email === ADMIN_EMAIL;
        
        // --- 1. CONTROLE DE ACESSO DO MESTRE VIA ROLE DO FIREBASE ---
        const userRef = doc(db, 'rpg_users', user.uid);
        let role = 'jogador'; // Padrão de segurança
        
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                role = userSnap.data().role || 'jogador';
            }
            
            // Força o role para admin se o email bater com o ADMIN_EMAIL configurado no state.js
            if (globalState.isAdmin) {
                role = 'admin';
            }
            
            globalState.userRole = role; // Guarda no estado global
        } catch (err) {
            console.error("Erro ao buscar permissões do utilizador:", err);
        }

        // Manipula visualmente os botões
        const btnAoMestre = Array.from(document.querySelectorAll('.master-nav-btn')).find(b => b.textContent.trim().includes('Mestre'));
        const btnAdmin = Array.from(document.querySelectorAll('.master-nav-btn')).find(b => b.textContent.trim().includes('Admin'));
        
        // CONTROLE DO BOTÃO MESTRE
        if (btnAoMestre) {
            if (role === 'mestre' || role === 'admin') {
                btnAoMestre.classList.remove('hidden');
                btnAoMestre.classList.add('text-red-500', 'border-red-900/50');
                btnAoMestre.classList.remove('text-slate-300', 'border-slate-700');
            } else {
                btnAoMestre.classList.add('hidden');
            }
        }

        // CONTROLE DO BOTÃO ADMIN (Só você o vê!)
        if (btnAdmin) {
            if (role === 'admin') {
                btnAdmin.classList.remove('hidden');
                // Adiciona o brilho épico que pediu
                btnAdmin.classList.add('text-purple-400', 'border-purple-500/50', 'shadow-[0_0_15px_rgba(168,85,247,0.4)]');
                btnAdmin.classList.remove('text-slate-300', 'border-slate-700');
            } else {
                btnAdmin.classList.add('hidden');
            }
        }
        // --- FIM DA VERIFICAÇÃO DE ACESSO ---

        if (dom.auth_view) dom.auth_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('hidden');
        if (dom.app_view) dom.app_view.classList.add('flex');
        
        await loadCache();
        await preencherCachesEstaticos();
        initWorldHeader();
        await preencherCacheTodosPersonagens();
        await carregarPersonagensNoSeletor(user);
        
        window.renderSidebarDice(); // Renderiza os dados físicos na lateral

        if (typeof setupMochilaListeners === 'function') setupMochilaListeners();
        if (typeof setupConstelacaoListeners === 'function') setupConstelacaoListeners();
        if (typeof setupCraftingListeners === 'function') setupCraftingListeners();
        if (typeof setupExtracaoListeners === 'function') setupExtracaoListeners();

        // RECUPERA MEMÓRIA DO CACHE OU DEFAULTS PARA O INÍCIO
        const ultimoMenu = localStorage.getItem('ultimoMenuAcessado') || 'Início';
        const ultimaAba = localStorage.getItem('ultimaAbaAcessada') || 'inicio-content';

        if (ultimoMenu === 'Ficha') {
            // Simula a seleção visual do "Ao Jogador" no topo, mas carrega o menu da Ficha
            document.querySelectorAll('#global-top-nav button.master-nav-btn').forEach(b => {
                const isJogador = b.textContent.trim().startsWith('Ao Jogador');
                b.classList.toggle('border-amber-500', isJogador);
                b.classList.toggle('text-amber-500', isJogador);
                b.classList.toggle('bg-slate-800', !isJogador);
                b.classList.toggle('bg-amber-600', isJogador);
                b.classList.toggle('text-black', isJogador);
                b.classList.toggle('text-slate-300', !isJogador);
            });
            window.openFichaPersonagemMenu(false); // false = previne o auto-clique
        } else {
            window.setMasterContext(ultimoMenu, false); // false = previne o auto-clique
        }

        // Abre exatamente a aba que o utilizador estava a ver antes de dar F5
        setTimeout(() => window.showTab(ultimaAba), 200);
        
    } else {
        globalState.currentUser = null;
        globalState.isAdmin = false;
        if (dom.auth_view) dom.auth_view.classList.remove('hidden');
        if (dom.app_view) dom.app_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('flex');
        globalState.selectedCharacterId = null;
        globalState.selectedCharacterData = null;
        globalState.cache.personagens.clear();
        globalState.cache.all_personagens.clear();
    }
});

// --- ROLAGEM DE DADOS NA SIDEBAR LATERAL ---
window.renderSidebarDice = function() {
    const c = document.getElementById('sidebar-dice-area');
    if(!c) return;
    const dice = [
        { id: 'd4', sides: 4, label: 'D4' },
        { id: 'd6', sides: 6, label: 'D6' },
        { id: 'd8', sides: 8, label: 'D8' },
        { id: 'd10', sides: 10, label: 'D10' },
        { id: 'd12', sides: 12, label: 'D12' },
        { id: 'd20', sides: 20, label: 'D20' },
        { id: 'd100', sides: 100, label: 'D100' },
        { id: 'moeda', sides: 2, label: 'Moeda' }
    ];
    c.innerHTML = dice.map(d => `<button onclick="window.rollDiceSidebar('${d.id}', ${d.sides}, '${d.label}')" class="bg-slate-800 hover:bg-amber-600 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-black font-bold text-[9px] h-8 rounded transition-colors shadow flex items-center justify-center cursor-pointer">${d.label}</button>`).join('');
};

// window.rollDiceSidebar = async function(id, sides, label) {
//     const charId = globalState.selectedCharacterId;
//     if (!charId) return alert("Selecione um personagem primeiro para rolar dados!");

//     const result = id === 'moeda' ? (Math.random() < 0.5 ? 'Cara' : 'Coroa') : Math.floor(Math.random() * sides) + 1;
//     const novoLog = { dado: label, valor: result, timestamp: Date.now() };

//     const ficha = globalState.selectedCharacterData.ficha;
//     const logsAtuais = ficha.log_rolagens || [];
//     logsAtuais.unshift(novoLog);
//     if (logsAtuais.length > 50) logsAtuais.pop();
//     ficha.log_rolagens = logsAtuais;

//     window.renderSidebarDiceLog();

//     try {
//         await updateDoc(doc(db, "rpg_fichas", charId), {
//             [`rolagens.${id}`]: result,
//             log_rolagens: logsAtuais
//         });
//     } catch(e) { console.error("Erro ao rolar:", e); }
// };

// window.renderSidebarDiceLog = function() {
//     const container = document.getElementById('sidebar-dice-log');
//     if (!container) return;
//     const logs = globalState.selectedCharacterData?.ficha?.log_rolagens || [];
    
//     if (logs.length === 0) {
//         container.innerHTML = '<div class="text-slate-600 italic text-center text-[9px] py-6">Nenhuma rolagem feita ainda.</div>';
//         return;
//     }
    
//     container.innerHTML = logs.slice(0, 15).map(log => `
//         <div class="flex justify-between items-center border-b border-slate-800/50 pb-1 mb-1">
//             <span class="text-[8px] text-slate-500">${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
//             <span class="text-slate-300 font-bold text-[9px]">${log.dado}</span>
//             <span class="text-amber-400 font-black text-xs">${log.valor}</span>
//         </div>
//     `).join('');
// };

// --- GERENCIAMENTO DE CACHES E ATUALIZAÇÃO LATERAL ---
async function loadCache() {
    ['players', 'mobs', 'personagens', 'all_personagens', 'npcs'].forEach(key => {
        if (!globalState.cache[key]) globalState.cache[key] = new Map();
        else globalState.cache[key].clear();
    });

    try {
        const qP = query(collection(db, "rpg_fichas"));
        const snapP = await getDocs(qP);
        snapP.forEach(d => {
            const data = {id: d.id, type: 'player', collection: 'rpg_fichas', ...d.data()};
            globalState.cache.players.set(d.id, data);
            globalState.cache.all_personagens.set(d.id, data);
            if(globalState.isAdmin || data.jogadorUid === globalState.currentUser?.uid) {
                globalState.cache.personagens.set(d.id, data);
            }
        });
        
        const qM = query(collection(db, "rpg_fichasNPCMonstros"));
        const snapM = await getDocs(qM);
        snapM.forEach(d => globalState.cache.mobs.set(d.id, {id: d.id, type: 'monster', collection: 'rpg_fichasNPCMonstros', ...d.data()}));
        
        const qN = query(collection(db, "rpg_Npcs"));
        const snapN = await getDocs(qN);
        snapN.forEach(d => globalState.cache.npcs.set(d.id, {id: d.id, type: 'npc', collection: 'rpg_Npcs', ...d.data()}));

    } catch(e) { console.error("Erro no loadCache:", e); }
}

async function preencherCachesEstaticos() {
    const mapasNecessarios = [
        'profissoes', 'receitas', 'armasEspirituais', 'habilidadesEspirito',
        'pets', 'habilidadesPet', 'mobs', 'lojas', 'buildings', 'allies', 'allItems',
        'itemConfig', 'shopTiers', 'itemTiers', 'racas', 'classes', 'subclasses', 
        'habilidades', 'efeitos', 'tiposItens'
    ];
    
    mapasNecessarios.forEach(key => {
        if (!globalState.cache[key]) globalState.cache[key] = new Map();
    });

    const cargas = [
        { nome: 'rpg_item_tiers', mapa: globalState.cache.itemTiers },
        { nome: 'rpg_racas', mapa: globalState.cache.racas },
        { nome: 'rpg_classes', mapa: globalState.cache.classes },
        { nome: 'rpg_subclasses', mapa: globalState.cache.subclasses },
        { nome: 'rpg_habilidades', mapa: globalState.cache.habilidades },
        { nome: 'rpg_efeitosGerais', mapa: globalState.cache.efeitos },
        { nome: 'rpg_itemTipos', mapa: globalState.cache.tiposItens },
        { nome: 'rpg_itensCraftados', mapa: globalState.cache.receitas },
        { nome: 'rpg_profissoes', mapa: globalState.cache.profissoes },   
        { nome: 'rpg_armasEspirituais', mapa: globalState.cache.armasEspirituais },
        { nome: 'rpg_habilidadesEspirito', mapa: globalState.cache.habilidadesEspirito },
        { nome: 'rpg_pets', mapa: globalState.cache.pets },
        { nome: 'rpg_habilidadesPet', mapa: globalState.cache.habilidadesPet },
        { nome: 'rpg_fichasNPCMonstros', mapa: globalState.cache.mobs },
        { nome: 'rpg_estabelecimentos_templates', mapa: globalState.cache.buildings },
        { nome: 'rpg_aliados_templates', mapa: globalState.cache.allies },
        { nome: 'rpg_itensCadastrados', mapa: globalState.cache.allItems },
        { nome: 'rpg_lojas', mapa: globalState.cache.lojas },
        { nome: 'rpg_balanceamento_itens_precos_geral', mapa: globalState.cache.itemConfig },
        { nome: 'rpg_shop_tiers', mapa: globalState.cache.shopTiers }
    ];
    
    await Promise.all(cargas.map(async (item) => {
        if(item.mapa.size > 0) return; 
        try {
            const q = query(collection(db, item.nome));
            const snap = await getDocs(q);
            snap.forEach(d => item.mapa.set(d.id, {id: d.id, ...d.data()}));
        } catch (e) { }
    }));

    if(globalState.cache.itens.size === 0) {
        const loadItens = async (col) => (await getDocs(query(collection(db, col)))).forEach(d => {
            if(!globalState.cache.itens.has(d.id)) globalState.cache.itens.set(d.id, {id: d.id, ...d.data()});
        });
        await Promise.all([loadItens('rpg_itensCadastrados'), loadItens('rpg_itensMochila')]);
    }

    if (!globalState.cache.tabela_xp) {
        const d = await getDoc(doc(db, "rpg_configuracoes", "tabela_xp"));
        if(d.exists()) globalState.cache.tabela_xp = d.data();
    }
    
    if (!globalState.cache.tabelaXpEspirito) {
        try { const d = await getDoc(doc(db, "rpg_tabelaXpEspirito", "padrao")); if(d.exists()) globalState.cache.tabelaXpEspirito = d.data(); } catch(e) { }
    }

    if (!globalState.cache.tabelaXpPet) {
        try { const d = await getDoc(doc(db, "rpg_tabelaXpPet", "padrao")); if(d.exists()) globalState.cache.tabelaXpPet = d.data(); } catch(e) { }
    }
    
    if (typeof renderSlotsEquipamento === 'function') renderSlotsEquipamento();
}

async function preencherCacheTodosPersonagens() {
    if(globalState.cache.all_personagens.size > 0) return;
    (await getDocs(query(collection(db, "rpg_fichas"), orderBy("nome")))).forEach(d => globalState.cache.all_personagens.set(d.id, {id: d.id, ...d.data()}));
}

async function gatherAllCharacterData(charId) {
    const data = { 
        ficha: null, raca: {}, classe: {}, subclasse: {}, 
        itensEquipados: [], bonusItens: createBonusObject(), 
        tabelaXP: globalState.cache.tabela_xp || {}, constellationTemplate: null 
    };

    const charFullData = globalState.cache.all_personagens.get(charId);
    if(!charFullData) throw new Error("Ficha não encontrada");
    
    data.ficha = charFullData;
    if(charFullData.racaId) data.raca = globalState.cache.racas.get(charFullData.racaId) || {};
    if(charFullData.classeId) data.classe = globalState.cache.classes.get(charFullData.classeId) || {};
    if(charFullData.subclasseId) data.subclasse = globalState.cache.subclasses.get(charFullData.subclasseId) || {};

    if(charFullData.classeId) {
        try { const snap = await getDoc(doc(db, "rpg_constelacoes_templates", charFullData.classeId)); if(snap.exists()) data.constellationTemplate = snap.data(); } catch(e) { }
    }

    const equipMap = (charFullData.ficha && charFullData.ficha.equipamentos) ? charFullData.ficha.equipamentos : (charFullData.equipamentos || {});
    
    Object.values(equipMap).filter(id => id).forEach(id => {
        const item = globalState.cache.itens.get(id);
        if(item) {
            data.itensEquipados.push(item);
            data.bonusItens.atk += Number(item.atk_base || 0);
            data.bonusItens.def += Number(item.def_base || 0);
            data.bonusItens.eva += Number(item.eva_base || 0);

            ['hpMax','mpMax','iniciativa','movimento','apMax'].forEach(k => {
                const baseKey = k === 'apMax' ? 'ap_base' : (k === 'hpMax' ? 'hp_base' : (k === 'mpMax' ? 'mp_base' : `${k}_base`));
                data.bonusItens[k] += Number(item[baseKey] || 0);
            });

            if(item.efeitos_especiais) {
                for(const eid in item.efeitos_especiais) {
                    const val = Number(item.efeitos_especiais[eid] || 0);
                    const eff = globalState.cache.efeitos.get(eid);
                    if(eff) {
                        const map = {hp:'hpMax', mp:'mpMax', iniciativa:'iniciativa', velocidade:'movimento', movimento:'movimento', ap:'apMax', atk:'atk', def:'def', eva:'eva'};
                        const k = map[eff.tipoNome?.toLowerCase()];
                        if(k) data.bonusItens[k] += val;
                    }
                }
            }
        }
    });
    return data;
}

// --- SELETOR DE PERSONAGEM E SINC ---
async function carregarPersonagensNoSeletor(user) {
    const select = document.getElementById('character-select');
    if(!select) return;
    
    select.innerHTML = '<option value="">-- Carregando... --</option>';
    globalState.cache.personagens.clear();

    globalState.cache.all_personagens.forEach((char, id) => {
         if (globalState.isAdmin || char.jogadorUid === user.uid) {
            globalState.cache.personagens.set(id, char);
         }
    });

    select.innerHTML = '<option value="">-- Selecione um Personagem --</option>';
    [...globalState.cache.personagens.values()].sort((a,b)=>(a.nome||'').localeCompare(b.nome)).forEach(c => {
        select.add(new Option(`${c.nome} (${c.jogador||'???'})`, c.id));
    });

    const lastId = localStorage.getItem('personagemAtivoId');
    if(lastId && globalState.cache.personagens.has(lastId)) {
        select.value = lastId;
        await handleCharacterSelect(lastId);
    } else {
        handleCharacterSelect("");
    }
}

if (document.getElementById('character-select')) {
    document.getElementById('character-select').addEventListener('change', (e) => handleCharacterSelect(e.target.value));
}

let unsubscribeChar = null;
let unsubscribeSessions = null;

function handleCharacterSelect(id) {
    if(unsubscribeChar) {
        unsubscribeChar();
        unsubscribeChar = null;
    }
    
    // NOVO: Gatilho imediato que zera a tela antes do novo personagem carregar
    if (typeof window.resetHubChat === 'function') window.resetHubChat();

    updateCharacterSessions(id);

    // Se o usuário selecionou "-- Selecione um Personagem --" (Vazio)
    if(!id) {
        globalState.selectedCharacterId = null;
        globalState.selectedCharacterData = null;
        localStorage.removeItem('personagemAtivoId');
        renderHeaderWidget();
        if(window.updateGlobalBars) window.updateGlobalBars();
        
        let activeTab = 'painel-fichas';
        document.querySelectorAll('.tab-content').forEach(c => {
            if (!c.classList.contains('hidden')) activeTab = c.id.replace('-content', '');
        });
        if(activeTab === 'painel-fichas') renderPainelFichas();
        return;
    }

    // Se o usuário escolheu um personagem válido
    globalState.selectedCharacterId = id;
    localStorage.setItem('personagemAtivoId', id);

    unsubscribeChar = onSnapshot(doc(db, "rpg_fichas", id), async (docSnap) => {
        if(docSnap.exists()) {
            const fichaAtualizada = { id: docSnap.id, ...docSnap.data() };
            globalState.cache.all_personagens.set(id, fichaAtualizada);
            
            globalState.selectedCharacterData = await gatherAllCharacterData(id);
            if(window.updateGlobalBars) window.updateGlobalBars();
            
            let activeTab = 'painel-fichas';
            document.querySelectorAll('.tab-content').forEach(c => {
                if (!c.classList.contains('hidden')) activeTab = c.id.replace('-content', '');
            });
            
            // Recarrega a aba que o usuário estava visualizando
            if(activeTab === 'painel-fichas') {
                if (!document.getElementById('editor-nome')) window.renderFichaEditor(id); 
            } 
            else if(activeTab === 'constelacao') renderConstelacaoTab();
            else if(activeTab === 'arma-espiritual') renderArmaEspiritualTab();
            else if(activeTab === 'meus-pets') renderPetsTab();
            else if(activeTab === 'itens-equipados') renderItensEquipados();
            else if(activeTab === 'calculadora-atributos') renderCalculadoraAtributos();
            else if(activeTab === 'mochila') renderMochila();
            else if(activeTab === 'minhas-habilidades') {
                renderMinhasHabilidades();
                if(window.renderSkillUsageLogs) window.renderSkillUsageLogs(); 
            }
            else if(activeTab === 'calculadora-combate') renderCalculadoraCombate();
            else if(activeTab === 'recursos-reputacao') renderReputacaoTab();
            else if(activeTab === 'comercio') {
                if(globalState.commerce) globalState.commerce.sellableCache = null;
                renderComercioTab();
            }
        }
    });
}

// --- BARRAS GLOBAIS DE STATUS (LATERAL) ---
window.updateGlobalBars = function() {
    const charId = globalState.selectedCharacterId;
    if (!charId || !globalState.selectedCharacterData || !globalState.selectedCharacterData.ficha) {
        document.getElementById('sidebar-char-name').textContent = 'Selecione um Aventureiro';
        document.getElementById('sidebar-char-class').textContent = '---';
        document.getElementById('sidebar-char-subclass').textContent = '---';
        document.getElementById('sidebar-char-img').src = 'https://placehold.co/400x400/0f172a/d4af37?text=Sem+Foto';
        document.getElementById('sidebar-char-atk').textContent = '0';
        document.getElementById('sidebar-char-def').textContent = '0';
        document.getElementById('sidebar-char-eva').textContent = '0';
        return;
    }

    const ficha = globalState.selectedCharacterData.ficha;
    const atributos = ficha.atributosBasePersonagem || {};
    
    // Atualiza Foto, Nome, Classe e Subclasse
    const imgKey = ficha.imagemPrincipal;
    const imgUrl = (imgKey && ficha.imageUrls && ficha.imageUrls[imgKey]) ? ficha.imageUrls[imgKey] : 'https://placehold.co/400x400/0f172a/d4af37?text=Sem+Foto';
    document.getElementById('sidebar-char-img').src = imgUrl;
    
    document.getElementById('sidebar-char-name').textContent = ficha.nome || 'Sem Nome';
    document.getElementById('sidebar-char-class').textContent = globalState.selectedCharacterData.classe?.nome || 'Sem Classe';
    document.getElementById('sidebar-char-subclass').textContent = globalState.selectedCharacterData.subclasse?.nome || 'Sem Subc.';

    // Cálculo exato de status (usando a Calculadora Global do Painel de Fichas)
    const simulado = {
        ficha: ficha,
        raca: globalState.selectedCharacterData.raca,
        classe: globalState.selectedCharacterData.classe,
        subclasse: globalState.selectedCharacterData.subclasse,
        bonusItens: globalState.selectedCharacterData.bonusItens,
        constellationTemplate: globalState.selectedCharacterData.constellationTemplate
    };
    const pts = {
        atk: ficha.pontosDistribuidosAtk || 0,
        def: ficha.pontosDistribuidosDef || 0,
        eva: ficha.pontosDistribuidosEva || 0
    };
    
    // A função calculateMainStats busca TODOS os bônus e camadas automaticamente
    const stats = calculateMainStats(simulado, pts);
    const debuffFome = getFomeDebuffMultiplier(ficha);

    // Atualiza a trindade ATK/DEF/EVA no painel
    document.getElementById('sidebar-char-atk').textContent = Math.floor(stats.atk * debuffFome);
    document.getElementById('sidebar-char-def').textContent = Math.floor(stats.def * debuffFome);
    document.getElementById('sidebar-char-eva').textContent = Math.floor(stats.eva * debuffFome);

    // Cálculos Exatos de HP e MP usando os valores processados da calculadora
    const hpMax = stats.hpMax || 1; 
    const hpExtraMax = Number(atributos.pontosHPExtraTotal) || 0;
    const hpShieldMax = Number(atributos.defesaCorporalNativaTotal) || 0; 
    const hpAtual = ficha.hpPersonagemBase !== undefined ? Number(ficha.hpPersonagemBase) : hpMax;
    const hpExtraAtual = ficha.hpExtraAtual !== undefined ? Number(ficha.hpExtraAtual) : hpExtraMax;
    const hpShieldAtual = ficha.hpShieldAtual !== undefined ? Number(ficha.hpShieldAtual) : hpShieldMax;

    const mpMax = stats.mpMax || 1; 
    const mpExtraMax = Number(atributos.pontosMPExtraTotal) || 0;
    const mpShieldMax = Number(atributos.defesaMagicaNativaTotal) || 0; 
    const mpAtual = ficha.mpPersonagemBase !== undefined ? Number(ficha.mpPersonagemBase) : mpMax;
    const mpExtraAtual = ficha.mpExtraAtual !== undefined ? Number(ficha.mpExtraAtual) : mpExtraMax;
    const mpShieldAtual = ficha.mpShieldAtual !== undefined ? Number(ficha.mpShieldAtual) : mpShieldMax;

    const totalHpMax = hpMax + hpExtraMax + hpShieldMax;
    const totalHpAtual = Math.max(0, hpAtual + hpExtraAtual + hpShieldAtual);
    const totalMpMax = mpMax + mpExtraMax + mpShieldMax;
    const totalMpAtual = Math.max(0, mpAtual + mpExtraAtual + mpShieldAtual);

    const setWidth = (id, pct) => { const el = document.getElementById(id); if(el) el.style.width = `${pct}%`; };
    
    // Preenchimento Gráfico das 3 barras
    setWidth('hdr-hp-base', Math.min(100, Math.max(0, (hpAtual / hpMax) * 100)));
    setWidth('hdr-hp-extra', hpExtraMax > 0 ? Math.min(100, Math.max(0, (hpExtraAtual / hpExtraMax) * 100)) : 0);
    setWidth('hdr-hp-shield', hpShieldMax > 0 ? Math.min(100, Math.max(0, (hpShieldAtual / hpShieldMax) * 100)) : 0);

    setWidth('hdr-mp-base', Math.min(100, Math.max(0, (mpAtual / mpMax) * 100)));
    setWidth('hdr-mp-extra', mpExtraMax > 0 ? Math.min(100, Math.max(0, (mpExtraAtual / mpExtraMax) * 100)) : 0);
    setWidth('hdr-mp-shield', mpShieldMax > 0 ? Math.min(100, Math.max(0, (mpShieldAtual / mpShieldMax) * 100)) : 0);

    // Valores em Texto da soma completa
    const txtHpHdr = document.getElementById('hdr-hp-text');
    if(txtHpHdr) txtHpHdr.textContent = `${Math.floor(totalHpAtual)}/${Math.floor(totalHpMax)}`;

    const txtMpHdr = document.getElementById('hdr-mp-text');
    if(txtMpHdr) txtMpHdr.textContent = `${Math.floor(totalMpAtual)}/${Math.floor(totalMpMax)}`;
    
    // Fome
    const fomeExtra = Number(atributos.pontosFomeExtraTotal) || 0;
    const fomeMax = Math.floor(100 + fomeExtra);
    let fomeAtual = ficha.fomeAtual !== undefined ? Number(ficha.fomeAtual) : fomeMax;
    if (fomeAtual > fomeMax) fomeAtual = fomeMax;

    setWidth('bar-fome-fill', Math.max(0, Math.min(100, (fomeAtual / fomeMax) * 100)));
};

// ==========================================
// --- HUB VTT: CHAT E DADOS POR SESSÃO ---
// ==========================================
let currentHubTab = 'hub-dice';
let activeChatRef = null; 

// Função de limpeza absoluta de interface
window.resetHubChat = function() {
    // 1. Desliga o rádio do banco de dados
    if (activeChatRef) {
        off(activeChatRef);
        activeChatRef = null;
    }
    
    // 2. Limpa a memória local das mensagens
    globalState.currentChatLogs = [];
    
    // 3. Oculta todos os avisos de mensagens não lidas
    ['hub-dice', 'hub-chat', 'hub-master', 'hub-whisper'].forEach(tab => {
        const badge = document.getElementById(`badge-${tab}`);
        if (badge) badge.classList.add('hidden');
    });
    
    // 4. Limpa a barra lateral
    renderHubMessages();
    
    // 5. Tenta limpar a aba grande se ela estiver aberta no fundo
    const logGrande = document.getElementById('log-lista');
    if (logGrande) logGrande.innerHTML = '<p class="text-slate-500 text-sm italic">Nenhuma rolagem ou sessão ativa.</p>';
};

window.switchHubTab = function(tabId) {
    currentHubTab = tabId;
    
    // Identificador único de quem está lendo (Personagem ou Mestre)
    const watcherId = globalState.selectedCharacterId || (globalState.isAdmin ? 'master' : 'unknown');
    
    // Salva o momento exato em que o usuário abriu esta aba
    localStorage.setItem(`chatRead_${watcherId}_${tabId}`, Date.now());

    document.querySelectorAll('.hub-tab-btn').forEach(btn => {
        if (btn.dataset.target === tabId) {
            btn.classList.add('active');
            const badge = btn.querySelector('span');
            if(badge) badge.classList.add('hidden'); 
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('hub-footer-dice')?.classList.toggle('hidden', tabId !== 'hub-dice');
    document.getElementById('hub-footer-chat')?.classList.toggle('hidden', tabId !== 'hub-chat' && tabId !== 'hub-master');
    document.getElementById('hub-footer-whisper')?.classList.toggle('hidden', tabId !== 'hub-whisper');
    
    const inputChat = document.getElementById('hub-chat-input');
    if(inputChat) inputChat.placeholder = tabId === 'hub-master' ? "Aviso do Mestre..." : "Enviar para todos...";

    renderHubMessages(); 
};

window.sendHubMessage = async function(type) {
    if (!globalState.selectedCharacterId && !globalState.isAdmin) return alert("Selecione um personagem.");
    if (!globalState.activeSessionId || globalState.activeSessionId === 'world') return alert("Selecione uma Mesa na sessão para usar o chat.");
    if (type === 'mestre' && !globalState.isAdmin) return alert("Apenas o Mestre pode mandar avisos globais.");

    let inputEl, text, targetId = null, targetName = null;

    if (type === 'whisper') {
        inputEl = document.getElementById('hub-whisper-input');
        const sel = document.getElementById('hub-whisper-target');
        targetId = sel?.value;
        if (!targetId) return alert("Selecione para quem deseja sussurrar.");
        targetName = sel.options[sel.selectedIndex].text;
    } else {
        inputEl = document.getElementById('hub-chat-input');
    }

    text = inputEl?.value.trim();
    if (!text) return;

    let remetenteId = "master"; let remetenteNome = "Mestre";
    if (globalState.selectedCharacterData && globalState.selectedCharacterData.ficha) {
        remetenteId = globalState.selectedCharacterId;
        remetenteNome = globalState.selectedCharacterData.ficha.nome;
    }

    const payload = {
        tipo: type,
        remetenteId,
        remetenteNome,
        mensagem: text,
        timestamp: rtdbServerTimestamp()
    };

    if (type === 'whisper') { payload.destinatarioId = targetId; payload.destinatarioNome = targetName; }
    inputEl.value = ''; 

    try {
        const chatRef = rtdbRef(rtdb, `session_chats/${globalState.activeSessionId}`);
        const newMsgRef = push(chatRef);
        await set(newMsgRef, payload);
    } catch(e) {
        console.error("Erro ao enviar:", e); alert("Erro ao enviar mensagem.");
    }
};

window.listenToSessionChat = function(sessionId) {
    if (activeChatRef) {
        off(activeChatRef); 
        activeChatRef = null;
    }
    
    globalState.currentChatLogs = [];
    renderHubMessages(); 

    if (!sessionId || sessionId === 'world') return;

    const baseRef = rtdbRef(rtdb, `session_chats/${sessionId}`);
    activeChatRef = rtdbQuery(baseRef, limitToLast(100)); 
    
    onValue(activeChatRef, (snapshot) => {
        const data = snapshot.val();
        const logs = [];
        
        if (data) {
            Object.keys(data).forEach(key => logs.push({ id: key, ...data[key] }));
            logs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 
        }

        // LÓGICA DE NOTIFICAÇÕES PERSISTENTES
        const watcherId = globalState.selectedCharacterId || (globalState.isAdmin ? 'master' : 'unknown');
        const latestTimes = { 'hub-dice': 0, 'hub-chat': 0, 'hub-master': 0, 'hub-whisper': 0 };

        // Descobre a hora da última mensagem de CADA aba
        logs.forEach(d => {
            let targetAba = '';
            if(d.tipo === 'dice') targetAba = 'hub-dice';
            else if(d.tipo === 'geral') targetAba = 'hub-chat';
            else if(d.tipo === 'mestre') targetAba = 'hub-master';
            else if(d.tipo === 'whisper') {
                 if(globalState.isAdmin || d.destinatarioId === watcherId || d.remetenteId === watcherId) targetAba = 'hub-whisper';
            }
            if(targetAba && d.timestamp > latestTimes[targetAba]) {
                latestTimes[targetAba] = d.timestamp;
            }
        });

        // Compara com o que o usuário leu no localStorage
        ['hub-dice', 'hub-chat', 'hub-master', 'hub-whisper'].forEach(tab => {
            const badge = document.getElementById(`badge-${tab}`);
            if (!badge) return;

            if (tab === currentHubTab) {
                // Se a aba está aberta agora, atualiza a data de leitura e esconde a bolinha
                localStorage.setItem(`chatRead_${watcherId}_${tab}`, Date.now());
                badge.classList.add('hidden');
            } else if (latestTimes[tab] > 0) {
                // Se não está aberta, verifica se há mensagens novas depois da última leitura
                const lastRead = Number(localStorage.getItem(`chatRead_${watcherId}_${tab}`) || 0);
                if (latestTimes[tab] > lastRead) {
                    badge.classList.remove('hidden'); // TEM NOVIDADE!
                } else {
                    badge.classList.add('hidden'); // TUDO LIDO!
                }
            }
        });

        globalState.currentChatLogs = logs.reverse(); 
        renderHubMessages();
    });
};

function renderHubMessages() {
    const container = document.getElementById('hub-log-container');
    if (!container) return;

    if (!globalState.activeSessionId || globalState.activeSessionId === 'world') {
        container.innerHTML = '<div class="text-slate-600 italic text-center text-[9px] py-6 px-4">Selecione uma Sessão na barra inferior para acessar o Chat e as Rolagens conjuntas.</div>';
        return;
    }

    const logs = globalState.currentChatLogs || [];
    const watcherId = globalState.selectedCharacterId || (globalState.isAdmin ? 'master' : 'unknown');
    
    const filteredLogs = logs.filter(log => {
        if (currentHubTab === 'hub-dice') return log.tipo === 'dice';
        if (currentHubTab === 'hub-chat') return log.tipo === 'geral';
        if (currentHubTab === 'hub-master') return log.tipo === 'mestre';
        if (currentHubTab === 'hub-whisper') {
             if (log.tipo !== 'whisper') return false;
             if (globalState.isAdmin) return true;
             return log.remetenteId === watcherId || log.destinatarioId === watcherId;
        }
        return true;
    });

    if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="text-slate-600 italic text-center text-[9px] py-6 px-4">Nenhum registro nesta aba ainda.</div>';
        return;
    }

    let html = '';
    [...filteredLogs].reverse().forEach(log => {
        const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '...';
        
        if (log.tipo === 'dice') {
             html += `
                <div class="bg-slate-900/30 border-l-2 border-amber-500 pl-2 py-1 mb-1 flex items-center flex-wrap gap-1.5">
                    <span class="text-sky-400 font-bold text-[9px]">${log.remetenteNome}</span>
                    <span class="text-slate-400 text-[10px]">rolou <strong class="text-slate-200">${log.dado}</strong> <i class="fas fa-arrow-right text-[8px] text-slate-600 mx-0.5"></i></span>
                    <span class="text-amber-400 font-black text-[12px] drop-shadow-md leading-none">${log.valor}</span>
                    <span class="text-slate-600 text-[8px] ml-auto">${timeStr}</span>
                </div>`;
        }
        else if (log.tipo === 'geral') {
             html += `
                <div class="bg-slate-900/50 border-l-2 border-slate-600 pl-2 py-1 mb-1">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <span class="text-amber-500 font-bold text-[9px]">${log.remetenteNome}</span>
                        <span class="text-slate-500 text-[8px]">${timeStr}</span>
                    </div>
                    <div class="text-slate-200 text-[10px] break-words leading-tight">${log.mensagem}</div>
                </div>`;
        }
        else if (log.tipo === 'mestre') {
             html += `
                <div class="bg-red-900/20 border border-red-900/50 rounded p-2 mb-1 shadow-inner">
                    <div class="text-red-500 font-bold text-[9px] uppercase tracking-widest mb-1 flex justify-between">
                        <span><i class="fas fa-crown"></i> ${log.remetenteNome}</span>
                        <span class="text-[8px] opacity-60">${timeStr}</span>
                    </div>
                    <div class="text-red-200 text-[10px] break-words italic leading-relaxed">${log.mensagem}</div>
                </div>`;
        }
        else if (log.tipo === 'whisper') {
             const isMe = log.remetenteId === watcherId;
             html += `
                <div class="bg-purple-900/20 border-l-2 border-purple-500 pl-2 py-1 mb-1">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <span class="text-purple-400 font-bold text-[9px]">${isMe ? 'Para: ' + log.destinatarioNome : 'De: ' + log.remetenteNome}</span>
                        <span class="text-slate-500 text-[8px]">${timeStr}</span>
                    </div>
                    <div class="text-purple-200 text-[10px] break-words italic leading-tight">"${log.mensagem}"</div>
                </div>`;
        }
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight; 
}

// Binds de Eventos de Tela do Hub
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hub-tab-btn').forEach(btn => btn.addEventListener('click', (e) => window.switchHubTab(e.currentTarget.dataset.target)));
    const btnSend = document.getElementById('hub-btn-send'); const inputChat = document.getElementById('hub-chat-input');
    if(btnSend) btnSend.addEventListener('click', () => window.sendHubMessage(currentHubTab === 'hub-master' ? 'mestre' : 'geral'));
    if(inputChat) inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.sendHubMessage(currentHubTab === 'hub-master' ? 'mestre' : 'geral'); });
    const btnSendW = document.getElementById('hub-btn-whisper-send'); const inputW = document.getElementById('hub-whisper-input');
    if(btnSendW) btnSendW.addEventListener('click', () => window.sendHubMessage('whisper'));
    if(inputW) inputW.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.sendHubMessage('whisper'); });
});
// ==========================================

// --- GESTÃO DE SESSÕES ---
async function updateCharacterSessions(charId) {
    const sessionSelect = document.getElementById('session-select');
    const container = document.getElementById('session-selector-container');
    
    if (unsubscribeSessions) {
        unsubscribeSessions();
        unsubscribeSessions = null;
    }

    if (!charId) {
        if(container) container.classList.add('hidden');
        return;
    }

    const lastSavedSession = localStorage.getItem(`sessaoAtiva_${charId}`) || "world";
    globalState.activeSessionId = lastSavedSession;

    const q = query(collection(db, "rpg_sessions"), where("playerIds", "array-contains", charId));

    unsubscribeSessions = onSnapshot(q, (snap) => {
        globalState.userSessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (globalState.userSessions.length > 0) {
            if(container) container.classList.remove('hidden');
            if(sessionSelect) {
                sessionSelect.innerHTML = '<option value="world">🌍 Horário Mundial</option>';
                globalState.userSessions.forEach(sess => { sessionSelect.add(new Option(`👥 ${sess.name}`, sess.id)); });
                sessionSelect.value = globalState.activeSessionId;

                if (globalState.activeSessionId !== "world" && !globalState.userSessions.find(s => s.id === globalState.activeSessionId)) {
                    sessionSelect.value = "world";
                    globalState.activeSessionId = "world";
                    localStorage.setItem(`sessaoAtiva_${charId}`, "world");
                } else if (globalState.activeSessionId !== "world") {
                    // NOVO: Se ele já tem uma sessão ativa válida, auto-carrega o chat RTDB e sussurros!
                    if (window.listenToSessionChat) window.listenToSessionChat(globalState.activeSessionId);
                    if (typeof popularSussurros === 'function') popularSussurros();
                }
            }
        } else {
            if(container) container.classList.add('hidden');
            globalState.activeSessionId = "world";
        }
        renderHeaderWidget();
    });
}

document.addEventListener('change', (e) => {
    if(e.target && e.target.id === 'session-select') {
        globalState.activeSessionId = e.target.value;
        if(globalState.selectedCharacterId) localStorage.setItem(`sessaoAtiva_${globalState.selectedCharacterId}`, e.target.value);
        renderHeaderWidget();
        const arenaTab = document.getElementById('arena-combate-content');
        if (arenaTab && !arenaTab.classList.contains('hidden') && window.arena?.init) window.arena.init();
        
        // NOVO: Reinicia o listener do chat e popula a lista de sussurros
        if(window.listenToSessionChat) window.listenToSessionChat(e.target.value);
        popularSussurros();
    }
});

function popularSussurros() {
    const sel = document.getElementById('hub-whisper-target');
    if(!sel) return;
    sel.innerHTML = '<option value="">Selecione o alvo...</option>';
    
    if(!globalState.activeSessionId || globalState.activeSessionId === 'world') return;
    
    const sess = globalState.userSessions?.find(s => s.id === globalState.activeSessionId);
    if(sess && sess.playerIds) {
        sess.playerIds.forEach(pId => {
            if(pId === globalState.selectedCharacterId) return; // Não pode sussurrar pra si mesmo
            const char = globalState.cache.all_personagens.get(pId);
            if(char) {
                sel.add(new Option(char.nome, pId));
            }
        });
    }
}

// --- HEADER DO MUNDO ---
window.getSessionTimeAndPeriod = function() {
    let w = globalState.world.data || { time: "12:00" };
    if (globalState.activeSessionId && globalState.activeSessionId !== 'world') {
        const sess = globalState.userSessions.find(s => s.id === globalState.activeSessionId);
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

function initWorldHeader() {
    onSnapshot(doc(db, 'rpg_world_state', 'main'), (snap) => {
        if (snap.exists()) { globalState.world.data = snap.data(); renderHeaderWidget(); }
    });
    onSnapshot(query(collection(db, 'rpg_locations'), orderBy('name')), (snap) => {
        globalState.world.locations = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (!globalState.world.selectedLocId && globalState.world.locations.length > 0) globalState.world.selectedLocId = globalState.world.locations[0].id;
        renderHeaderWidget();
    });
    onSnapshot(collection(db, 'rpg_events'), (snap) => {
        globalState.world.events = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderHeaderWidget();
    });
    onSnapshot(collection(db, 'rpg_seasons'), (snap) => {
        globalState.world.seasons = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderHeaderWidget();
    });
}

function renderHeaderWidget() {
    const container = document.getElementById('header-world-widget');
    if (!container || !globalState.world.data) return;

    const w = globalState.world.data;
    let timeDisplay = w.time || "12:00";
    let dayDisplay = w.day || "1";
    let monthDisplay = w.month || "1";
    let yearDisplay = w.year || "1000";
    let isCustomSession = false;

    if (globalState.activeSessionId && globalState.activeSessionId !== "world") {
        const session = globalState.userSessions?.find(s => s.id === globalState.activeSessionId);
        if (session) {
            timeDisplay = session.customTime || timeDisplay;
            dayDisplay = session.customDay || dayDisplay;
            isCustomSession = true;
        }
    }

    const MOON_PHASES = [
        { name: "Lua Nova", icon: "fa-circle", color: "#334155" },
        { name: "Lua Crescente", icon: "fa-moon", color: "#94a3b8" }, 
        { name: "Quarto Crescente", icon: "fa-moon", color: "#cbd5e1" },
        { name: "Lua Gibosa", icon: "fa-circle", color: "#e2e8f0" },
        { name: "Lua Cheia", icon: "fa-circle", color: "#ffffff" },
        { name: "Lua Disseminadora", icon: "fa-circle", color: "#e2e8f0" },
        { name: "Quarto Minguante", icon: "fa-moon", color: "#cbd5e1" },
        { name: "Lua Minguante", icon: "fa-moon", color: "#94a3b8" },
        { name: "Eclipse", icon: "fa-circle", color: "#ef4444" },
        { name: "Convergência", icon: "fa-star", color: "#a855f7" }
    ];
    const totalDays = (Number(yearDisplay) * 360) + (Number(monthDisplay) * 30) + Number(dayDisplay);
    let moon = MOON_PHASES[Math.floor((totalDays % 28) / 3.5)] || MOON_PHASES[0];
    const seasonName = globalState.world.seasons?.find(s => s.id === w.seasonId)?.name || "---";

    container.innerHTML = `
        <div class="flex items-center gap-4 animate-fade-in">
            <div class="text-right">
                <div class="text-xl font-mono font-bold ${isCustomSession ? 'text-indigo-400' : 'text-white'} leading-none">${timeDisplay}</div>
                <div class="text-[9px] ${isCustomSession ? 'text-indigo-500' : 'text-amber-500'} font-bold uppercase tracking-widest mt-1">
                    ${isCustomSession ? '<i class="fas fa-users"></i> SESSÃO' : 'MUNDIAL'} • ${dayDisplay}/${monthDisplay}/${yearDisplay}
                </div>
            </div>
            <div class="h-8 w-[1px] bg-slate-700"></div>
            <div class="text-center w-16">
                <div class="text-lg" title="${moon.name}"><i class="fas ${moon.icon}" style="color: ${moon.color}"></i></div>
                <div class="text-[8px] text-slate-400 uppercase font-bold mt-1">${seasonName}</div>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

function renderPaginaEmConstrucao(target) {
    if (!target) return;
    target.innerHTML = `
        <div class="flex flex-col h-full w-full items-center justify-center text-center opacity-50 select-none">
            <i class="fas fa-tools text-[8rem] mb-6 text-slate-700 animate-pulse"></i>
            <h2 class="font-cinzel text-4xl tracking-widest uppercase text-slate-400">Em Breve</h2>
            <p class="mt-4 text-xl uppercase tracking-widest text-slate-600">Esta área do império ainda está sendo forjada.</p>
        </div>
    `;
}