import express from "express";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();

// Middleware
app.use(express.json());

// CORS global na mão
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
// Configuração do banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // necessário no Render
});

// Criar tabela caso não exista
const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        servico VARCHAR(100) NOT NULL,
        barbeiro VARCHAR(100) NOT NULL,
        dia DATE NOT NULL,
        horario VARCHAR(10) NOT NULL,
        UNIQUE (barbeiro, dia, horario)
      );
    `);
    console.log("Tabela 'agendamentos' pronta!");
  } catch (err) {
    console.error("Erro ao criar tabela:", err);
  }
};

// Rotas

// Teste do backend
app.get("/", (req, res) => {
  res.send("Backend Soul Fade rodando! 🚀");
});

// Salvar agendamento
app.post("/agendamentos", async (req, res) => {
  const { nome, servico, barbeiro, dia, horario } = req.body;
  if (!nome || !servico || !barbeiro || !dia || !horario) {
    return res.status(400).json({ success: false, message: "Todos os campos são obrigatórios" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO agendamentos (nome, servico, barbeiro, dia, horario)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, servico, barbeiro, dia, horario]
    );
    res.json({ success: true, agendamento: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      res.status(400).json({ success: false, message: "Horário já ocupado" });
    } else {
      console.error("Erro ao salvar agendamento:", err);
      res.status(500).json({ success: false, message: "Erro no servidor" });
    }
  }
});

// Listar horários ocupados
app.get("/agendamentos", async (req, res) => {
  const { barbeiro, dia } = req.query;
  if (!barbeiro || !dia) {
    return res.status(400).json({ success: false, message: "Barbeiro e dia são obrigatórios" });
  }

  try {
    const result = await pool.query(
      "SELECT horario FROM agendamentos WHERE barbeiro = $1 AND dia = $2 ORDER BY horario",
      [barbeiro, dia]
    );
    res.json(result.rows.map(r => r.horario));
  } catch (err) {
    console.error("Erro ao buscar agendamentos:", err);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
});

// Inicializar servidor
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  await createTable();
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
};

startServer();
