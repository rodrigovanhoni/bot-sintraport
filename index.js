const express = require("express");
const twilio = require("twilio");
const { Pool } = require("pg");
const app = express();

// Configurações iniciais
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const sessions = new Map();

// Configuração do PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Criar tabela se não existir
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reservas (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(50) NOT NULL,
                data DATE NOT NULL,
                telefone VARCHAR(50) NOT NULL,
                nome VARCHAR(100),
                email VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pendente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Banco de dados inicializado");
    } catch (err) {
        console.error("Erro ao inicializar banco:", err);
    }
}

// Inicializa o banco
initDB();

// Funções do banco de dados
async function verificarDisponibilidade(tipo, data) {
    console.log('Verificando disponibilidade para:', tipo, data);
    const result = await pool.query(
        'SELECT COUNT(*) as count FROM reservas WHERE tipo = $1 AND data = $2 AND status != $3',
        [tipo, data, 'cancelado']
    );
    console.log('Resultado da query:', result.rows[0]);
    return result.rows[0].count === '0';
}

async function salvarReserva(tipo, data, telefone, nome = null, email = null) {
    const result = await pool.query(
        "INSERT INTO reservas (tipo, data, telefone, nome, email) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [tipo, data, telefone, nome, email],
    );
    return result.rows[0].id;
}

// Configuração do Express
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Rota principal
app.get("/", (req, res) => {
    res.send("Bot está funcionando!");
});

// Primeiro, vamos adicionar uma nova rota no seu index.js para servir a página
// Rota principal
app.get("/", (req, res) => {
    res.send("Bot está funcionando!");
});

// Rota de reserva
app.get("/reservar", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
           <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
           <title>Reservas Sintraport</title>
           <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
           <div class="container mt-5">
               <h2 class="mb-4">Sistema de Reservas - Sintraport</h2>
        
               <form id="reservaForm" class="needs-validation" novalidate>
                   <div class="mb-3">
                       <label for="nome" class="form-label">Nome Completo</label>
                       <input type="text" class="form-control" id="nome" required>
                   </div>
        
                   <div class="mb-3">
                       <label for="email" class="form-label">Email</label>
                       <input type="email" class="form-control" id="email" required>
                   </div>
        
                   <div class="mb-3">
                       <label for="telefone" class="form-label">Telefone</label>
                       <input type="tel" class="form-control" id="telefone" required>
                   </div>
        
                   <div class="mb-3">
                       <label for="tipo" class="form-label">Tipo de Reserva</label>
                       <select class="form-select" id="tipo" required>
                           <option value="">Selecione...</option>
                           <option value="chacara">Chácara</option>
                           <option value="carro">Carro para Transporte Médico</option>
                       </select>
                   </div>
        
                   <div class="mb-3">
                       <label for="data" class="form-label">Data Desejada</label>
                       <input type="date" class="form-control" id="data" required>
                   </div>
        
                   <button type="submit" class="btn btn-primary">Verificar Disponibilidade</button>
               </form>
        
               <div id="resultado" class="mt-3"></div>
           </div>
        
           <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
           <script>
           document.getElementById('reservaForm').addEventListener('submit', async (e) => {
               e.preventDefault();
        
               const data = {
                   nome: document.getElementById('nome').value,
                   email: document.getElementById('email').value,
                   telefone: document.getElementById('telefone').value,
                   tipo: document.getElementById('tipo').value,
                   data: document.getElementById('data').value
               };
        
               try {
                   const response = await fetch('/api/verificar-disponibilidade', {
                       method: 'POST',
                       headers: {
                           'Content-Type': 'application/json'
                       },
                       body: JSON.stringify(data)
                   });
        
                   const result = await response.json();
        
                   if (result.disponivel) {
                       document.getElementById('resultado').innerHTML = \`
                           <div class="alert alert-success">
                               Data disponível! Confirma a reserva?
                               <button onclick="confirmarReserva()" class="btn btn-success ms-3">Confirmar</button>
                           </div>\`;
                   } else {
                       document.getElementById('resultado').innerHTML = \`
                           <div class="alert alert-danger">
                               Desculpe, data não disponível. Por favor, escolha outra data.
                           </div>\`;
                   }
               } catch (error) {
                   document.getElementById('resultado').innerHTML = \`
                       <div class="alert alert-danger">
                           Erro ao verificar disponibilidade. Tente novamente.
                       </div>\`;
               }
           });
        
           // Na parte do script, vamos atualizar a função confirmarReserva
                async function confirmarReserva() {
                    const data = {
                        nome: document.getElementById('nome').value,
                        email: document.getElementById('email').value,
                        telefone: document.getElementById('telefone').value,
                        tipo: document.getElementById('tipo').value,
                        data: document.getElementById('data').value
                    };
                
                    try {
                        const response = await fetch('/api/salvar-reserva', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            document.getElementById('resultado').innerHTML = \`
                                <div class="alert alert-success">
                                    Reserva confirmada com sucesso!
                                    <br>
                                    Um diretor irá analisar seu pedido e retornar em breve.
                                </div>\`;
                            document.getElementById('reservaForm').reset();
                        } else {
                            document.getElementById('resultado').innerHTML = \`
                                <div class="alert alert-danger">
                                    Erro ao confirmar reserva. Tente novamente.
                                </div>\`;
                        }
                    } catch (error) {
                        document.getElementById('resultado').innerHTML = \`
                            <div class="alert alert-danger">
                                Erro ao confirmar reserva. Tente novamente.
                            </div>\`;
                    }
                }
                           
           </script>
        </body>
        </html>
           `);
});

// Adicionar rota para API de verificação
app.post('/api/verificar-disponibilidade', async (req, res) => {
    try {
        console.log('Dados recebidos:', req.body);
        const disponivel = await verificarDisponibilidade(req.body.tipo, req.body.data);
        console.log('Resultado da verificação:', disponivel);
        res.json({ disponivel });
    } catch (error) {
        console.error('Erro na verificação:', error);
        res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
    }
});

// Funções do banco de dados
function verificarDisponibilidade(tipo, data) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT COUNT(*) as count FROM reservas WHERE tipo = ? AND data = ? AND status != "cancelado"',
            [tipo, data],
            (err, row) => {
                if (err) reject(err);
                else resolve(row.count === 0);
            },
        );
    });
}

function salvarReserva(tipo, data, telefone) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO reservas (tipo, data, telefone) VALUES (?, ?, ?)",
            [tipo, data, telefone],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            },
        );
    });
}

// Função para enviar mensagem
const sendMessage = (to, message) => {
    return client.messages.create({
        from: "whatsapp:+14155238886",
        body: message,
        to: to,
    });
};

app.post("/api/verificar-disponibilidade", async (req, res) => {
    try {
        const disponivel = await verificarDisponibilidade(
            req.body.tipo,
            req.body.data,
        );
        res.json({ disponivel });
    } catch (error) {
        res.status(500).json({ error: "Erro ao verificar disponibilidade" });
    }
});

// Webhook principal
app.post("/webhook", async (req, res) => {
    console.log("Mensagem recebida:", req.body);
    const incomingMsg = req.body.Body?.toLowerCase();
    const from = req.body.From;

    res.status(200).send("OK");

    try {
        console.log("Estado atual da sessão:", sessions.get(from));
        let session = sessions.get(from) || { step: "initial" };
        console.log("Step atual:", session.step);

        switch (session.step) {
            case "initial":
                if (incomingMsg.includes("reservar")) {
                    session.step = "escolher_servico";
                    sessions.set(from, session);
                    console.log("Mudando para escolher_servico");
                    sendMessage(
                        from,
                        "O que você deseja reservar?\n" +
                            "1 - Chácara\n" +
                            "2 - Carro para transporte médico",
                    );
                } else {
                    sendMessage(
                        from,
                        "Olá! Como posso ajudar?\n" +
                            'Digite "reservar" para fazer uma reserva',
                    );
                }
                break;

            case "escolher_servico":
                console.log("Processando escolha de serviço:", incomingMsg);
                if (["1", "2", "chácara", "carro"].includes(incomingMsg)) {
                    session.servico =
                        incomingMsg === "1" || incomingMsg === "chácara"
                            ? "chácara"
                            : "carro";
                    session.step = "informar_data";
                    sessions.set(from, session);
                    console.log("Serviço escolhido:", session.servico);
                    sendMessage(
                        from,
                        `Por favor, informe a data desejada para ${session.servico} no formato DD/MM/YYYY`,
                    );
                } else {
                    sendMessage(
                        from,
                        "Opção inválida. Digite:\n" +
                            "1 - para Chácara\n" +
                            "2 - para Carro",
                    );
                }
                break;

            case "informar_data":
                console.log("Processando data:", incomingMsg);
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(incomingMsg)) {
                    // Verificar disponibilidade antes de prosseguir
                    const disponivel = await verificarDisponibilidade(
                        session.servico,
                        incomingMsg,
                    );
                    if (disponivel) {
                        session.data = incomingMsg;
                        session.step = "confirmar";
                        sessions.set(from, session);
                        console.log("Data registrada:", session.data);
                        sendMessage(
                            from,
                            `Confirma a reserva?\n` +
                                `Serviço: ${session.servico}\n` +
                                `Data: ${session.data}\n\n` +
                                `Digite SIM para confirmar ou NÃO para cancelar`,
                        );
                    } else {
                        sendMessage(
                            from,
                            `Desculpe, mas ${session.servico} já está reservado para esta data.\n` +
                                `Por favor, escolha outra data no formato DD/MM/YYYY`,
                        );
                    }
                } else {
                    sendMessage(
                        from,
                        "Por favor, informe a data no formato DD/MM/YYYY",
                    );
                }
                break;

            case "confirmar":
                console.log("Processando confirmação:", incomingMsg);
                if (incomingMsg === "sim") {
                    try {
                        // Salva a reserva
                        await salvarReserva(
                            session.servico,
                            session.data,
                            from,
                        );
                        sendMessage(
                            from,
                            `✅ Reserva registrada com sucesso!\n` +
                                `Serviço: ${session.servico}\n` +
                                `Data: ${session.data}\n\n` +
                                `Um diretor irá analisar seu pedido e retornar em breve.\n` +
                                `Digite "reservar" para fazer uma nova reserva.`,
                        );
                        sessions.delete(from);
                        console.log("Sessão finalizada com sucesso");
                    } catch (error) {
                        console.error("Erro ao salvar reserva:", error);
                        sendMessage(
                            from,
                            "Erro ao processar reserva. Por favor, tente novamente.",
                        );
                        sessions.delete(from);
                    }
                } else if (incomingMsg === "não") {
                    sendMessage(
                        from,
                        "Reserva cancelada.\n" +
                            'Digite "reservar" para começar novamente.',
                    );
                    sessions.delete(from);
                    console.log("Sessão cancelada");
                } else {
                    sendMessage(
                        from,
                        "Por favor, digite SIM para confirmar ou NÃO para cancelar",
                    );
                }
                break;
        }
    } catch (error) {
        console.error("Erro:", error);
        sendMessage(
            from,
            "Desculpe, ocorreu um erro. Por favor, tente novamente.",
        );
        sessions.delete(from);
    }
});

// Iniciar servidor
//const port = process.env.REPLIT_PORT || process.env.PORT || 8080;


// Rota para salvar reserva
app.post('/api/salvar-reserva', async (req, res) => {
    try {
        const { tipo, data, telefone, nome, email } = req.body;
        await salvarReserva(tipo, data, telefone, nome, email);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao salvar reserva:', error);
        res.status(500).json({ success: false, error: 'Erro ao salvar reserva' });
    }
});

// Rota para visualizar reservas
app.get("/reservas", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM reservas ORDER BY created_at DESC",
        );

        const html = `
                <h1>Reservas</h1>
                <table border="1" style="border-collapse: collapse;">
                    <tr>
                        <th>ID</th>
                        <th>Tipo</th>
                        <th>Data</th>
                        <th>Telefone</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Criado em</th>
                    </tr>
                    ${result.rows
                        .map(
                            (row) => `
                        <tr>
                            <td>${row.id}</td>
                            <td>${row.tipo}</td>
                            <td>${row.data}</td>
                            <td>${row.telefone}</td>
                            <td>${row.nome || "-"}</td>
                            <td>${row.email || "-"}</td>
                            <td>${row.status}</td>
                            <td>${row.created_at}</td>
                        </tr>
                    `,
                        )
                        .join("")}
                </table>
            `;
        res.send(html);
    } catch (err) {
        res.status(500).send("Erro ao buscar reservas");
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
