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

// 4. VARIÁVEL GLOBAL PARA O PDF
let todosResultadosPDF = [];

// 5. BUSCA DE DADOS (CORRIGIDA E BLINDADA)
async function buscarDados() {
    const campoBusca = document.getElementById('search');
    const valorDigitado = campoBusca.value.trim();
    
    if (!valorDigitado) {
        alert("Por favor, informe o número da Inscrição Municipal!");
        return;
    }

    // Função para remover pontos, traços e espaços para comparação pura
    const limpar = (txt) => txt.toString().replace(/\D/g, '');
    const buscaLimpa = limpar(valorDigitado);

    const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    let resultadosBrutos = [];
    
    const tableBody = document.querySelector('#resultTable tbody');
    tableBody.innerHTML = '<tr><td colspan="7">Localizando histórico completo (Edificações e Áreas)...</td></tr>';

    for (let ano of anos) {
        const url = `tabelas/${ano}.xlsx`;
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // defval: "" garante que colunas vazias não desloquem os dados
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            json.forEach(row => {
                const colA = row[0] ? row[0].toString().trim() : ""; // Inscrição
                const colB = row[1] ? row[1].toString().trim() : ""; // ID Agrupador

                // Se o que o usuário digitou bater com a Coluna A OU Coluna B (limpos)
                if (limpar(colA) === buscaLimpa || limpar(colB) === buscaLimpa) {
                    resultadosBrutos.push({
                        inscricao: colA,
                        id: colB || colA,
                        logradouro: row[2] || '---',
                        numero: row[3] || '---',
                        quadra: row[4] || '---',
                        lote: row[5] || '---',
                        ano: ano,
                        metragem: parseFloat(row[7]) || 0, // Coluna H
                        tipologia: row[8] || '',           // Coluna I
                        utilizacao: row[9] || 'N/A',       // Coluna J
                        estrutura: row[10] || 'N/A',       // Coluna K
                    });
                }
            });
        } catch (error) {
            console.error(`Erro ao processar ano ${ano}:`, error);
        }
    }
    
    todosResultadosPDF = resultadosBrutos;
    exibirResultadosNaTela(resultadosBrutos);
}

// 6. EXIBIÇÃO NA TELA (SOMA TOTAL POR ANO)
function exibirResultadosNaTela(resultados) {
    const tableBody = document.querySelector('#resultTable tbody');
    const btnPDF = document.getElementById('btnPDF');
    tableBody.innerHTML = '';

    if (resultados.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">Nenhum registro encontrado para esta inscrição.</td></tr>`;
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

// 7. GERAÇÃO DO PDF (CERTIDÃO NARRATIVA COMPLETA)
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
    doc.text(`Documento gerado em: ${dataFormatada}`, 105, 30, { align: "center" });
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 45, { align: "center" });

    // Dados do Imóvel (usa o último registro como referência de endereço)
    const u = todosResultadosPDF[todosResultadosPDF.length - 1];
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    let textoIntro = `CERTIFICA-SE para os devidos fins que o imóvel identificado pelo ID nº ${u.id}, Quadra ${u.quadra}, Lote ${u.lote}, localizado na ${u.logradouro}, nº ${u.numero}, apresenta a seguinte evolução de área edificada:`;
    doc.text(doc.splitTextToSize(textoIntro, 170), 20, 55);

    // Tabela Analítica
    const headers = [["ID / INSCRIÇÃO", "ANO", "DESCRIÇÃO DAS EDIFICAÇÕES", "ÁREA TOTAL"]];
    const dataRows = [];
    const listaAnos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

    listaAnos.forEach(ano => {
        const regs = todosResultadosPDF.filter(r => r.ano === ano);
        if (regs.length > 0) {
            let descritivo = "";
            let areaAnual = 0;
            
            regs.forEach(r => {
                if(r.metragem > 0) {
                    descritivo += `• ${r.tipologia} (${r.estrutura}): ${r.metragem.toFixed(2)}m²\n`;
                    areaAnual += r.metragem;
                }
            });

            if (areaAnual === 0) descritivo = "TERRENO VAGO";

            dataRows.push([
                regs[0].id,
                ano.toString(),
                descritivo.trim(),
                `${areaAnual.toFixed(2)} m²`
            ]);
        }
    });

    doc.autoTable({
        startY: 75,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], fontStyle: 'bold' },
        styles: { font: "times", fontSize: 9, cellPadding: 3 },
        columnStyles: { 
            0: { cellWidth: 40 }, 
            1: { cellWidth: 15 }, 
            2: { cellWidth: 95 }, 
            3: { cellWidth: 25 } 
        }
    });

    // Assinatura
    const finalY = doc.lastAutoTable.finalY + 25;
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY);
    doc.line(70, finalY + 20, 140, finalY + 20);
    doc.text("Agente Administrativo Responsável", 105, finalY + 25, { align: "center" });

    doc.save(`Certidao_${u.id}.pdf`);
}

// 8. EVENTOS DE INTERAÇÃO
document.getElementById("btnOrientacoes").addEventListener("click", () => {
    document.getElementById("manual").classList.add("ativo");
});

document.getElementById("btnFechar").addEventListener("click", () => {
    document.getElementById("manual").classList.remove("ativo");
});

// Atalho Enter para busca
document.getElementById("search").addEventListener("keypress", (e) => {
    if (e.key === "Enter") buscarDados();
});

function limparConsulta() {
    document.getElementById('search').value = "";
    document.querySelector('#resultTable tbody').innerHTML = "";
    document.getElementById('btnPDF').style.display = 'none';
    todosResultadosPDF = [];
}