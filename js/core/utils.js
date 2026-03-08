import { globalState, COINS, PLACEHOLDER_IMAGE_URL } from './state.js';

// Função de segurança para limpar textos e evitar bugs de HTML
export function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Converte saldo total em Cobre para objeto de moedas otimizado (Ouro, Prata, Bronze)
export function optimizeCoins(totalCopper) {
    let remaining = totalCopper;
    const nGold = Math.floor(remaining / COINS.GOLD.val);
    remaining %= COINS.GOLD.val;
    const nSilver = Math.floor(remaining / COINS.SILVER.val);
    remaining %= COINS.SILVER.val;
    const nBronze = remaining;
    return { gold: nGold, silver: nSilver, bronze: nBronze };
}

// Peso do rank para ordenação na Mochila e Loja
export function getRankWeight(rank) {
    if (!rank) return 0;
    let r = rank.toUpperCase();
    let weights = { 'SS': 7, 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
    return weights[r] !== undefined ? weights[r] : 0;
}

// Busca a imagem da moeda
export function getCoinImg(coinId) {
    const item = globalState.cache.itens.get(coinId) || globalState.cache.allItems.get(coinId);
    return item ? item.imagemUrl : PLACEHOLDER_IMAGE_URL;
}

// Compressor de Imagens (Otimização de Custos e Tamanho no Firebase Storage)
export function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Mantém a proporção correta
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte para um arquivo JPG otimizado
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', quality); 
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}