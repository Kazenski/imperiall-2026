import { db } from '../core/firebase.js';
import { collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let slides = [];

// CAMINHO LOCAL DA IMAGEM
const defaultBg = "imagens/backgroundInicio/background-inicio.png"; 

let bgTimeout;
let isViewingCard = false;

export async function renderInicioTab() {
    const container = document.getElementById('inicio-content');
    if (!container) return;

    container.innerHTML = `
        <div class="relative w-full h-full overflow-hidden bg-[#020617] fade-in">
            
            <div id="inicio-main-bg" class="absolute inset-0 bg-cover transition-all duration-1000 ease-in-out opacity-0" style="background-image: url('${defaultBg}'); background-position: center 20%;">
                <div class="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-95"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#020617] via-transparent to-[#020617] opacity-60"></div>
            </div>

            <div class="relative z-10 flex flex-col justify-center h-[65%] px-10 md:px-24 pointer-events-none">
                <h1 class="text-6xl md:text-8xl lg:text-[8rem] font-cinzel font-black text-amber-500 tracking-widest drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] leading-none">
                    IMPERIALL <br> <span class="text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">RPG</span>
                </h1>
                <p class="text-lg md:text-2xl text-slate-300 mt-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] max-w-3xl leading-relaxed italic">
                    "Em um mundo despedaçado por lendas antigas, o seu destino aguarda ser forjado. Bem-vindo à nova era."
                </p>
            </div>

            <div id="inicio-news-info" class="absolute top-1/3 right-10 md:right-24 z-20 text-right max-w-lg opacity-0 translate-y-4 transition-all duration-700 pointer-events-none">
                <h2 id="inicio-news-title" class="font-cinzel text-4xl md:text-5xl font-bold text-white drop-shadow-[0_4px_10px_rgba(0,0,0,1)] mb-4"></h2>
                <p id="inicio-news-subtitle" class="text-slate-200 text-base md:text-lg drop-shadow-[0_2px_5px_rgba(0,0,0,1)] leading-relaxed"></p>
                <a id="inicio-news-btn" href="#" target="_blank" class="inline-block mt-6 px-8 py-3 bg-amber-600 hover:bg-amber-400 text-black font-bold uppercase tracking-widest text-sm rounded transition-colors pointer-events-auto shadow-[0_0_15px_rgba(245,158,11,0.5)]">Ler Mais</a>
            </div>

            <div class="absolute bottom-0 left-0 w-full z-30 pb-6 px-10 md:px-24 bg-gradient-to-t from-[#020617] to-transparent pt-10">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-amber-500 font-cinzel font-bold tracking-widest text-sm md:text-base uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                        <i class="fas fa-scroll mr-2"></i> Crônicas do Mundo
                    </h3>
                    <span class="text-xs text-slate-400 italic drop-shadow-md">Selecione para visualizar</span>
                </div>
                
                <div id="inicio-cards-container" class="flex gap-6 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style="scroll-behavior: smooth;">
                    <div class="flex items-center justify-center w-full h-32">
                        <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const bgEl = document.getElementById('inicio-main-bg');
        if (bgEl && !isViewingCard) {
            bgEl.classList.remove('opacity-0');
            bgEl.classList.add('opacity-100');
        }
    }, 50);

    fetchNoticias();
}

async function fetchNoticias() {
    const cardsContainer = document.getElementById('inicio-cards-container');
    if (!cardsContainer) return;

    try {
        const q = query(collection(db, "rpg_noticias"), where('ativa', '==', true), orderBy('ordem'));
        const snapshot = await getDocs(q);
        
        slides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (slides.length > 0) {
            renderSmallCards();
        } else {
            cardsContainer.innerHTML = `<div class="text-slate-400 italic text-sm drop-shadow-md">Nenhuma crônica registrada no momento.</div>`;
        }
    } catch (error) {
        console.error("Erro ao buscar notícias: ", error);
        cardsContainer.innerHTML = `<div class="text-red-500 text-sm">Erro ao acessar os arquivos das crônicas.</div>`;
    }
}

function renderSmallCards() {
    const container = document.getElementById('inicio-cards-container');
    if (!container) return;

    container.innerHTML = '';
    
    slides.forEach((slide, index) => {
        const imgUrl = slide.imagemURL || 'https://placehold.co/600x400/1e293b/a1a1aa?text=Imperiall';
        
        const cardHTML = `
            <div class="shrink-0 snap-start cursor-pointer group w-64 md:w-[22rem] h-36 md:h-44 relative rounded-xl overflow-hidden shadow-[0_5px_15px_rgba(0,0,0,0.8)] border-2 border-slate-700 hover:border-amber-500 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(245,158,11,0.4)]"
                 onclick="window.inicio.changeBackground('${imgUrl}', ${index})">
                
                <img src="${imgUrl}" class="w-full h-full object-cover object-[center_20%] group-hover:scale-110 transition-transform duration-700">
                
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                
                <div class="absolute bottom-3 left-4 right-4">
                    <span class="text-amber-500 text-[10px] font-bold tracking-widest uppercase mb-1 block drop-shadow-md">Atualização</span>
                    <h4 class="text-white font-cinzel font-bold text-sm md:text-base leading-tight drop-shadow-md line-clamp-2">${escapeHTML(slide.titulo || 'Nova Atualização')}</h4>
                </div>
            </div>
        `;
        
        container.innerHTML += cardHTML;
    });
}

window.inicio = {
    changeBackground: function(imgUrl, index) {
        const bgEl = document.getElementById('inicio-main-bg');
        const infoEl = document.getElementById('inicio-news-info');
        const titleEl = document.getElementById('inicio-news-title');
        const subtitleEl = document.getElementById('inicio-news-subtitle');
        const btnEl = document.getElementById('inicio-news-btn');

        if (!bgEl) return;

        isViewingCard = true;

        // Quando clicamos, a imagem da notícia também carrega com os 20% do topo
        bgEl.style.backgroundImage = `url('${imgUrl}')`;
        bgEl.style.backgroundPosition = 'center 20%';
        bgEl.classList.remove('opacity-0');
        bgEl.classList.add('opacity-100');
        
        const slide = slides[index];
        if (slide) {
            titleEl.textContent = slide.titulo || '';
            subtitleEl.textContent = slide.subtitulo || '';
            if (slide.linkBotao) {
                btnEl.href = slide.linkBotao;
                btnEl.textContent = slide.textoBotao || 'Ler Mais';
                btnEl.style.display = 'inline-block';
            } else {
                btnEl.style.display = 'none';
            }
            infoEl.classList.remove('opacity-0', 'translate-y-4');
            infoEl.classList.add('opacity-100', 'translate-y-0');
        }

        clearTimeout(bgTimeout);

        bgTimeout = setTimeout(() => {
            isViewingCard = false;
            if (bgEl) {
                bgEl.style.backgroundImage = `url('${defaultBg}')`;
                bgEl.style.backgroundPosition = 'center 20%';
            }
            if (infoEl) {
                infoEl.classList.remove('opacity-100', 'translate-y-0');
                infoEl.classList.add('opacity-0', 'translate-y-4');
            }
        }, 20000);
    }
};