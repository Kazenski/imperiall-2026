import { db } from '../core/firebase.js';
import { collection, getDocs, writeBatch, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

export async function renderFirebaseMudaAllTab() {
    const container = document.getElementById('firebase-muda-all-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col items-center p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-red-900/50 pb-8 w-full max-w-4xl flex flex-col items-center gap-4">
                <div class="p-4 bg-red-900/20 rounded-full border-2 border-red-500/50 text-red-500 text-4xl shadow-[0_0_20px_rgba(239,68,68,0.3)] mb-2 animate-pulse">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-red-500 tracking-widest drop-shadow-md">Injeção em Massa (DB)</h1>
                <p class="text-slate-400 mt-2 text-sm italic font-bold">Ferramenta restrita de desenvolvedor. Adiciona um campo inexistente a TODOS os documentos de uma coleção.</p>
            </header>

            <main class="w-full max-w-4xl bg-slate-800/80 p-8 rounded-2xl border border-red-500/30 shadow-2xl flex flex-col gap-6">
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nome da Coleção Alvo</label>
                        <input type="text" id="fm-collection" value="rpg_fichas" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-amber-400 font-mono font-bold outline-none focus:border-red-500 transition-colors" placeholder="Ex: rpg_fichas">
                    </div>

                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nome do Novo Campo</label>
                        <input type="text" id="fm-field" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-sky-400 font-mono font-bold outline-none focus:border-red-500 transition-colors" placeholder="Ex: bonusHpItemEquipado">
                    </div>
                </div>

                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Valor Padrão (Detecta true, false e números)</label>
                    <input type="text" id="fm-value" value="0" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white font-mono outline-none focus:border-red-500 transition-colors" placeholder="Ex: 0, true, falso, ou 'texto'">
                </div>

                <button id="btn-run-batch" onclick="window.firebaseTools.runBatchUpdate()" class="w-full py-4 mt-4 bg-red-700 hover:bg-red-600 text-white font-black text-xl tracking-widest rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] uppercase transition-transform hover:scale-[1.01] flex items-center justify-center border border-red-500">
                    <i class="fas fa-biohazard mr-3"></i> Executar Injeção Global
                </button>
            </main>

            <div class="w-full max-w-4xl mt-8">
                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Terminal de Log</h3>
                <div id="fm-log" class="w-full h-64 bg-black/80 rounded-xl border border-slate-700 p-4 font-mono text-[11px] text-green-400 overflow-y-auto custom-scroll leading-relaxed shadow-inner">
                    > Conectado ao banco de dados Imperiall.<br>> Aguardando comandos...
                </div>
            </div>
        </div>
    `;
}

// Lógica Parse original
function parseValue(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!isNaN(parseFloat(value)) && isFinite(value)) return Number(value);
    return value;
}

function writeLog(message, isError = false) {
    const logBox = document.getElementById('fm-log');
    if (!logBox) return;
    
    const time = new Date().toLocaleTimeString();
    let formattedMessage = `\n<span class="text-slate-500">[${time}]</span> `;
    
    if (isError) formattedMessage += `<span class="text-red-500 font-bold">${message}</span>`;
    else if (message.includes('SUCESSO')) formattedMessage += `<span class="text-amber-400 font-bold">${message}</span>`;
    else formattedMessage += `<span class="text-sky-300">${message}</span>`;
    
    logBox.innerHTML += formattedMessage;
    logBox.scrollTop = logBox.scrollHeight;
}

window.firebaseTools = {
    runBatchUpdate: async function() {
        const btn = document.getElementById('btn-run-batch');
        const collectionName = document.getElementById('fm-collection').value.trim();
        const fieldName = document.getElementById('fm-field').value.trim();
        const rawValue = document.getElementById('fm-value').value.trim();

        if (!collectionName || !fieldName) {
            return alert("Atenção: Nome da Coleção e do Campo são obrigatórios.");
        }

        const confirmation = confirm(`ATENÇÃO DE SEGURANÇA MÁXIMA!\n\nVocê vai adicionar o campo:\n"${fieldName}" = [${rawValue}]\n\nEm TODOS os documentos de "${collectionName}" que ainda NÃO o possuem.\n\nDeseja prosseguir?`);
        
        if (!confirmation) {
            writeLog("Operação Abortada pelo Usuário.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> Processando Injeção...';
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        writeLog(`Iniciando varredura na coleção: ${collectionName}...`);
        const parsedValue = parseValue(rawValue);

        try {
            const docsRef = collection(db, collectionName);
            const querySnapshot = await getDocs(query(docsRef));
            const totalDocs = querySnapshot.size;
            
            writeLog(`> ${totalDocs} documentos encontrados na coleção.`);

            if (totalDocs === 0) {
                writeLog("Nenhum documento encontrado. Fim da operação.");
                alert("Coleção vazia ou não encontrada.");
                throw new Error("Empty Collection");
            }

            // O Batch do Firebase suporta até 500 operações. Como pode haver coleções maiores, vamos "partir" o batch.
            let batch = writeBatch(db);
            let atualizacoes = 0;
            let opsCounter = 0;

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data[fieldName] === undefined) {
                    batch.update(docSnap.ref, { [fieldName]: parsedValue });
                    atualizacoes++;
                    opsCounter++;

                    // Se atingiu o limite de 500 do Firebase, commita e abre outro batch
                    if (opsCounter === 450) {
                        batch.commit();
                        writeLog(`>>> Commitando bloco de 450 updates...`);
                        batch = writeBatch(db);
                        opsCounter = 0;
                    }
                }
            });

            if (atualizacoes > 0) {
                if (opsCounter > 0) await batch.commit(); // Commita o que sobrou
                writeLog(`=================================`);
                writeLog(`SUCESSO: ${atualizacoes} de ${totalDocs} documentos foram injetados com [${fieldName}]!`);
                writeLog(`=================================`);
                alert(`Injeção global finalizada! ${atualizacoes} docs alterados.`);
            } else {
                writeLog("Aviso: Nenhum documento precisava de atualização. Todos já possuem esse campo.");
                alert("Nenhuma modificação foi feita. Todos os documentos já possuem este campo.");
            }

        } catch (error) {
            writeLog(`ERRO FATAL: ${error.message}`, true);
            console.error(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-biohazard mr-3"></i> Executar Injeção Global';
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};