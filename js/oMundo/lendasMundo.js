// Estrutura de dados das Lendas para facilitar a manutenção e renderização dinâmica
const lendasDoMundo = [
    {
        titulo: "A Praga de Finbetur",
        icone: "fa-biohazard",
        cor: "text-emerald-500",
        texto: `Há muito tempo, o Deus da Morte, outrora um guardião benevolente das almas, foi consumido pela dor e pela raiva após sua filha ser violada por um homem sem escrúpulos. Em sua busca por vingança, ele lançou uma terrível maldição sobre o mundo dos homens.

A praga, conhecida como a Praga de Finbetur, afeta exclusivamente os homens. Dizem as lendas que esta maldição matou metade do continente norte, espalhando-se como fogo selvagem. Os sintomas são devastadores: cegueira temporária, alucinações aterrorizantes e uma forma horrível de lepra que desfigura o corpo. No auge do caos, um cientista insano, obcecado pelo poder da praga, conseguiu capturá-la em um encanto mágico. Ele guardou essa arma mortal, esperando o momento certo para usá-la em seus próprios planos nefastos.

As histórias contam que a sociedade foi abalada até suas fundações. Aldeias inteiras foram dizimadas, e os sobreviventes viviam em constante medo. Alguns se uniram em busca de uma cura, enquanto outros tentaram resistir à praga com magia e ciência. Agora, heróis e vilões emergem, cada um com suas próprias motivações e segredos, em um mundo onde a sombra da Praga de Finbetur ainda paira ameaçadoramente.`,
        boatos: []
    },
    {
        titulo: "O Portal de Androa",
        icone: "fa-dungeon",
        cor: "text-purple-400",
        texto: `O Portal de Androa é uma passagem lendária que, segundo dizem, leva a um outro mundo. Muitos acreditam que nesse mundo existem seis gemas milenares únicas: roxa, verde, laranja, azul, vermelha e amarela. Cada uma dessas gemas é dita possuir poderes inimagináveis, capazes de alterar o curso da história. No entanto, até hoje, nada foi comprovado sobre a existência dessas gemas, e elas permanecem envoltas em mistério e especulação.

A Primeira Grande Guerra Astral foi um conflito épico entre os continentes, que durou cem anos. Durante esse período, mais de 60% das terras foram devastadas, transformando paisagens outrora férteis em desertos estéreis. Mais de 50% da população mundial foi dizimada, resultando em um sofrimento incalculável e na queda de grandes civilizações. Reza a lenda que a guerra foi interrompida pela deusa Androa, uma figura mítica de poder incomensurável, mas isso permanece um mistério… ou talvez não.

Para encerrar a guerra, Androa teria selado a sede de poder em três artefatos: um arco, um cajado e uma espada. Esses artefatos não eram apenas armas, mas símbolos de poder e destruição. As lendas dizem que ela escondeu esses itens em locais tão inacessíveis que nem os seres mais tolos ou corajosos seriam capazes de encontrá-los. Alguns acreditam que esses locais são protegidos por guardiões ancestrais ou por armadilhas mágicas que desafiam a própria lógica.

Além disso, acredita-se que essas armas carregam maldições terríveis, mortais e insaciáveis. Aqueles que ousam procurá-las são consumidos por uma sede de poder que nunca pode ser saciada, levando-os à loucura ou à morte. As histórias falam de aventureiros que tentaram encontrar os artefatos e nunca mais foram vistos, ou que retornaram como sombras do que eram, assombrados pelos horrores que enfrentaram.

Essas lendas continuam a fascinar e aterrorizar gerações, servindo como um lembrete sombrio do preço do poder e da fragilidade da paz. O Portal de Androa e os artefatos selados pela deusa permanecem como enigmas, esperando para serem descobertos por aqueles corajosos ou tolos o suficiente para buscar a verdade.`,
        boatos: []
    },
    {
        titulo: "Campeonato de Tributo a Balun",
        icone: "fa-trophy",
        cor: "text-amber-400",
        texto: `No vasto e misterioso continente norte, ocorre anualmente o renomado Grande Torneio de Melee. Este campeonato misto reúne milhares de criaturas, tanto mágicas quanto não mágicas, todas em busca de um único objetivo: encontrar o ser supremo que será digno de proteger os itens sagrados de Androa.

As lendas sussurram que os vencedores anteriores do torneio nunca mais foram vistos, desaparecendo misteriosamente após sua vitória. Alguns dizem que foram levados para um reino secreto para cumprir seu dever sagrado, enquanto outros acreditam que foram consumidos pelo poder dos itens que juraram proteger.

O torneio é um espetáculo grandioso, atraindo espectadores de todos os cantos do mundo. As arenas são adornadas com bandeiras coloridas e símbolos antigos, e o ar é preenchido com a excitação e a tensão dos combates iminentes. Guerreiros de todas as raças e habilidades se enfrentam em batalhas épicas, demonstrando força, habilidade e coragem. A participação no torneio é totalmente gratuita, permitindo que qualquer um, desde o mais humilde camponês até o mais poderoso mago, tenha a chance de provar seu valor. No entanto, poucos são os que conseguem sobreviver às rigorosas provas e desafios que o torneio impõe.

Os combates são ferozes e implacáveis, testando não apenas a força física, mas também a astúcia e a determinação dos competidores. Cada batalha é uma dança mortal, onde um único erro pode significar a derrota ou até mesmo a morte. No final, apenas um será coroado campeão, recebendo a honra e a responsabilidade de proteger os itens sagrados de Androa. Este ser será lembrado nas canções e histórias, seu nome gravado na história como o guardião dos artefatos mais poderosos e perigosos do mundo.`,
        boatos: []
    },
    {
        titulo: "O Dragão de Cristal",
        icone: "fa-dragon",
        cor: "text-sky-300",
        texto: `Nas montanhas geladas de Renstenci, há muito tempo, um dragão de cristal reinava supremo. Suas escamas, feitas de cristal puro, refletiam a luz do sol, criando um arco-íris permanente no céu. Esse dragão possuía o poder de controlar o tempo, podendo acelerar ou desacelerar os eventos ao seu redor. Muitos aventureiros, atraídos pela promessa de dominar o tempo, tentaram capturá-lo. No entanto, o dragão era astuto e poderoso, e todos os que tentaram falharam. A lenda diz que o dragão ainda vive nas profundezas das montanhas, esperando por um herói digno de seu segredo, alguém que usaria o poder para o bem e não para a ganância.`,
        boatos: [
            {
                titulo: "A Canção do Dragão de Cristal",
                texto: "Um bardo famoso, conhecido por suas baladas encantadoras, recentemente compôs uma nova canção sobre o Dragão de Cristal de Renstenci. A canção fala de um aventureiro que, ao seguir um arco-íris nas montanhas geladas, encontrou o dragão adormecido em uma caverna de cristal. Dizem que o bardo ouviu essa história de um velho eremita que vive nas montanhas e que o dragão está prestes a despertar novamente. A canção se espalhou rapidamente pelas tavernas, e agora muitos aventureiros estão se preparando para buscar o dragão, seu poder e suas escamas mágicas."
            }
        ]
    },
    {
        titulo: "Os Espíritos da Floresta",
        icone: "fa-leaf",
        cor: "text-emerald-400",
        texto: `As florestas densas de Restenci são lar de espíritos antigos que protegem a natureza. Esses espíritos, conhecidos como Guardiões da Floresta, aparecem como luzes flutuantes e são vistos apenas por aqueles que têm um coração puro. Eles guiam os perdidos de volta ao caminho certo e punem severamente aqueles que desrespeitam a floresta. Uma história popular conta sobre um lenhador que tentou derrubar uma árvore sagrada. Os espíritos, enfurecidos, transformaram-no em uma árvore, condenando-o a proteger a floresta para sempre. Desde então, os habitantes locais respeitam profundamente a floresta e seus guardiões.`,
        boatos: [
            {
                titulo: "O Sussurro dos Espíritos da Floresta",
                texto: "Nas tavernas de Restenci, um bardo itinerante conta histórias sobre os Espíritos da Floresta. Ele canta sobre um jovem caçador que, perdido na floresta, foi guiado por luzes flutuantes até um lugar seguro. O caçador jurou que os espíritos lhe sussurraram segredos sobre um tesouro escondido nas profundezas da floresta, protegido por uma árvore que antes era um homem. Agora, muitos acreditam que os espíritos estão mais ativos do que nunca, e que aqueles que respeitam a floresta podem ser recompensados com riquezas inimagináveis."
            }
        ]
    },
    {
        titulo: "A Serpente do Mar",
        icone: "fa-water",
        cor: "text-blue-500",
        texto: `Nas profundezas dos oceanos de Avalinn, uma serpente marinha gigantesca aterroriza os marinheiros. Conhecida como a Guardiã dos Abismos, essa criatura é responsável por afundar navios e devorar marinheiros incautos. A lenda diz que a serpente guarda um tesouro imenso no fundo do mar, acumulado ao longo de séculos de naufrágios. Apenas os mais corajosos se atrevem a navegar nessas águas traiçoeiras, na esperança de encontrar o tesouro e sobreviver para contar a história. Alguns dizem que a serpente é uma guardiã, protegendo o tesouro de cair em mãos erradas.`,
        boatos: [
            {
                titulo: "A Balada da Serpente do Mar",
                texto: "Um grupo de marinheiros, após uma noite de bebedeira, começou a cantar uma antiga balada sobre a Serpente do Mar de Avalinn. A balada fala de um capitão corajoso que, com a ajuda de uma sereia, conseguiu enganar a serpente e recuperar parte do tesouro escondido no fundo do mar. Os marinheiros juram que a balada é baseada em uma história real e que o capitão ainda vive, escondido em uma ilha remota, guardando seu tesouro. Esse boato tem atraído muitos aventureiros e piratas para as águas de Avalinn, todos em busca do lendário tesouro."
            }
        ]
    },
    {
        titulo: "O Guardião das Cavernas",
        icone: "fa-gem",
        cor: "text-stone-400",
        texto: `Nas cavernas escuras de Imperiall, um guardião de pedra protege um artefato antigo de imenso poder. Esse guardião, uma criatura feita de rocha viva, desperta apenas quando alguém se aproxima do artefato. A lenda diz que o artefato concede sabedoria infinita, mas apenas àqueles que conseguem resolver o enigma do guardião. Muitos tentaram e falharam, pois o enigma é complexo e exige não apenas inteligência, mas também um coração puro. Aqueles que falham são transformados em estátuas de pedra, eternamente guardando o artefato ao lado do guardião original.`,
        boatos: [
            {
                titulo: "A Canção do Guardião das Cavernas",
                texto: "Um bardo errante, conhecido por suas histórias misteriosas, começou a cantar uma nova balada sobre o Guardião das Cavernas de Imperiall. A canção narra a história de um jovem aventureiro que, ao explorar as cavernas escuras, encontrou o guardião de pedra e tentou resolver seu enigma. Segundo a balada, o aventureiro conseguiu decifrar parte do enigma, mas desapareceu misteriosamente antes de revelar a solução completa. Agora, muitos acreditam que o guardião está mais vigilante do que nunca, e que o artefato de sabedoria infinita está ao alcance daqueles que ousarem tentar."
            },
            {
                titulo: "A grande festa do Tesouro das Cavernas",
                texto: "Um grupo de bardos, após uma noite de celebração, começou a cantar uma balada sobre um tesouro escondido nas cavernas de Imperiall. A balada fala de um antigo rei que, temendo uma invasão, escondeu seu tesouro nas profundezas das cavernas, protegendo-o com o Guardião de Pedra. Dizem que o tesouro contém riquezas inimagináveis e um mapa para um reino perdido. Os bardos afirmam que a balada é baseada em um manuscrito antigo encontrado em uma biblioteca esquecida. Esse boato tem atraído muitos aventureiros para as cavernas, todos em busca do lendário tesouro."
            }
        ]
    },
    {
        titulo: "As Fadas do Vento",
        icone: "fa-wind",
        cor: "text-teal-300",
        texto: `Nas colinas ventosas de Restenci, vivem fadas que controlam os ventos. Essas fadas são pequenas e luminosas, e são conhecidas por ajudar viajantes em necessidade, guiando-os com ventos favoráveis. No entanto, elas também são travessas e gostam de pregar peças em quem se aventura em suas terras sem permissão. Uma história famosa conta sobre um viajante que, ao respeitar as fadas e oferecer-lhes presentes, foi guiado por um vento favorável até seu destino, evitando perigos e encontrando um caminho seguro. Desde então, os viajantes sempre deixam pequenas oferendas nas colinas, na esperança de ganhar o favor das fadas do vento.`,
        boatos: [
            {
                titulo: "O Sussurro das Fadas do Vento",
                texto: "Nas tavernas de Restenci, um bardo popular canta sobre as Fadas do Vento. Ele conta a história de um mercador que, ao atravessar as colinas ventosas, foi ajudado por essas fadas após oferecer-lhes presentes. O mercador jurou que as fadas lhe sussurraram segredos sobre um portal escondido que leva a um reino mágico. Desde então, muitos viajantes têm deixado oferendas nas colinas, na esperança de ganhar o favor das fadas e descobrir o portal. A canção do bardo se espalhou rapidamente, e agora as colinas estão repletas de pequenos presentes deixados por aqueles que buscam a ajuda das fadas."
            }
        ]
    },
    {
        titulo: "Os Dragões Selados",
        icone: "fa-dungeon",
        cor: "text-red-500",
        texto: `A paz e a ordem estabelecidas pelos Leviatãs foram ameaçadas quando quatro grandes dragões foram controlados por quatro seres malignos contra sua vontade. Esses dragões, outrora guardiões do equilíbrio, tornaram-se instrumentos de destruição e caos. Para restaurar a harmonia, três defensores lendários, conhecidos como Templários, surgiram. Eles eram guerreiros de grande poder e sabedoria, escolhidos pela própria Deusa Gallandra para enfrentar essa ameaça.

Os Templários enfrentaram os controladores dos dragões em batalhas épicas que sacudiram os próprios alicerces do mundo. Após uma série de confrontos intensos, os Templários conseguiram derrotar os seres malignos e libertar os dragões de seu controle. Para garantir que essa ameaça nunca mais retornasse, os Templários selaram os dragões em grandes prisões mágicas, espalhadas pelos três continentes. Essas prisões são guardadas por poderosos encantamentos e protegidas por guardiões escolhidos a dedo, garantindo que os dragões permaneçam adormecidos e que o equilíbrio do mundo seja mantido.`,
        boatos: [
            {
                titulo: "O Dragão da Montanha Esquecida",
                texto: "\"Ah, meus caros, deixem-me contar-lhes sobre o Dragão da Montanha Esquecida. Dizem que um dos quatro grandes dragões, conhecido como Thaldrin, foi selado em uma prisão mágica nas profundezas de uma montanha que ninguém mais se lembra. Os antigos dizem que a montanha se moveu para esconder o dragão, e que apenas os mais corajosos e tolos ousam procurar por ela. Alguns afirmam que, em noites de lua cheia, é possível ouvir os rugidos de Thaldrin ecoando pelas cavernas, um lembrete de que ele ainda está lá, esperando o dia em que será libertado.\""
            },
            {
                titulo: "O Guardião da Ilha Perdida",
                texto: "\"Ouçam bem, viajantes! Há quem diga que um dos dragões, chamado Seraphis, foi aprisionado em uma ilha que desapareceu dos mapas. A Ilha Perdida, como é conhecida, é cercada por tempestades eternas e mares traiçoeiros. Os marinheiros contam que, se você navegar perto demais, verá relâmpagos verdes e ouvirá o som de asas batendo. Dizem que Seraphis ainda guarda a ilha, e que aqueles que tentam se aproximar são engolidos pelas ondas ou queimados pelo fogo do dragão. Mas, ah, se alguém conseguir chegar lá, encontrará riquezas além da imaginação!\""
            },
            {
                titulo: "O Segredo dos Templários",
                texto: "\"Ah, meus amigos, este é um segredo que poucos conhecem. Dizem que os Templários, aqueles lendários defensores que selaram os dragões, não fizeram isso sozinhos. Há rumores de que eles receberam ajuda de uma antiga ordem de magos, os Guardiões das Chamas Eternas. Esses magos, dizem, sacrificaram suas próprias vidas para criar as prisões mágicas que mantêm os dragões adormecidos. E há quem acredite que, se alguém encontrar os túmulos desses magos e desvendar seus segredos, poderá controlar os dragões e usar seu poder para dominar o mundo. Mas cuidado, pois mexer com tais forças pode trazer consequências terríveis!\""
            }
        ]
    }
];

export function renderLendasMundoTab() {
    const container = document.getElementById('lendas-mundo-content');
    if (!container) return;

    // Gera o HTML das Lendas dinamicamente
    let lendasHTML = lendasDoMundo.map((lenda, index) => {
        
        // Formata os parágrafos do texto principal
        const paragrafos = lenda.texto.split('\n\n').map(p => `<p class="mb-4">${p.replace(/\n/g, '<br>')}</p>`).join('');
        
        // Gera o HTML dos Boatos, se existirem
        let boatosHTML = '';
        if (lenda.boatos && lenda.boatos.length > 0) {
            boatosHTML = `
                <div class="mt-8 pt-6 border-t border-slate-700/50">
                    <h4 class="font-cinzel text-xl text-amber-500 mb-4 flex items-center gap-2">
                        <i class="fas fa-comment-dots text-slate-500"></i> Sussurros e Boatos
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${lenda.boatos.map((boato, bIndex) => `
                            <div class="bg-amber-900/10 p-5 rounded-xl border border-amber-700/30 shadow-inner relative">
                                <i class="fas fa-quote-left absolute top-4 left-4 text-amber-500/20 text-2xl"></i>
                                <h5 class="font-cinzel font-bold text-amber-300 mb-2 relative z-10">${boato.titulo}</h5>
                                <p class="text-amber-100/80 text-sm md:text-base italic leading-relaxed relative z-10">${boato.texto}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        return `
            <article class="w-full bg-slate-800/40 p-8 md:p-12 rounded-[2rem] border border-slate-700 shadow-2xl relative animate-fade-in group hover:border-slate-500 transition-colors">
                
                <div class="absolute -top-6 -left-4 md:-left-6 w-16 h-16 bg-slate-900 border-2 border-slate-700 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform z-20">
                    <i class="fas ${lenda.icone} ${lenda.cor} text-2xl drop-shadow-md"></i>
                </div>

                <div class="relative z-10">
                    <h2 class="text-3xl md:text-4xl font-black font-cinzel ${lenda.cor} mb-6 tracking-wide drop-shadow-sm border-b border-slate-700/50 pb-4 pl-4 md:pl-8">
                        ${lenda.titulo}
                    </h2>
                    
                    <div class="text-slate-300 text-base md:text-lg leading-relaxed font-serif text-justify px-2 md:px-6">
                        ${paragrafos}
                    </div>
                    
                    ${boatosHTML}
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 scroll-smooth bg-slate-950">
            
            <header class="mb-12 text-center w-full border-b border-slate-800 pb-8">
                <h1 class="text-4xl md:text-5xl lg:text-6xl font-black font-cinzel text-amber-500 drop-shadow-md tracking-widest mb-4">Lendas do Mundo</h1>
                <p class="text-slate-400 text-base md:text-lg italic w-full mx-auto font-serif">
                    "Contos passados de geração em geração, sussurrados em tavernas e temidos nas noites escuras..."
                </p>
            </header>

            <div class="w-full flex flex-col gap-16 md:gap-20">
                ${lendasHTML}
            </div>
            
            <div class="w-full text-center mt-12 pb-8">
                <p class="text-slate-600 font-cinzel text-sm tracking-widest border-t border-slate-800 pt-8 max-w-md mx-auto">Fim dos Registros Conhecidos</p>
            </div>
        </div>
    `;
}