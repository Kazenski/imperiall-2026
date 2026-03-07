// Lista explícita das imagens dos mapas
const mapasDoMundo = [
    "imagens/mapas/mapas1.webp",
    "imagens/mapas/mapas2.webp",
    "imagens/mapas/mapas3.webp",
    "imagens/mapas/mapas4.webp",
    "imagens/mapas/mapas5.webp",
    "imagens/mapas/mapas6.webp"
];

// Lista de Mídias dos Bardos com o caminho fornecido
const cancoesDoBardo = [
    { id: 1, tipo: 'musica', titulo: 'A Dança dos Três Continentes', src: 'audios/A Dança dos Três Continentes.mp3' },
    { id: 2, tipo: 'musica', titulo: 'O Sopro dos Oito', src: 'audios/O Sopro dos Oito (A Vida e a Ordem).mp3' },
    { id: 3, tipo: 'musica', titulo: 'A Sombra dos Quatro', src: 'audios/A Sombra dos Quatro.mp3' },
    { id: 4, tipo: 'musica', titulo: 'O Sacrifício', src: 'audios/O Sacrifício (A Prisão de Cristal).mp3' },
    { id: 5, tipo: 'musica', titulo: 'A Balada de Androa', src: 'audios/A Balada de Androa.mp3' },
    { id: 6, tipo: 'podcast', titulo: 'Criação Celestial de Gallandra', src: 'audios/A_Deusa_Gallandra_Criou_a_Ganância.mp3' }
];

export function renderConhecaMundoTab() {
    const container = document.getElementById('conheca-mundo-content');
    if (!container) return;

    // Gera o HTML do grid de mapas dinamicamente
    let mapasHTML = '';
    if (mapasDoMundo.length > 0) {
        mapasHTML = mapasDoMundo.map((url) => `
            <div class="relative group cursor-pointer overflow-hidden rounded-xl border-2 border-slate-700 hover:border-amber-500 shadow-lg aspect-video transition-all duration-300" onclick="window.conhecaMundo.openMapa('${url}')">
                <img src="${url}" onerror="this.src='https://placehold.co/800x450/1e293b/a1a1aa?text=Mapa+Não+Encontrado'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i class="fas fa-search-plus text-amber-500 text-4xl drop-shadow-md"></i>
                </div>
            </div>
        `).join('');
    }

    // Gera o HTML das mídias do Bardo
    let bardosHTML = cancoesDoBardo.map((midia) => `
        <button onclick="window.conhecaMundo.carregarAudio('${midia.src}', '${midia.titulo}')" 
            class="flex items-center gap-3 bg-slate-900/80 hover:bg-amber-600/20 border border-slate-700 hover:border-amber-500 rounded-lg p-3 transition-all group">
            <div class="w-10 h-10 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center group-hover:border-amber-400 shrink-0 transition-colors">
                <i class="fas ${midia.tipo === 'podcast' ? 'fa-podcast' : 'fa-music'} text-slate-400 group-hover:text-amber-400"></i>
            </div>
            <div class="text-left overflow-hidden">
                <span class="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">${midia.tipo}</span>
                <span class="block text-sm text-slate-300 group-hover:text-white font-cinzel font-bold truncate whitespace-nowrap">${midia.titulo}</span>
            </div>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16">
            
            <header class="mb-10 text-center w-full border-b border-slate-800 pb-8">
                <h1 class="text-4xl md:text-5xl font-black font-cinzel text-amber-500 drop-shadow-md tracking-widest mb-3">A Gênese de Imperiall</h1>
                <p class="text-slate-400 text-sm md:text-base italic w-full mx-auto">
                    "Antes dos mortais pisarem na terra, os deuses já traçavam o destino entre oceanos e lendas..."
                </p>
            </header>

            <div class="w-full bg-slate-900/60 p-8 md:p-12 rounded-2xl border border-slate-800 shadow-2xl mb-16 relative">
                <i class="fas fa-quote-left absolute top-6 left-6 text-slate-700 text-3xl opacity-50"></i>
                
                <div class="space-y-6 text-slate-300 text-base md:text-lg leading-relaxed font-serif relative z-10 text-justify">
                    <p>
                        <span class="text-3xl md:text-4xl font-cinzel font-bold text-amber-400 float-left mr-2 leading-none mt-1">H</span>
                        á muito tempo, antes mesmo da existência dos seres na terra, a Deusa Gallandra criou criaturas místicas para manter o mundo em ordem: os <strong>Leviatãs</strong>. Entre eles estavam Legina, Imperiall e Renstenci, cada um responsável por criar os seres que habitariam os três continentes.
                    </p>
                    
                    <p>
                        <strong class="text-sky-400 font-cinzel tracking-wider">Legina</strong>, o Leviatã Monstruoso, deu origem a seres imponentes e aterrorizantes. Seu continente é banhado por dois oceanos: o do Kraken e o Lendário. Ele possui um temperamento hostil, cruel e de sangue frio. Sua arma símbolo é um arco e flechas. Os habitantes de seu continente reverenciam Legina com temor e respeito, acreditando que sua crueldade é uma prova de força necessária para sobreviver em um ambiente tão implacável.
                    </p>
                    
                    <p>
                        <strong class="text-emerald-400 font-cinzel tracking-wider">Renstenci</strong>, o Leviatã do Planeta, é abençoado com beleza e graça. Seu continente é um paraíso de criaturas mágicas, fadas e uma diversidade infinita de plantas e seres vegetais, sempre em constante criação. Este continente é banhado pelos oceanos Gélido e Lendário, e está próximo às Ilhas da Morte. Sua arma símbolo é uma marreta de duas mãos. Os habitantes de Renstenci vivem em harmonia com a natureza, vendo o Leviatã como um guardião benevolente que lhes concede a beleza e a magia do mundo ao seu redor.
                    </p>
                    
                    <p>
                        <strong class="text-amber-500 font-cinzel tracking-wider">Imperiall</strong>, o Leviatã da Ganância, governa um vasto continente habitado por seres medíocres cujo único propósito é acumular mais e mais. Este continente é banhado pelos oceanos Gélido, Lendário e Kraken. As criaturas de Imperiall são, em sua maioria, humanóides e similares. Sua arma símbolo é uma espada de duas mãos. Os habitantes de Imperiall são frequentemente consumidos pela ambição e pela busca incessante por riqueza e poder, refletindo a própria natureza gananciosa de seu criador. Eles veem Imperiall como um exemplo a ser seguido, acreditando que a acumulação de riquezas é a chave para a verdadeira grandeza.
                    </p>
                    
                    <div class="w-full max-w-2xl h-px bg-slate-700 mx-auto my-10"></div>
                    
                    <p>
                        No entanto, a paz e a ordem estabelecidas pelos Leviatãs foram ameaçadas quando quatro grandes dragões foram controlados por quatro seres malignos contra sua vontade. Esses dragões, outrora guardiões do equilíbrio, tornaram-se instrumentos de destruição e caos. Para restaurar a harmonia, três defensores lendários, conhecidos como <strong>Templários</strong>, surgiram. Eles eram guerreiros de grande poder e sabedoria, escolhidos pela própria Deusa Gallandra para enfrentar essa ameaça.
                    </p>
                    
                    <p>
                        Os Templários enfrentaram os controladores dos dragões em batalhas épicas que sacudiram os próprios alicerces do mundo. Após uma série de confrontos intensos, os Templários conseguiram derrotar os seres malignos e libertar os dragões de seu controle. Para garantir que essa ameaça nunca mais retornasse, os Templários selaram os dragões em grandes prisões mágicas, espalhadas pelos três continentes. Essas prisões são guardadas por poderosos encantamentos e protegidas por guardiões escolhidos a dedo, garantindo que os dragões permaneçam adormecidos e que o equilíbrio do mundo seja mantido.
                    </p>
                </div>
            </div>

            <div class="w-full">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
                    <h2 class="text-2xl font-cinzel font-bold text-slate-200 tracking-widest"><i class="fas fa-map-marked-alt text-amber-500 mr-3"></i> Cartografia Conhecida</h2>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                    ${mapasHTML}
                </div>
            </div>

            <div class="w-full mt-16">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
                    <h2 class="text-2xl font-cinzel font-bold text-slate-200 tracking-widest"><i class="fas fa-guitar text-amber-500 mr-3"></i> Canções dos Bardos</h2>
                </div>

                <div class="relative w-full rounded-2xl overflow-hidden shadow-2xl min-h-[530px] flex items-center justify-center bg-[url('imagens/usoGeralSite/bardo-conheca-o-mundo.png')] bg-cover bg-center">
                    
                    <div class="absolute inset-0 bg-slate-950/50 z-0"></div>

                    <div class="relative z-10 w-full bg-slate-900/90 border-t-2 border-b-2 border-amber-500/50 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md py-8 flex flex-col items-center">
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-6xl px-6 mb-6">
                            ${bardosHTML}
                        </div>

                        <div id="bardo-player-container" class="opacity-50 pointer-events-none transition-opacity duration-300 w-full max-w-3xl px-6">
                            <audio id="bardo-audio-engine"></audio>
                            <div class="bg-slate-950 border border-slate-700 rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-inner">
                                
                                <div class="flex items-center gap-3 w-full sm:w-auto flex-grow">
                                    <div class="relative flex h-3 w-3 shrink-0">
                                      <span id="bardo-pulse" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-0"></span>
                                      <span class="relative inline-flex rounded-full h-3 w-3 bg-slate-600" id="bardo-dot"></span>
                                    </div>
                                    <span id="bardo-now-playing" class="text-amber-500 font-cinzel text-sm font-bold truncate max-w-[200px] md:max-w-[300px]">Aguardando seleção...</span>
                                </div>

                                <div class="flex items-center gap-6 shrink-0 ml-auto w-full sm:w-auto justify-end border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6">
                                    <button onclick="window.conhecaMundo.togglePlay()" class="text-white hover:text-amber-400 text-xl transition-transform hover:scale-110 outline-none w-8 text-center" id="bardo-btn-play">
                                        <i class="fas fa-play"></i>
                                    </button>
                                    
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-volume-up text-slate-500 text-xs"></i>
                                        <input type="range" id="bardo-volume" min="0" max="1" step="0.05" value="0.5" oninput="window.conhecaMundo.mudarVolume(this.value)" class="w-20 md:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>

        <div id="modal-mapa-mundo" class="fixed inset-0 z-[100] bg-black/95 hidden items-center justify-center p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
            <img id="img-modal-mapa" src="" class="max-w-[95vw] max-h-[95vh] object-contain rounded border border-slate-700 shadow-2xl">
        </div>
    `;
}

// Controla interações globais da aba Conheça o Mundo
window.conhecaMundo = {
    openMapa: function(url) {
        const modal = document.getElementById('modal-mapa-mundo');
        const img = document.getElementById('img-modal-mapa');
        if (modal && img) {
            img.src = url;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    // Funções do Mini Player dos Bardos
    carregarAudio: function(src, titulo) {
        const audio = document.getElementById('bardo-audio-engine');
        const tituloEl = document.getElementById('bardo-now-playing');
        const container = document.getElementById('bardo-player-container');
        const btnPlay = document.getElementById('bardo-btn-play');
        const pulse = document.getElementById('bardo-pulse');
        const dot = document.getElementById('bardo-dot');

        if (!audio || !src || src === '#') {
            console.error("Link de áudio inválido.");
            return;
        }

        // Ativa o container do player visualmente
        container.classList.remove('opacity-50', 'pointer-events-none');
        
        // Atualiza UI com o nome da música e o source do áudio
        tituloEl.textContent = titulo;
        audio.src = src;
        audio.play();

        // Altera botão para Pause e liga o "led" verde
        btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        pulse.classList.remove('opacity-0');
        dot.classList.replace('bg-slate-600', 'bg-amber-500');

        // Evento caso a música termine sozinha
        audio.onended = () => {
            btnPlay.innerHTML = '<i class="fas fa-play"></i>';
            pulse.classList.add('opacity-0');
            dot.classList.replace('bg-amber-500', 'bg-slate-600');
        };
    },

    togglePlay: function() {
        const audio = document.getElementById('bardo-audio-engine');
        const btnPlay = document.getElementById('bardo-btn-play');
        const pulse = document.getElementById('bardo-pulse');
        const dot = document.getElementById('bardo-dot');

        if (!audio || !audio.src) return;

        if (audio.paused) {
            audio.play();
            btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
            pulse.classList.remove('opacity-0');
            dot.classList.replace('bg-slate-600', 'bg-amber-500');
        } else {
            audio.pause();
            btnPlay.innerHTML = '<i class="fas fa-play"></i>';
            pulse.classList.add('opacity-0');
            dot.classList.replace('bg-amber-500', 'bg-slate-600');
        }
    },

    mudarVolume: function(valor) {
        const audio = document.getElementById('bardo-audio-engine');
        if (audio) {
            audio.volume = valor;
        }
    }
};
