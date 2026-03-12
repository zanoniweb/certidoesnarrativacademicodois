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

// 4. VARIÁVEL GLOBAL PARA O HISTÓRICO
let todosResultadosPDF = [];

// 5. BUSCA DE DADOS (2020-2026)
async function buscarDados() {
    const campoBusca = document.getElementById('search');
    const inscricao = campoBusca.value.trim();
    
    if (!inscricao) {
        alert("Por favor, informe o número da Inscrição Municipal!");
        return;
    }

    const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    let resultados = [];
    
    const tableBody = document.querySelector('#resultTable tbody');
    tableBody.innerHTML = '<tr><td colspan="7">Consultando base de dados histórica...</td></tr>';

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
                // Filtro rigoroso pela inscrição exata ou parcial conforme planilha
                if (row[0] && row[0].toString().includes(inscricao)) {
                    resultados.push({
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
    exibirResultados(resultados);
}

// 6. EXIBIÇÃO NA TELA
function exibirResultados(resultados) {
    const tableBody = document.querySelector('#resultTable tbody');
    const btnPDF = document.getElementById('btnPDF');
    tableBody.innerHTML = '';

    if (resultados.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">Nenhum registro encontrado.</td></tr>`;
        if(btnPDF) btnPDF.style.display = 'none';
        todosResultadosPDF = [];
        return;
    }

    todosResultadosPDF = resultados; 
    if(btnPDF) btnPDF.style.display = 'inline-block';

    resultados.forEach(res => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${res.inscricao}</td>
            <td>${res.quadra}</td>
            <td>${res.lote}</td>
            <td>${res.ano}</td>
            <td>${res.metragem}</td>
            <td>${res.utilizacao}</td>
            <td>${res.estrutura}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 7. GERAÇÃO DA CERTIDÃO NARRATIVA ATUALIZADA
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuração de Data (Sem Hora)
    const dataObj = new Date();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const dataExtenso = dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Layout Institucional
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ESTADO DO PARANÁ", 105, 15, { align: "center" });
    doc.text("PREFEITURA MUNICIPAL", 105, 22, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text([
        "Secretaria Municipal da Fazenda",
        "Divisão de Cadastro Imobiliário",
        "Documento gerado em: " + dataFormatada
    ], 105, 30, { align: "center" });
    
    doc.setLineWidth(0.4);
    doc.line(20, 42, 190, 42);

    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 55, { align: "center" });

    const ultimoRegistro = todosResultadosPDF[todosResultadosPDF.length - 1];
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    
    let textoNarrativo = `O MUNICÍPIO, no exercício de suas competências tributárias e administrativas, CERTIFICA para os devidos fins que, em consulta aos registros imobiliários consolidados, identificou-se que o imóvel sob a Inscrição Municipal nº ${ultimoRegistro.inscricao}, localizado na ${ultimoRegistro.logradouro}, nº ${ultimoRegistro.numero}, correspondente à Quadra ${ultimoRegistro.quadra} e Lote ${ultimoRegistro.lote}, apresenta a seguinte situação fática e jurídica:`;

    const splitTexto = doc.splitTextToSize(textoNarrativo, 170);
    doc.text(splitTexto, 20, 70);

    // Soma total do último ano para o parecer inicial
    const anoAtual = ultimoRegistro.ano;
    const registrosUltimoAno = todosResultadosPDF.filter(r => r.ano === anoAtual);
    const areaTotalParecer = registrosUltimoAno.reduce((acc, curr) => acc + curr.metragem, 0);

    let parecer = "";
    if (areaTotalParecer === 0) {
        parecer = `I - Constatou-se que o imóvel supracitado é classificado tecnicamente como TERRENO VAGO, inexistindo benfeitorias averbadas até o exercício de ${anoAtual}.`;
    } else {
        const utilizacoes = [...new Set(registrosUltimoAno.map(r => r.utilizacao))].join(" / ");
        const estruturas = [...new Set(registrosUltimoAno.map(r => r.estrutura))].join(" / ");
        parecer = `I - Constatou-se que o imóvel supracitado possui EDIFICAÇÃO CONSOLIDADA com destinação de utilização ${utilizacoes} e padrão estrutural de ${estruturas}, totalizando área construída de ${areaTotalParecer} m², conforme dados cadastrais atualizados em ${anoAtual}.`;
    }

    const splitParecer = doc.splitTextToSize(parecer, 170);
    doc.text(splitParecer, 20, 95);

    // II - QUADRO ANALÍTICO CORRIGIDO (ID | ANO | DESCRIÇÃO | METRAGEM)
    doc.setFont("times", "bold");
    doc.text("II - QUADRO ANALÍTICO DE EVOLUÇÃO CADASTRAL (2020-2026):", 20, 115);

    const headers = [["Inscrição (ID)", "Ano", "Descrição das Edificações", "Metragem Total"]];
    const anosValidos = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const dataRows = [];

    anosValidos.forEach(ano => {
        const registrosDoAno = todosResultadosPDF.filter(r => r.ano === ano);
        if (registrosDoAno.length > 0) {
            let descritivoAno = "";
            let somaAno = 0;

            registrosDoAno.forEach(reg => {
                if (reg.metragem > 0) {
                    descritivoAno += `${reg.tipologia} | Área: ${reg.metragem}m² | Estrutura: ${reg.estrutura} | Uso: ${reg.utilizacao}\n`;
                    somaAno += reg.metragem;
                }
            });

            if (somaAno === 0) descritivoAno = "TERRENO VAGO";

            dataRows.push([
                registrosDoAno[0].id,
                ano.toString(),
                descritivoAno.trim(),
                somaAno > 0 ? `${somaAno} m²` : "0"
            ]);
        }
    });

    doc.autoTable({
        startY: 120,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: "times", fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 40 }, // Inscrição
            1: { cellWidth: 15 }, // Ano
            2: { cellWidth: 95 }, // Descrição
            3: { cellWidth: 20 }  // Metragem
        },
        margin: { left: 20, right: 20 }
    });

    // Rodapé (Sem Hora)
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setFont("times", "italic");
    doc.text(`O referido é verdade e dou fé. Certidão emitida via sistema eletrônico em ${dataFormatada}.`, 20, finalY);
    
    doc.setFont("times", "normal");
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY + 10);

    doc.line(70, finalY + 35, 140, finalY + 35);
    doc.setFont("times", "bold");
    doc.text("Agente Administrativo Responsável", 105, finalY + 40, { align: "center" });

    doc.save(`Certidao_Narrativa_${ultimoRegistro.inscricao}.pdf`);
}

// 8. EVENTOS E INTERAÇÃO
document.getElementById("btnOrientacoes").addEventListener("click", () => document.getElementById("manual").classList.add("ativo"));
document.getElementById("btnFechar").addEventListener("click", () => document.getElementById("manual").classList.remove("ativo"));

document.getElementById("search").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        buscarDados();
    }
});

function limparConsulta() {
    document.getElementById('search').value = "";
    document.querySelector('#resultTable tbody').innerHTML = "";
    const btnPDF = document.getElementById('btnPDF');
    if (btnPDF) btnPDF.style.display = 'none';
    todosResultadosPDF = [];
}