// ARQUIVO: js/core/auth.js
// Controle de acesso no CLIENTE.
//
// IMPORTANTE — leia antes de confiar neste arquivo:
// isto NÃO é uma barreira de segurança. Tudo aqui roda no navegador do
// usuário e pode ser contornado pelo console. A barreira real são as
// Security Rules do Firestore (ver firestore.rules na raiz do projeto).
//
// O objetivo deste módulo é duplo:
//   1. Não exibir o painel admin para quem não é admin (UX correta).
//   2. Falhar alto e cedo se alguém tentar chamar uma função admin direto
// do console, em vez de executar a operação e só falhar no Firestore.
//
// Paper trail: todas as tentativas são registradas em `authAuditLog` para
// que a interface de admin possa exibir uma linha do tempo.

import { ADMIN_EMAIL } from './state.js';

/** Papéis reconhecidos, do menor para o maior. */
export const ROLES = Object.freeze({
    JOGADOR: 'jogador',
    MESTRE: 'mestre',
    ADMIN: 'admin'
});

const RANK = { [ROLES.JOGADOR]: 0, [ROLES.MESTRE]: 1, [ROLES.ADMIN]: 2 };

/**
 * Estado de autorização do cliente.
 * Mantido separado de globalState para deixar explícito que é decisão de UI,
 * não uma garantia.
 */
export const authSession = {
    uid: null,
    email: null,
    role: ROLES.JOGADOR,
    authAuditLog: []
};

// Máximo de entradas no log (evita crescimento sem limite em sessão longa).
const MAX_AUDIT = 50;

function audit(action, detail) {
    authSession.authAuditLog.push({
        action,
        detail,
        uid: authSession.uid,
        at: Date.now()
    });
    if (authSession.authAuditLog.length > MAX_AUDIT) {
        authSession.authAuditLog.shift();
    }
}

/**
 * Define a sessão após o login.
 * @param {{uid:string,email:string}|null} user
 * @param {string} role papel vindo de `rpg_users/{uid}.role`
 */
export function setAuthSession(user, role) {
    if (!user) {
        authSession.uid = null;
        authSession.email = null;
        authSession.role = ROLES.JOGADOR;
        authSession.authAuditLog.length = 0;
        return authSession;
    }

    authSession.uid = user.uid;
    authSession.email = user.email || null;

    // O e-mail do ADMIN_EMAIL dá admin. Todo o resto vem do documento de
    // papel, com 'jogador' como padrão seguro para valores desconhecidos.
    const fromDoc = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (user.email === ADMIN_EMAIL) {
        authSession.role = ROLES.ADMIN;
    } else if (Object.hasOwn(RANK, fromDoc)) {
        authSession.role = fromDoc;
    } else {
        authSession.role = ROLES.JOGADOR;
    }

    audit('login', { email: authSession.email, role: authSession.role });
    return authSession;
}

/** Nível numérico do papel atual (0 jogador, 1 mestre, 2 admin). */
export function currentRank() {
    return RANK[authSession.role] ?? 0;
}

/** Ha sessao autenticada? */
export function isAuthenticated() {
    return Boolean(authSession.uid);
}

/** Eh admin? */
export function isAdmin() {
    return authSession.role === ROLES.ADMIN;
}

/** Eh mestre OU admin? */
export function isMaster() {
    return currentRank() >= RANK[ROLES.MESTRE];
}

/**
 * Verifica se o usuario pode acessar uma aba.
 *
 * @param {string} tabId id da aba, ex.: 'backoffice-content'
 * @returns {{allowed:boolean, reason?:string}}
 */
export function canAccessTab(tabId) {
    if (!isAuthenticated()) {
        return { allowed: false, reason: 'Faça login para acessar esta área.' };
    }

    // Tabs que exigem papel admin. Mantido em sincronia com o campo
    // `requiresAdmin` usado na hora de montar a barra lateral.
    const ADMIN_TABS = new Set([
        'backoffice',
        'backups',
        'cadastro-constelacoes',
        'cadastro-craft',
        'cadastro-deuses',
        'cadastro-ego',
        'cadastro-lojas',
        'cadastro-noticias',
        'cadastro-pets',
        'cadastro-reputacao',
        'firebase-muda-all',
        'firebase-muda-if',
        'gerar-tabela-xp',
        'mapa-mundial',
        'cadastro-users'
    ]);

    const base = String(tabId).replace(/-content$/, '');
    if (ADMIN_TABS.has(base) && !isAdmin()) {
        audit('tab-bloqueada', { tab: tabId, role: authSession.role });
        return { allowed: false, reason: 'Esta área é restrita ao administrador.' };
    }

    return { allowed: true };
}

/**
 * Involucra uma função sensível.
 *
 * Envolve os `window.boTools`, `window.buTools`, `window.shopTools`,
 * `window.firebaseTools` e `window.userAdminTools`, que antes eram
 * chamáveis por qualquer pessoa logada direto do console, sem passar por
 * nenhum gate.
 *
 * @param {object} target objeto onde a função vive (ex.: window)
 * @param {string} nome nome da propriedade
 * @param {Function} fn implementação original
 * @param {object} [opts]
 * @param {string} [opts.label] nome legível para o log de auditoria
 * @param {boolean} [opts.adminOnly=true]
 */
export function guardFn(target, nome, fn, { label = null, adminOnly = true } = {}) {
    const wrapped = function (...args) {
        if (adminOnly && !isAdmin()) {
            audit('operacao-bloqueada', { fn: nome, role: authSession.role, args: args.length });
            console.warn(`[auth] "${label || nome}" exige privilégio de administrador.`);
            alert('Esta operação exige privilégio de administrador.');
            return undefined;
        }
        audit('operacao-permitida', { fn: nome });
        return fn.apply(this, args);
    };

    target[nome] = wrapped;
    return wrapped;
}

/**
 * Protege todas as ferramentas de admin já penduradas em `window`.
 * Idempotente: não re-embrulha duas vezes.
 */
export function guardAdminTools(scope = window) {
    const TOOL_NAMESPACES = [
        'boTools',      // backoffice.js
        'buTools',      // backups.js
        'shopTools',    // cadastroLojas.js
        'firebaseTools',// firebaseMudaAll.js
        'userAdminTools'// CadastroUsers.js
    ];

    let guarded = 0;

    for (const ns of TOOL_NAMESPACES) {
        const bag = scope[ns];
        if (!bag || typeof bag !== 'object') continue;

        for (const key of Object.keys(bag)) {
            if (typeof bag[key] !== 'function') continue;
            if (bag[key].__authGuarded) continue;

            const original = bag[key];
            const wrapped = function (...args) {
                if (!isAdmin()) {
                    audit('operacao-bloqueada', {
                        ns, fn: key, role: authSession.role
                    });
                    console.warn(`[auth] ${ns}.${key} exige privilégio de administrador.`);
                    alert('Esta operação exige privilégio de administrador.');
                    return undefined;
                }
                audit('operacao-permitida', { ns, fn: key });
                return original.apply(this, args);
            };

            wrapped.__authGuarded = true;
            bag[key] = wrapped;
            guarded++;
        }
    }

    return guarded;
}

/** Log de auditoria (para exibir na UI de admin). */
export function getAuditLog() {
    return [...authSession.authAuditLog].reverse();
}

/** Limpa o log de auditoria. */
export function clearAuditLog() {
    authSession.authAuditLog.length = 0;
}