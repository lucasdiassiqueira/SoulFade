import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

// Configurações para __dirname em módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({ origin: "*" })); // libera geral (pode colocar só o domínio do site se preferir)
app.use(express.json()); // para body JSON

// Banco PostgreSQL (Render fornece DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // necessário no Render
});

// Servir frontend (pasta public/)
app.use(express.static(path.join(__dirname, "public")));

// Rotas API ---------------------

// Teste de API
app.get("/api", (req, res) => {
  res.json({ ok: true, msg: "API funcionando 🚀" });
});

// Listar agendamentos
app.get("/api/agendamentos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM agendamentos ORDER BY dia, horario");
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar agendamentos:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Criar agendamento
app.post("/api/agendamentos", async (req, res) => {
  try {
    const { nome, servico, barbeiro, dia, horario } = req.body;

    if (!nome || !servico || !barbeiro || !dia || !horario) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const result = await pool.query(
      `INSERT INTO agendamentos (nome, servico, barbeiro, dia, horario)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, servico, barbeiro, dia, horario]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // violação de UNIQUE
      return res.status(400).json({ error: "Esse horário já está ocupado" });
    }
    console.error("Erro ao criar agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Supondo que cada serviço tenha valor fixo, você pode criar um objeto:
const valoresServico = {
  "Corte Simples": 50,
  "Corte + Barba": 80,
  "Barba": 30,
  "Corte Especial": 100
};

// Rota para o gerente ver ganhos
app.get("/api/ganhos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM agendamentos ORDER BY dia, horario");
    const agendamentos = result.rows;

    // Calcular 20% de cada serviço
    const ganhos = {};
    agendamentos.forEach(a => {
      const valor = valoresServico[a.servico] || 50; // padrão 50 se não definido
      if (!ganhos[a.barbeiro]) ganhos[a.barbeiro] = 0;
      ganhos[a.barbeiro] += valor * 0.2; // 20%
    });

    res.json(ganhos);
  } catch (err) {
    console.error("Erro ao buscar ganhos:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});


// Fallback: só entra se não for rota de API
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
