// ARQUIVO: js/core/hex.js
// Matemática hexagonal compartilhada (axial coords) + helpers de performance.
//
// Sistema de coordenadas: AXIAL (q, r) com "pointy-top".
// A distância é derivada do sistema CUBO: (|dq| + |dq+dr| + |dr|) / 2
//
// Este módulo substitui as funções que viviam soltas em window.arena.
// Todos os retornos são puros — nenhuma dependência de DOM.

export const HEX_SIZE = 17;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = 2 * HEX_SIZE;

// Grade do grid desenhado (índices de linha/coluna, NÃO coords axiais).
export const GRID_ROWS = 40;
export const GRID_COLS = 40;

// Direção axial "pointy-top". Alocada uma única vez — não dentro de loops.
export const HEX_DIRECTIONS = Object.freeze([
    { q:  1, r:  0 },
    { q:  1, r: -1 },
    { q:  0, r: -1 },
    { q: -1, r:  0 },
    { q: -1, r:  1 },
    { q:  0, r:  1 }
]);

/**
 * Converte índice de coluna da grade (odd-r) para coordenada axial.
 * O grid desenhado usa deslocamento: em linhas ímpares o eixo q antecipa em 1.
 */
export function gridToAxial(col, row) {
    return col - Math.floor(row / 2);
}

/** Distância hexagonal entre duas células axiais (sistema cubo). Sempre inteiro. */
export function hexDistance(q1, r1, q2, r2) {
    const dq = q1 - q2;
    const dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Posição em pixels do centro de uma célula axial (layout pointy-top). */
export function hexToPixel(q, r, size = HEX_SIZE, pad = 60) {
    return {
        x: size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r) + pad,
        y: size * (3 / 2 * r) + pad
    };
}

/** Arredonda coordenadas axiais fracionárias para a célula axial mais próxima. */
export function hexRound(q, r) {
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(-q - r);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - (-q - r));

    if (qDiff > rDiff && qDiff > sDiff)      rq = -rr - rs;
    else if (rDiff > sDiff)                  rr = -rq - rs;

    return { q: rq, r: rr };
}

/** Converte pixels de volta para célula axial. */
export function pixelToHex(x, y, size = HEX_SIZE, pad = 60) {
    const q = (Math.sqrt(3) / 3 * (x - pad) - 1 / 3 * (y - pad)) / size;
    const r = (2 / 3 * (y - pad)) / size;
    return hexRound(q, r);
}

/** Lista de vértices do hexágono (string de pontos para <polygon>). */
export function getHexPoints(cx, cy, size = HEX_SIZE) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i - 30;
        const angleRad = angleDeg * Math.PI / 180;
        pts.push(
            `${(cx + size * Math.cos(angleRad)).toFixed(2)},${(cy + size * Math.sin(angleRad)).toFixed(2)}`
        );
    }
    return pts.join(' ');
}

/**
 * TODAS as células dentro de um raio — caminhada em espiral.
 *
 * Substitui o antigo "for dentro de for" sobre as 40x40 = 1600 células.
 * Complexidade: O(R²) em vez de O(colunas × linhas).
 * Para raio 5: devolve 91 células em vez de varrer 1600.
 */
export function hexesInRadius(q0, r0, radius) {
    const r = Math.max(0, Math.floor(Number(radius) || 0));
    const out = [{ q: q0, r: r0 }];
    if (r === 0) return out;

    // 6 direções, uma por "fatia" da espiral.
    for (let k = 1; k <= r; k++) {
        // Começa na célula a nordeste e caminha pelas 6 direções até fechar o anel.
        let q = q0 + HEX_DIRECTIONS[4].q * k;   // (-1, +1)
        let rr = r0 + HEX_DIRECTIONS[4].r * k;

        for (let d = 0; d < 6; d++) {
            for (let step = 0; step < k; step++) {
                out.push({ q, r: rr });
                q += HEX_DIRECTIONS[d].q;
                rr += HEX_DIRECTIONS[d].r;
            }
        }
    }
    return out;
}

/** Anel exato (sem o centro) na distância `radius`. */
export function hexRing(q0, r0, radius) {
    const r = Math.max(1, Math.floor(Number(radius) || 1));
    const out = [];
    let q = q0 + HEX_DIRECTIONS[4].q * r;
    let rr = r0 + HEX_DIRECTIONS[4].r * r;

    for (let d = 0; d < 6; d++) {
        for (let step = 0; step < r; step++) {
            out.push({ q, r: rr });
            q += HEX_DIRECTIONS[d].q;
            rr += HEX_DIRECTIONS[d].r;
        }
    }
    return out;
}

/** Linha reta entre duas células (algoritmo de interpolação hexagonal). */
export function hexLine(q0, r0, q1, r1) {
    const N = hexDistance(q0, r0, q1, r1);
    if (N === 0) return [{ q: q0, r: r0 }];

    const out = [];
    // Interpolacao linear em coords axiais + arredondamento por cubo.
    // A nudged-interpolation so faz sentido quando as coordenadas nao sao
    // inteiras; com entradas inteiras ela deslocava a linha inteira em
    // uma casa (o primeiro ponto devolvia (1,0) em vez de (0,0)).
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        out.push(hexRound(q0 + (q1 - q0) * t, r0 + (r1 - r0) * t));
    }
    return out;
}

/** Cono direcional a partir de (q0,r0) numa das 6 direções. */
export function hexCone(q0, r0, dirIndex, range) {
    const dir = HEX_DIRECTIONS[((Number(dirIndex) || 0) + 6) % 6];
    const out = [];
    for (let i = 1; i <= Math.max(0, range); i++) {
        out.push({ q: q0 + dir.q * i, r: r0 + dir.r * i });
    }
    return out;
}

/**
 * Células alcançáveis por movimento, com BFS em anéis.
 *
 * Correções em relação à versão antiga:
 *  - respeita os limites da grade (antes podia devolver q/r negativos infinitos);
 *  - respeita muros com nome (antes qualquer obstáculo bloqueava, inclusive 'soft');
 *  - não inclui a célula de origem (ficar parado não gasta o movimento).
 *
 * @param {Set<string>|null} blockedSet chaves "q,r" já tratadas como intransponíveis
 *        (ex.: combinando obstáculos e tokens). Se null, só a grade limita.
 */
export function getReachableHexes(sq, sr, range, blockedSet = null) {
    const maxRange = Math.max(0, Math.floor(Number(range) || 0));
    const visited = new Set([`${sq},${sr}`]);
    if (maxRange === 0) return visited;

    let frontier = [{ q: sq, r: sr }];

    for (let k = 1; k <= maxRange; k++) {
        const next = [];
        for (const cell of frontier) {
            for (const dir of HEX_DIRECTIONS) {
                const nq = cell.q + dir.q;
                const nr = cell.r + dir.r;
                const key = `${nq},${nr}`;

                if (visited.has(key)) continue;
                if (!isInsideGrid(nq, nr)) continue;
                if (blockedSet && blockedSet.has(key)) continue;

                visited.add(key);
                next.push({ q: nq, r: nr });
            }
        }
        if (next.length === 0) break;
        frontier = next;
    }
    return visited;
}

/** A célula existe dentro do grid desenhado? */
export function isInsideGrid(q, r) {
    if (!Number.isFinite(q) || !Number.isFinite(r)) return false;
    if (r < 0 || r >= GRID_ROWS) return false;

    // axial q do grid: col - floor(row/2), onde col ∈ [0, GRID_COLS)
    const col = q + Math.floor(r / 2);
    return col >= 0 && col < GRID_COLS;
}

/**
 * Linha de visada entre duas células.
 * @param {Set<string>} blockedSet chaves "q,r" bloqueadas
 */
export function hasLineOfSight(q0, r0, q1, r1, blockedSet) {
    if (!blockedSet || blockedSet.size === 0) return true;
    const path = hexLine(q0, r0, q1, r1);
    // ignora origem e destino
    for (let i = 1; i < path.length - 1; i++) {
        if (blockedSet.has(`${path[i].q},${path[i].r}`)) return false;
    }
    return true;
}