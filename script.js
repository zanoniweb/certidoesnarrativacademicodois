// 1. PROTEÇÃO DE ROTA
if (!localStorage.getItem("loggedIn") && window.location.pathname.includes("consulta.html")) {
    window.location.href = "index.html";
}

// 2. BASE DE USUÁRIOS
const users = [
    { username: "alemaochefe", password: "alemao1234" },
    { username: "jzanoni", password: "180804" }
];

// 3. SISTEMA DE AUTENTICAÇÃO
function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let errorMessage = document.getElementById("error-message");
    let user = users.find(u => u.username === username && u.password === password);

    if (user) {
        localStorage.setItem("loggedIn", "true");
        window.location.href = "consulta.html";
    } else {
        errorMessage.textContent = "Usuário ou senha incorretos!";
    }
}

function logout() {
    localStorage.removeItem("loggedIn");
    window.location.href = "index.html";
}

// 4. VARIÁVEL GLOBAL
let todosResultadosPDF = [];

// 5. BUSCA DE DADOS (AGRUPAMENTO REQUINTADO POR ANO)
async function buscarDados() {
    const campoBusca = document.getElementById('search');
    const inscricao = campoBusca.value.trim();
    
    if (!inscricao) {
        alert("Por favor, informe o número da Inscrição Municipal!");
        return;
    }

    const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    let resultadosBrutos = [];
    
    const tableBody = document.querySelector('#resultTable tbody');
    tableBody.innerHTML = '<tr><td colspan="7">Processando histórico cadastral...</td></tr>';

    for (let ano of anos) {
        const url = `tabelas/${ano}.xlsx`;
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            json.forEach(row => {
                if (row[0] && row[0].toString().includes(inscricao)) {
                    resultadosBrutos.push({
                        inscricao: row[0],
                        id: row[1] || row[0],
                        logradouro: row[2] || 'RUA JACA',
                        numero: row[3] || '0',
                        quadra: row[4] || '---',
                        lote: row[5] || '---',
                        ano: ano,
                        metragem: parseFloat(row[7] || 0),
                        tipologia: row[8] || '',
                        utilizacao: row[9] || 'N/A',
                        estrutura: row[10] || 'N/A',
                    });
                }
            });
        } catch (error) {
            console.error(`Erro no processamento (Ano ${ano}):`, error);
        }
    }
    
    // Armazena os brutos para o PDF processar o agrupamento
    todosResultadosPDF = resultadosBrutos;
    exibirResultadosNaTela(resultadosBrutos);
}

// 6. EXIBIÇÃO NA TELA (SINTETIZADA POR ANO)
function exibirResultadosNaTela(resultados) {
    const tableBody = document.querySelector('#resultTable tbody');
    const btnPDF = document.getElementById('btnPDF');
    tableBody.innerHTML = '';

    if (resultados.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">Nenhum registro encontrado.</td></tr>`;
        if(btnPDF) btnPDF.style.display = 'none';
        return;
    }

    if(btnPDF) btnPDF.style.display = 'inline-block';

    const anosSet = [...new Set(resultados.map(r => r.ano))];
    
    anosSet.forEach(ano => {
        const regs = resultados.filter(r => r.ano === ano);
        const somaMetragem = regs.reduce((acc, curr) => acc + curr.metragem, 0);
        const primeiro = regs[0];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${primeiro.inscricao}</td>
            <td>${primeiro.quadra}</td>
            <td>${primeiro.lote}</td>
            <td><strong>${ano}</strong></td>
            <td>${somaMetragem.toFixed(2)} m²</td>
            <td>${regs.length > 1 ? "Múltiplas" : primeiro.utilizacao}</td>
            <td>${regs.length > 1 ? "Mista" : primeiro.estrutura}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 7. GERAÇÃO DO PDF (PROCESSAMENTO DE MÚLTIPLAS EDIFICAÇÕES POR ANO)
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dataObj = new Date();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const dataExtenso = dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Cabeçalho Institucional
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ESTADO DO PARANÁ", 105, 15, { align: "center" });
    doc.text("PREFEITURA MUNICIPAL", 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text(["Secretaria Municipal da Fazenda", "Divisão de Cadastro Imobiliário", `Documento gerado em: ${dataFormatada}`], 105, 30, { align: "center" });
    doc.line(20, 42, 190, 42);

    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 55, { align: "center" });

    // Dados do Imóvel
    const ultimo = todosResultadosPDF[todosResultadosPDF.length - 1];
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    let textoNarrativo = `CERTIFICA-SE que o imóvel sob a Inscrição Municipal nº ${ultimo.inscricao}, localizado na ${ultimo.logradouro}, nº ${ultimo.numero}, Quadra ${ultimo.quadra}, Lote ${ultimo.lote}, apresenta a seguinte evolução cadastral:`;
    doc.text(doc.splitTextToSize(textoNarrativo, 170), 20, 70);

    // Quadro Analítico Processado
    const headers = [["Inscrição (ID)", "Ano", "Descrição das Edificações", "Área Total"]];
    const dataRows = [];
    const anosValidos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

    anosValidos.forEach(ano => {
        const registros = todosResultadosPDF.filter(r => r.ano === ano);
        if (registros.length > 0) {
            let descritivo = "";
            let somaMetragem = 0;

            registros.forEach(reg => {
                if (reg.metragem > 0) {
                    descritivo += `• ${reg.tipologia}: ${reg.metragem}m² (${reg.estrutura})\n`;
                    somaMetragem += reg.metragem;
                }
            });

            if (somaMetragem === 0) descritivo = "TERRENO VAGO";

            dataRows.push([
                registros[0].id,
                ano.toString(),
                descritivo.trim(),
                `${somaMetragem.toFixed(2)} m²`
            ]);
        }
    });

    doc.autoTable({
        startY: 90,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], fontStyle: 'bold' },
        styles: { font: "times", fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 15 }, 2: { cellWidth: 100 }, 3: { cellWidth: 20 } }
    });

    // Assinatura e Data
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.setFontSize(10);
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY);
    doc.line(70, finalY + 25, 140, finalY + 25);
    doc.text("Agente Administrativo Responsável", 105, finalY + 30, { align: "center" });

    doc.save(`Certidao_${ultimo.inscricao}.pdf`);
}

// 8. EVENTOS
document.getElementById("btnOrientacoes").addEventListener("click", () => document.getElementById("manual").classList.add("ativo"));
document.getElementById("btnFechar").addEventListener("click", () => document.getElementById("manual").classList.remove("ativo"));
document.getElementById("search").addEventListener("keypress", (e) => { if (e.key === "Enter") buscarDados(); });

function limparConsulta() {
    document.getElementById('search').value = "";
    document.querySelector('#resultTable tbody').innerHTML = "";
    document.getElementById('btnPDF').style.display = 'none';
    todosResultadosPDF = [];
}