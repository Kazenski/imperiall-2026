import { db } from '../core/firebase.js';
import { collection, getDocs, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

export async function renderFirebaseMudaIfTab() {
    const container = document.getElementById('firebase-muda-if-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col items-center p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-orange-900/50 pb-8 w-full max-w-4xl flex flex-col items-center gap-4">
                <div class="p-4 bg-orange-900/20 rounded-full border-2 border-orange-500/50 text-orange-500 text-4xl shadow-[0_0_20px_rgba(249,115,22,0.3)] mb-2 animate-pulse">
                    <i class="fas fa-filter"></i>
                </div>
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-orange-500 tracking-widest drop-shadow-md">Atualizador Condicional (DB)</h1>
                <p class="text-slate-400 mt-2 text-sm italic font-bold">Ferramenta restrita de desenvolvedor. Atualiza ou cria um campo em lote, mas apenas onde uma condição (WHERE) for satisfeita.</p>
            </header>

            <main class="w-full max-w-4xl bg-slate-800/80 p-8 rounded-2xl border border-orange-500/30 shadow-2xl flex flex-col gap-6">
                
                <section class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                    <h3 class="text-lg font-bold text-orange-400 mb-4 border-b border-slate-700 pb-2"><i class="fas fa-bullseye mr-2"></i> 1. Coleção Alvo</h3>
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nome da Coleção</label>
                    <input type="text" id="fi-collection" value="rpg_habilidades" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white font-mono font-bold outline-none focus:border-orange-500 transition-colors" placeholder="Ex: rpg_habilidades">
                </section>

                <section class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                    <div class="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
                        <h3 class="text-lg font-bold text-sky-400"><i class="fas fa-search mr-2"></i> 2. Condição (Filtro WHERE)</h3>
                        <span class="text-[10px] text-slate-500 uppercase font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">Opcional</span>
                    </div>
                    <p class="text-xs text-slate-400 mb-4">A atualização só será aplicada em documentos que atenderem a esta condição. Se deixar vazio, aplica a TODOS (igual à ferramenta anterior).</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Campo de Busca</label>
                            <input type="text" id="fi-cond-field" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-sky-300 font-mono outline-none focus:border-sky-500 transition-colors" placeholder="Ex: nivelHabilidadeStatus">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Valor Exato da Busca</label>
                            <input type="text" id="fi-cond-value" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white font-mono outline-none focus:border-sky-500 transition-colors" placeholder="Ex: AVANCADA">
                        </div>
                    </div>
                </section>

                <section class="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                    <h3 class="text-lg font-bold text-emerald-400 mb-4 border-b border-slate-700 pb-2"><i class="fas fa-edit mr-2"></i> 3. Ação de Modificação</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Campo a Ser Escrito/Atualizado</label>
                            <input type="text" id="fi-update-field" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-emerald-300 font-mono outline-none focus:border-emerald-500 transition-colors" placeholder="Ex: gastoMpUso">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Novo Valor (Lê true/false/num)</label>
                            <input type="text" id="fi-update-value" value="10" class="w-full bg-slate-950 border border-slate-600 p-3 rounded-lg text-white font-mono outline-none focus:border-emerald-500 transition-colors" placeholder="Ex: 10, true, falso, ou 'texto'">
                        </div>
                    </div>
                </section>

                <button id="btn-run-cond-batch" onclick="window.firebaseCondTools.runMassUpdate()" class="w-full py-4 mt-2 bg-orange-700 hover:bg-orange-600 text-white font-black text-xl tracking-widest rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] uppercase transition-transform hover:scale-[1.01] flex items-center justify-center border border-orange-500">
                    <i class="fas fa-database mr-3"></i> Executar Mutação Condicional
                </button>
            </main>

            <div class="w-full max-w-4xl mt-8">
                <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Terminal de Log Operacional</h3>
                <div id="fi-log" class="w-full h-64 bg-black/90 rounded-xl border border-slate-700 p-4 font-mono text-[11px] text-green-400 overflow-y-auto custom-scroll leading-relaxed shadow-inner">
                    > Conectado ao Firebase.<br>> Sistema Condicional Pronto...
                </div>
            </div>
        </div>
    `;
}

// Lógica Parse
function parseValue(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!isNaN(parseFloat(value)) && isFinite(value)) return Number(value);
    return value;
}

function writeLog(message, isError = false) {
    const logBox = document.getElementById('fi-log');
    if (!logBox) return;
    
    const time = new Date().toLocaleTimeString();
    let formattedMessage = `\n<span class="text-slate-500">[${time}]</span> `;
    
    if (isError) formattedMessage += `<span class="text-red-500 font-bold">${message}</span>`;
    else if (message.includes('SUCESSO')) formattedMessage += `<span class="text-amber-400 font-bold">${message}</span>`;
    else formattedMessage += `<span class="text-sky-300">${message}</span>`;
    
    logBox.innerHTML += formattedMessage;
    logBox.scrollTop = logBox.scrollHeight;
}

window.firebaseCondTools = {
    runMassUpdate: async function() {
        const btn = document.getElementById('btn-run-cond-batch');
        const collectionName = document.getElementById('fi-collection').value.trim();
        const conditionField = document.getElementById('fi-cond-field').value.trim();
        const conditionValue = document.getElementById('fi-cond-value').value.trim();
        const updateField = document.getElementById('fi-update-field').value.trim();
        const updateValue = document.getElementById('fi-update-value').value.trim();

        if (!collectionName || !updateField) {
            return alert("Atenção: Os campos 'Nome da Coleção' e 'Campo a Atualizar' são obrigatórios.");
        }

        let confirmationMessage = `ATENÇÃO DE SEGURANÇA!\n\nColeção: '${collectionName}'\n`;
        if (conditionField) {
            confirmationMessage += `CONDIÇÃO: Apenas onde '${conditionField}' for exatmente igual a '${conditionValue}'.\n`;
        } else {
            confirmationMessage += `CONDIÇÃO: Nenhuma (Aplicará a TODOS os documentos).\n`;
        }
        confirmationMessage += `AÇÃO: Definir/Criar o campo '${updateField}' com o valor: [${updateValue}].\n\nDeseja prosseguir?`;
        
        if (!confirm(confirmationMessage)) {
            writeLog("Operação Abortada pelo Usuário.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> Processando Filtros...';
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        writeLog(`Iniciando atualização seletiva em: ${collectionName}...`);
        
        try {
            const docsRef = collection(db, collectionName);
            let q;

            if (conditionField) {
                writeLog(`> Aplicando Filtro WHERE: '${conditionField}' == '${conditionValue}'`);
                q = query(docsRef, where(conditionField, "==", parseValue(conditionValue)));
            } else {
                writeLog("> Sem filtro aplicado. Afetará toda a coleção.");
                q = query(docsRef);
            }

            const querySnapshot = await getDocs(q);
            writeLog(`> ${querySnapshot.size} documentos passaram no filtro da condição.`);
            
            if (querySnapshot.empty) {
                writeLog("Nenhum documento encontrado que corresponda ao filtro. Abortando.");
                alert("Nenhum documento encontrado na coleção com essa condição.");
            } else {
                let batch = writeBatch(db);
                const parsedUpdateValue = parseValue(updateValue);
                let atualizacoes = 0;
                let opsCounter = 0;

                querySnapshot.forEach(docSnap => {
                    batch.update(docSnap.ref, { [updateField]: parsedUpdateValue });
                    atualizacoes++;
                    opsCounter++;

                    // Limitador de Batch (Firebase aceita max 500 ops por batch)
                    if (opsCounter === 450) {
                        batch.commit();
                        writeLog(`>>> Transmitindo lote de 450 modificações...`);
                        batch = writeBatch(db);
                        opsCounter = 0;
                    }
                });

                if (atualizacoes > 0) {
                    if (opsCounter > 0) await batch.commit(); // Salva o que restou
                    const logMsg = `=================================\nSUCESSO TOTAL: ${querySnapshot.size} documentos foram mutados!\n=================================`;
                    writeLog(logMsg);
                    alert(`Operação Completa! ${querySnapshot.size} documentos atualizados com sucesso.`);
                }
            }
        } catch (error) {
            writeLog(`ERRO FATAL: ${error.message}. (O Firebase exige que o nome do campo da coleção esteja exato. Verifique também índices do Firestore se aplicável).`, true);
            console.error(error);
            alert(`Falha Crítica:\n${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-database mr-3"></i> Executar Mutação Condicional';
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};