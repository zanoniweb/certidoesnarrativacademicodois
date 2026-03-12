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
function logout() {
    localStorage.removeItem("loggedIn");
    window.location.href = "index.html";
}

// 4. VARIÁVEL GLOBAL
let todosResultadosPDF = [];

// 5. BUSCA DE DADOS (AGRUPAMENTO POR ANO)
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
    tableBody.innerHTML = '<tr><td colspan="7">Processando histórico real por ano...</td></tr>';

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
                // Filtra exatamente pela inscrição fornecida
                if (row[0] && row[0].toString().trim() === inscricao) {
                    resultadosBrutos.push({
                        inscricao: row[0],
                        id: row[1] || row[0],
                        logradouro: row[2] || '---',
                        numero: row[3] || '---',
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
            console.error(`Erro no ano ${ano}:`, error);
        }
    }
    
    todosResultadosPDF = resultadosBrutos;
    exibirResultadosNaTela(resultadosBrutos);
}

// 6. EXIBIÇÃO NA TELA (CORRIGIDA)
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

    // Agrupa por ano para somar metragens na exibição de tela
    const anosUnicos = [...new Set(resultados.map(r => r.ano))];
    
    anosUnicos.forEach(ano => {
        const regs = resultados.filter(r => r.ano === ano);
        const somaMetragem = regs.reduce((acc, curr) => acc + curr.metragem, 0);
        const p = regs[0];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.inscricao}</td>
            <td>${p.quadra}</td>
            <td>${p.lote}</td>
            <td>${ano}</td>
            <td>${somaMetragem.toFixed(2)}</td>
            <td>${regs.length > 1 ? "MÚLTIPLAS" : p.utilizacao}</td>
            <td>${regs.length > 1 ? "MISTA" : p.estrutura}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 7. GERAÇÃO DO PDF (SEM HORA E COM COLUNA ANO CORRETA)
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Formatação de data apenas (sem hora) conforme solicitado
    const dataObj = new Date();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const dataExtenso = dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Cabeçalho
    doc.setFont("times", "bold");
    doc.text("ESTADO DO PARANÁ", 105, 15, { align: "center" });
    doc.text("PREFEITURA MUNICIPAL", 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text(`Documento gerado em: ${dataFormatada}`, 105, 30, { align: "center" });
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 45, { align: "center" });

    const u = todosResultadosPDF[todosResultadosPDF.length - 1];
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    let texto = `Certifica-se que o imóvel Inscrição nº ${u.inscricao}, Quadra ${u.quadra}, Lote ${u.lote}, apresenta a seguinte evolução:`;
    doc.text(doc.splitTextToSize(texto, 170), 20, 55);

    // Ajuste das Colunas: Inscrição | Ano | Descrição | Metragem
    const headers = [["Inscrição (ID)", "Ano", "Descrição das Edificações", "Metragem Total"]];
    const dataRows = [];
    const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

    anos.forEach(ano => {
        const regs = todosResultadosPDF.filter(r => r.ano === ano);
        if (regs.length > 0) {
            let desc = "";
            let totalArea = 0;
            regs.forEach(r => {
                if(r.metragem > 0) {
                    desc += `${r.tipologia} (${r.estrutura})\n`;
                    totalArea += r.metragem;
                }
            });
            if (totalArea === 0) desc = "TERRENO VAGO";

            dataRows.push([
                regs[0].id,
                ano.toString(),
                desc.trim(),
                `${totalArea.toFixed(2)} m²`
            ]);
        }
    });

    doc.autoTable({
        startY: 65,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
        styles: { font: "times", fontSize: 9 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 15 }, 2: { cellWidth: 95 }, 3: { cellWidth: 25 } }
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY);
    doc.text("Agente Administrativo Responsável", 105, finalY + 30, { align: "center" });

    doc.save(`Certidao_${u.inscricao}.pdf`);
}

// 8. EVENTOS
document.getElementById("btnOrientacoes").addEventListener("click", () => document.getElementById("manual").classList.add("ativo"));
document.getElementById("btnFechar").addEventListener("click", () => document.getElementById("manual").classList.remove("ativo"));

function limparConsulta() {
    document.getElementById('search').value = "";
    document.querySelector('#resultTable tbody').innerHTML = "";
    document.getElementById('btnPDF').style.display = 'none';
    todosResultadosPDF = [];
}