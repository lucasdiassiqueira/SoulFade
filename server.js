import express from "express";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(express.json());

// conecta no banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Render exige SSL
  },
});

// rota teste
app.get("/", (req, res) => {
  res.send("Backend da Soul Fade rodando com PostgreSQL 🚀");
});

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


// rota pra testar conexão
app.get("/dbtest", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ db_time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao conectar no banco");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
