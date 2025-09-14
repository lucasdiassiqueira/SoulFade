import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cria pool com conexão segura quando DATABASE_URL existe
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || null,
  // Render exige TLS; em alguns casos é necessário colocar rejectUnauthorized:false
  // (veja nota abaixo sobre SSL). Aqui a flag só é usada se uma DATABASE_URL estiver definida.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Cria tabelas automaticamente (executo no startup)
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      nome_cliente TEXT,
      servico TEXT NOT NULL,
      horario TIMESTAMP NOT NULL,
      status TEXT DEFAULT 'agendado',
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("Tabelas verificadas/criadas.");
}

// Rotas simples
app.get("/api/health", (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || "dev" }));

// Listar agendamentos
app.get("/api/agendamentos", async (req, res) => {
  try {
    const q = await pool.query("SELECT * FROM agendamentos ORDER BY horario ASC");
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// Criar agendamento
app.post("/api/agendamentos", async (req, res) => {
  try {
    const { nome_cliente, servico, horario, telefone, email } = req.body;
    // opcional: criar cliente (simples) — aqui adicionamos apenas ao agendamento
    const q = await pool.query(
      `INSERT INTO agendamentos (nome_cliente, servico, horario) VALUES ($1, $2, $3) RETURNING *`,
      [nome_cliente, servico, horario]
    );
    res.status(201).json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

// Deletar agendamento
app.delete("/api/agendamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM agendamentos WHERE id = $1", [id]);
    res.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar agendamento" });
  }
});

// Inicializa DB e servidor
(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.log("Nenhuma DATABASE_URL detectada — o servidor roda mas sem DB conectado (use .env localmente ou configure no Render).");
    } else {
      console.log("Tentando conectar ao banco...");
    }
    await initDB();
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (err) {
    console.error("Erro na inicialização:", err);
    process.exit(1);
  }
})();
