export async function renderMapaMundialTab() {
    // Busca a div correspondente a aba no seu index.html
    const container = document.getElementById('mapa-mundial-content');
    
    if (!container) {
        console.error("Erro: div mapa-mundial-content não encontrada no HTML.");
        return;
    }

    // Se o iframe já foi injetado antes, não recarrega para não perder o estado do mapa
    if (container.innerHTML.includes('iframe')) return;

    // Injeta o código antigo de forma limpa, ocupando 100% do espaço da aba
    container.innerHTML = `
        <div style="width: 100%; height: 100%; min-height: calc(100vh - 60px);">
            <iframe 
                src="./mapa-original.html" 
                style="width: 100%; height: 100%; border: none;"
                title="Mapa Mundial Embutido"
            ></iframe>
        </div>
    `;
}