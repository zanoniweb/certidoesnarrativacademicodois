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
                if (row[0] && row[0].toString().includes(inscricao)) {
                    resultados.push({
                        inscricao: row[0],
                        quadra: row[1] || '---',
                        lote: row[2] || '---',
                        ano: ano,
                        metragem: row[4] || '0',
                        utilizacao: row[5] || 'N/A',
                        estrutura: row[6] || 'N/A',
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

// 7. GERAÇÃO DA CERTIDÃO NARRATIVA ROBUSTA
async function gerarPDF() {
    if (todosResultadosPDF.length === 0) {
        alert("Não há dados para gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
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
        "CNPJ 00.000.000/0000-00 | Tel: (43) 0000-0000"
    ], 105, 30, { align: "center" });
    
    doc.setLineWidth(0.4);
    doc.line(20, 42, 190, 42);

    // Título Ajustado (Sem número e sem exclamação)
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("CERTIDÃO NARRATIVA TÉCNICA ADMINISTRATIVA", 105, 55, { align: "center" });

    const ultimoRegistro = todosResultadosPDF[todosResultadosPDF.length - 1];
    const isVago = ultimoRegistro.inscricao.toString().endsWith(".000");
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    
    let textoNarrativo = `O MUNICÍPIO, no exercício de suas competências tributárias e administrativas, CERTIFICA para os devidos fins que, em consulta aos registros imobiliários consolidados, identificou-se que o imóvel sob a Inscrição Municipal nº ${ultimoRegistro.inscricao}, correspondente à Quadra ${ultimoRegistro.quadra} e Lote ${ultimoRegistro.lote}, apresenta a seguinte situação fática e jurídica:`;

    const splitTexto = doc.splitTextToSize(textoNarrativo, 170);
    doc.text(splitTexto, 20, 70);

    let parecer = "";
    if (isVago) {
        parecer = `I - Constatou-se que o imóvel supracitado é classificado tecnicamente como TERRENO VAGO, inexistindo benfeitorias ou edificações averbadas junto ao cadastro municipal até o exercício de ${ultimoRegistro.ano}, possuindo área territorial total de ${ultimoRegistro.metragem} m².`;
    } else {
        parecer = `I - Constatou-se que o imóvel supracitado possui EDIFICAÇÃO CONSOLIDADA com destinação de utilização ${ultimoRegistro.utilizacao} e padrão estrutural de ${ultimoRegistro.estrutura}, totalizando área construída de ${ultimoRegistro.metragem} m², conforme dados cadastrais atualizados em ${ultimoRegistro.ano}.`;
    }

    const splitParecer = doc.splitTextToSize(parecer, 170);
    doc.text(splitParecer, 20, 90);

    doc.setFont("times", "bold");
    doc.text("II - QUADRO ANALÍTICO DE EVOLUÇÃO CADASTRAL (2020-2026):", 20, 115);

    const headers = [["Inscrição", "Quadra", "Lote", "Ano", "Área", "Utilização", "Estrutura"]];
    const dataRows = todosResultadosPDF.map(res => [
        res.inscricao, res.quadra, res.lote, res.ano, res.metragem + " m²", res.utilizacao, res.estrutura
    ]);

    doc.autoTable({
        startY: 120,
        head: headers,
        body: dataRows,
        theme: 'grid',
        headStyles: { fillGray: true, textColor: [0,0,0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { font: "times", fontSize: 8, cellPadding: 2 },
        margin: { left: 20, right: 20 }
    });

    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const finalY = doc.lastAutoTable.finalY + 20;

    doc.setFontSize(10);
    doc.text(`O referido é verdade e dou fé. Certidão emitida via sistema eletrônico.`, 20, finalY);
    doc.text(`Cambé/PR, ${dataAtual}.`, 20, finalY + 8);

    doc.line(70, finalY + 35, 140, finalY + 35);
    doc.setFont("times", "bold");
    doc.text("Agente Administrativo Responsável", 105, finalY + 40, { align: "center" });
    doc.setFont("times", "normal");
    doc.text("Divisão de Cadastro e Lançamentos", 105, finalY + 45, { align: "center" });

    doc.save(`Certidao_Narrativa_${ultimoRegistro.inscricao}.pdf`);
}

// 8. INTERAÇÃO DO MODAL E EVENTOS DE TECLADO
document.getElementById("btnOrientacoes").addEventListener("click", () => document.getElementById("manual").classList.add("ativo"));
document.getElementById("btnFechar").addEventListener("click", () => document.getElementById("manual").classList.remove("ativo"));

// Acionar pesquisa ao apertar a tecla "Enter" no campo de busca
document.getElementById("search").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        buscarDados();
    }
});

// 9. FUNÇÃO DO BOTÃO LIMPAR CORRIGIDA
function limparConsulta() {
    const campoBusca = document.getElementById('search');
    campoBusca.value = "";

    const tableBody = document.querySelector('#resultTable tbody');
    tableBody.innerHTML = "";

    const btnPDF = document.getElementById('btnPDF');
    if (btnPDF) {
        btnPDF.style.display = 'none';
    }

    todosResultadosPDF = [];
    campoBusca.focus();
    
    console.log("Consulta limpa. Sistema pronto para nova pesquisa.");
}