import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cors()); // permite requisições do frontend

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Criar tabela
const createTable = async () => {
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
};

// Salvar agendamento
app.post("/agendamentos", async (req, res) => {
  const { nome, servico, barbeiro, dia, horario } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO agendamentos (nome, servico, barbeiro, dia, horario) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [nome, servico, barbeiro, dia, horario]
    );
    res.json({ success: true, agendamento: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") { // chave única violada
      res.status(400).json({ success: false, message: "Horário já ocupado" });
    } else {
      console.error(err);
      res.status(500).json({ success: false, message: "Erro no servidor" });
    }
  }
});

// Pegar horários ocupados
app.get("/agendamentos", async (req, res) => {
  const { barbeiro, dia } = req.query;
  try {
    const result = await pool.query(
      "SELECT horario FROM agendamentos WHERE barbeiro = $1 AND dia = $2",
      [barbeiro, dia]
    );
    res.json(result.rows.map(r => r.horario));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
});

// Teste conexão
app.get("/", (req, res) => res.send("Backend Soul Fade rodando!"));

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  await createTable();
  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
};

startServer();
