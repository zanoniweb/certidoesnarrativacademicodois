// 1. PROTEÇÃO DE ROTA
const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";
if (!localStorage.getItem("loggedIn") && !isLoginPage) {
    window.location.href = "index.html";
}

// 2. BASE DE USUÁRIOS
const users = [
    { username: "alemaochefe", password: "alemao1234" },
    { username: "jzanoni", password: "180804" }
];

// --- AJUSTE 3: DICIONÁRIO DE LOTEAMENTOS ---
const mapeamentoLoteamentos = {
    "777": "Jd das Frutas",
    "778": "Jd Personalidades Históricas",
    "779": "Jd Clubes Esportivos"
};

function obterNomeLoteamento(inscricao) {
    // Extrai os 3 dígitos após o primeiro ponto (ex: 08.777...)
    const partes = inscricao.split('.');
    if (partes.length > 1) {
        const codigo = partes[1];
        return mapeamentoLoteamentos[codigo] || "Loteamento não identificado";
    }
    return "Não informado";
}

// 3. SISTEMA DE LOGIN E LOGOUT
function login() {
    const userInp = document.getElementById("username").value.trim();
    const passInp = document.getElementById("password").value.trim();
    const validUser = users.find(u => u.username === userInp && u.password === passInp);

    if (validUser) {
        localStorage.setItem("loggedIn", "true");
        window.location.href = "consulta.html"; 
    } else {
        alert("Usuário ou senha incorretos!");
    }
}

function logout() {
    localStorage.removeItem("loggedIn");
    window.location.href = "index.html";
}

let todosResultadosPDF = [];

// 5. BUSCA DE DADOS
async function buscarDados() {
    const campoBusca = document.getElementById('search');
    const valorDigitado = campoBusca.value.trim();
    
    if (!valorDigitado) {
        alert("Por favor, informe o número da Inscrição Municipal!");
        return;
    }

    const limpar = (txt) => txt.toString().replace(/\D/g, '');
    const buscaLimpa = limpar(valorDigitado);
    const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    let resultadosBrutos = [];
    
    const tableBody = document.querySelector('#resultTable tbody');
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="7">Localizando histórico completo...</td></tr>';

    for (let ano of anos) {
        const url = `tabelas/${ano}.xlsx`;
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            json.forEach(row => {
                const colA = row[0] ? row[0].toString().trim() : "";
                const colB = row[1] ? row[1].toString().trim() : "";

                if (limpar(colA) === buscaLimpa || limpar(colB) === buscaLimpa) {
                    resultadosBrutos.push({
                        inscricao: colA,
                        id: colB || colA,
                        logradouro: row[2] || '---',
                        numero: row[3] || '---',
                        quadra: row[4] || '---',
                        lote: row[5] || '---',
                        ano: ano,
                        metragem: parseFloat(row[7]) || 0,
                        tipologia: row[8] || '',
                        utilizacao: row[9] || 'N/A',
                        estrutura: row[10] || 'N/A',
                        loteamento: obterNomeLoteamento(colA) // Vincula o loteamento aqui
                    });
                }
            });
        } catch (error) {
            console.error(`Erro no ano ${ano}:`, error);
        }
    }
    
    todosResultadosPDF = resultadosBrutos;
    exibirResultadosNaTela(resultadosBrutos);
}

// 6. EXIBIÇÃO NA TELA
function exibirResultadosNaTela(resultados) {
    const tableBody = document.querySelector('#resultTable tbody');
    const btnPDF = document.getElementById('btnPDF');
    if(!tableBody) return;
    
    tableBody.innerHTML = '';

    if (resultados.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">Nenhum registro encontrado.</td></tr>`;
        if(btnPDF) btnPDF.style.display = 'none';
        return;
    }

    if(btnPDF) btnPDF.style.display = 'inline-block';
    const anosPresentes = [...new Set(resultados.map(r => r.ano))];
    
    anosPresentes.forEach(ano => {
        const regsDoAno = resultados.filter(r => r.ano === ano);
        const somaMetragem = regsDoAno.reduce((acc, curr) => acc + curr.metragem, 0);
        const ref = regsDoAno[0];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ref.id}</td>
            <td>${ref.quadra}</td>
            <td>${ref.lote}</td>
            <td><strong>${ano}</strong></td>
            <td>${somaMetragem.toFixed(2)} m²</td>
            <td>${regsDoAno.length > 1 ? "MÚLTIPLAS" : ref.utilizacao}</td>
            <td>${regsDoAno.length > 1 ? "MISTA / VER PDF" : ref.estrutura}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 7. GERAÇÃO DO PDF (CERTIDÃO NARRATIVA COM AJUSTES 1 E 2)
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const dataObj = new Date();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const dataExtenso = dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFont("times", "bold").setFontSize(14);
    doc.text("ESTADO DO PARANÁ", 105, 15, { align: "center" });
    doc.text("PREFEITURA MUNICIPAL", 105, 22, { align: "center" });
    doc.setFontSize(10).setFont("times", "normal");
    doc.text(`Documento gerado em: ${dataFormatada}`, 105, 30, { align: "center" });
    doc.line(20, 35, 190, 35);

    // Seleciona o registro mais recente para o cabeçalho
    const u = todosResultadosPDF[todosResultadosPDF.length - 1];
    
    // Calcula área total para definir se é Terreno Vago ou Edificação
    const areaTotalGeral = todosResultadosPDF.reduce((acc, curr) => acc + curr.metragem, 0);
    
    doc.setFontSize(12).setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 45, { align: "center" });

    doc.setFontSize(11).setFont("times", "normal");

    // --- AJUSTES 1 E 2: LÓGICA DO TEXTO INTRODUTÓRIO ---
    let textoIntro = "";
    if (areaTotalGeral === 0) {
        // Ajuste 1: Terreno Vago (ID, Logradouro, Número, Loteamento)
        textoIntro = `CERTIFICA-SE que o imóvel ID nº ${u.id}, ${u.logradouro}, nº ${u.numero}, ${u.loteamento.toUpperCase()}, apresenta a seguinte evolução:`;
    } else {
        // Ajuste 2: Edificações (ID, Logradouro, Número)
        textoIntro = `CERTIFICA-SE que o imóvel ID nº ${u.id}, ${u.logradouro}, nº ${u.numero}, apresenta a seguinte evolução:`;
    }

    doc.text(doc.splitTextToSize(textoIntro, 170), 20, 55);

    const headers = [["ID / INSCRIÇÃO", "ANO", "DESCRIÇÃO DAS EDIFICAÇÕES", "ÁREA TOTAL"]];
    const dataRows = [];
    const listaAnos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

    listaAnos.forEach(ano => {
        const regs = todosResultadosPDF.filter(r => r.ano === ano);
        if (regs.length > 0) {
            let desc = "";
            let area = 0;
            regs.forEach(r => {
                if(r.metragem > 0) {
                    desc += `• ${r.tipologia} (${r.estrutura}): ${r.metragem.toFixed(2)}m²\n`;
                    area += r.metragem;
                }
            });
            dataRows.push([regs[0].id, ano.toString(), (area === 0 ? "TERRENO VAGO" : desc.trim()), `${area.toFixed(2)} m²`]);
        }
    });

    doc.autoTable({
        startY: 75,
        head: headers,
        body: dataRows,
        theme: 'grid',
        styles: { font: "times", fontSize: 9 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 15 }, 2: { cellWidth: 95 }, 3: { cellWidth: 25 } }
    });

    const finalY = doc.lastAutoTable.finalY + 25;
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY);
    doc.text("Agente Administrativo Responsável", 105, finalY + 25, { align: "center" });
    doc.save(`Certidao_${u.id}.pdf`);
}

// 8. EVENTOS E AUXILIARES (Mantidos)
const searchInp = document.getElementById("search");
if(searchInp) searchInp.addEventListener("keypress", (e) => { if (e.key === "Enter") buscarDados(); });

function limparConsulta() {
    document.getElementById('search').value = "";
    const tb = document.querySelector('#resultTable tbody');
    if(tb) tb.innerHTML = "";
    const b = document.getElementById('btnPDF');
    if(b) b.style.display = 'none';
    todosResultadosPDF = [];
}