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

// 5. BUSCA DE DADOS (2020-2026) - AJUSTADO PARA COLETAR LOGRADOURO E TIPOLOGIA
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

            // Mapeamento baseado na imagem da planilha Excel fornecida
            json.forEach(row => {
                if (row[0] && row[0].toString().includes(inscricao)) {
                    resultados.push({
                        inscricao: row[0], // Coluna A (INSCRICAO)
                        id: row[1] || row[0], // Coluna B (ID)
                        logradouro: row[2] || 'RUA NÃO INFORMADA', // Coluna C (LOGRADOURO)
                        numero: row[3] || 'S/N', // Coluna D (NÚMERO)
                        quadra: row[4] || '---', // Coluna E (QUADRA)
                        lote: row[5] || '---',   // Coluna F (LOTE)
                        ano: ano,                // Ano do arquivo
                        metragem: row[7] || '0', // Coluna H (METRAGEM)
                        tipologia: row[8] || '', // Coluna I (TIPOLOGIA)
                        utilizacao: row[9] || 'N/A', // Coluna J (UTILIZACAO)
                        estrutura: row[10] || 'N/A', // Coluna K (ESTRUTURA)
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
        tableBody.innerHTML = `<tr><td colspan="7">Nenhum registro encontrado para a inscrição informada.</td></tr>`;
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

// 7. GERAÇÃO DA CERTIDÃO NARRATIVA (AJUSTES 1, 2, 3 e 4)
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) {
        alert("Não há dados para gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurações para o 4º Ajuste (Data e Hora do sistema)
    const dataObj = new Date();
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        "Documento gerado em: " + dataFormatada + " às " + horaFormatada
    ], 105, 30, { align: "center" });
    
    doc.setLineWidth(0.4);
    doc.line(20, 42, 190, 42);

    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 55, { align: "center" });

    // 1º Ajuste: Coleta de Logradouro e Número da tabela
    const ultimoRegistro = todosResultadosPDF[todosResultadosPDF.length - 1];
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    
    let textoNarrativo = `O MUNICÍPIO, no exercício de suas competências tributárias e administrativas, CERTIFICA para os devidos fins que, em consulta aos registros imobiliários consolidados, identificou-se que o imóvel sob a Inscrição Municipal nº ${ultimoRegistro.inscricao}, localizado na ${ultimoRegistro.logradouro}, nº ${ultimoRegistro.numero}, correspondente à Quadra ${ultimoRegistro.quadra} e Lote ${ultimoRegistro.lote}, apresenta a seguinte situação fática e jurídica:`;

    const splitTexto = doc.splitTextToSize(textoNarrativo, 170);
    doc.text(splitTexto, 20, 70);

    // 2º Ajuste: Tratamento de Múltiplas Utilizações e Estruturas
    const utilizacoesUnicas = [...new Set(todosResultadosPDF.map(r => r.utilizacao))].join(" / ");
    const estruturasUnicas = [...new Set(todosResultadosPDF.map(r => r.estrutura))].join(" / ");
    const areaTotalConstruida = todosResultadosPDF.reduce((acc, curr) => acc + parseFloat(curr.metragem || 0), 0);

    let parecer = "";
    if (ultimoRegistro.inscricao.toString().endsWith(".000")) {
        parecer = `I - Constatou-se que o imóvel supracitado é classificado tecnicamente como TERRENO VAGO, inexistindo benfeitorias ou edificações averbadas junto ao cadastro municipal até o exercício de ${ultimoRegistro.ano}.`;
    } else {
        parecer = `I - Constatou-se que o imóvel supracitado possui EDIFICAÇÃO CONSOLIDADA com destinação de utilização ${utilizacoesUnicas} e padrão estrutural de ${estruturasUnicas}, totalizando área construída de ${areaTotalConstruida} m², conforme dados cadastrais atualizados em ${ultimoRegistro.ano}.`;
    }

    const splitParecer = doc.splitTextToSize(parecer, 170);
    doc.text(splitParecer, 20, 95);

    // 3º Ajuste: Quadro Analítico de Evolução Cadastral (Colunas ID, Descrição, Metragem Total)
    doc.setFont("times", "bold");
    doc.text("II - QUADRO ANALÍTICO DE EVOLUÇÃO CADASTRAL (2020-2026):", 20, 115);

    const headers = [["Inscrição (ID)", "Descrição das Edificações", "Metragem Total"]];
    
    const dataRows = todosResultadosPDF.map(res => {
        let descricao = "";
        let metragemTotalCol = "0";

        if (res.utilizacao.toUpperCase().includes("TERRENO VAGO")) {
            descricao = "TERRENO VAGO";
            metragemTotalCol = "0";
        } else {
            // Descrição detalhada conforme solicitado: Tipologia, Metragem, Estrutura e Utilização
            descricao = `${res.tipologia} | Metragem: ${res.metragem}m² | Estrutura: ${res.estrutura} | Utilização: ${res.utilizacao}`;
            metragemTotalCol = `${res.metragem} m²`;
        }
        return [res.id, descricao, metragemTotalCol];
    });

    doc.autoTable({
        startY: 120,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: "times", fontSize: 8, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 100 },
            2: { cellWidth: 25 }
        },
        margin: { left: 20, right: 20 }
    });

    // 4º Ajuste: Rodapé Clássico e Requintado com Hora
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setFont("times", "italic");
    doc.text(`O referido é verdade e dou fé. Certidão emitida via sistema eletrônico em ${dataFormatada} às ${horaFormatada}.`, 20, finalY);
    
    doc.setFont("times", "normal");
    doc.text(`Cambé/PR, ${dataExtenso}.`, 20, finalY + 10);

    doc.line(70, finalY + 35, 140, finalY + 35);
    doc.setFont("times", "bold");
    doc.text("Agente Administrativo Responsável", 105, finalY + 40, { align: "center" });

    doc.save(`Certidao_${ultimoRegistro.inscricao}.pdf`);
}

// 8. INTERAÇÃO DO MODAL E EVENTOS DE TECLADO
document.getElementById("btnOrientacoes").addEventListener("click", () => document.getElementById("manual").classList.add("ativo"));
document.getElementById("btnFechar").addEventListener("click", () => document.getElementById("manual").classList.remove("ativo"));

document.getElementById("search").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        buscarDados();
    }
});

// 9. FUNÇÃO DO BOTÃO LIMPAR
function limparConsulta() {
    const campoBusca = document.getElementById('search');
    campoBusca.value = "";
    const tableBody = document.querySelector('#resultTable tbody');
    tableBody.innerHTML = "";
    const btnPDF = document.getElementById('btnPDF');
    if (btnPDF) btnPDF.style.display = 'none';
    todosResultadosPDF = [];
    campoBusca.focus();
}