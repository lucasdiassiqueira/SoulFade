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
app.use(cors({ origin: "*" }));
app.use(express.json());

// Banco PostgreSQL (Render fornece DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Servir frontend (pasta public/)
app.use(express.static(path.join(__dirname, "public")));

// ---------------- ROTAS API ---------------- //

// Teste
app.get("/api", (req, res) => {
  res.json({ ok: true, msg: "API funcionando 🚀" });
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ error: "Informe usuário e senha" });
    }

    if (senha === "lucasmanager") {
      return res.json({ ok: true, barbeiro: "lucas", tipo: "gerente" });
    }

    const result = await pool.query(
      "SELECT * FROM barbeiros WHERE usuario = $1 AND senha = $2",
      [usuario, senha]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    const barbeiro = result.rows[0];
    res.json({ ok: true, barbeiro: barbeiro.usuario, tipo: barbeiro.tipo });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Listar agendamentos
app.get("/api/agendamentos", async (req, res) => {
  try {
    const { barbeiro, dia } = req.query;

    let result;
    if (barbeiro && dia) {
      result = await pool.query(
        "SELECT * FROM agendamentos WHERE barbeiro = $1 AND dia = $2 ORDER BY horario",
        [barbeiro, dia]
      );
    } else if (barbeiro) {
      result = await pool.query(
        "SELECT * FROM agendamentos WHERE barbeiro = $1 ORDER BY dia, horario",
        [barbeiro]
      );
    } else {
      result = await pool.query(
        "SELECT * FROM agendamentos ORDER BY dia, horario"
      );
    }

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
      return res.status(400).json({ error: "Esse horário já está ocupado" });
    }
    console.error("Erro ao criar agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Editar agendamento
app.put("/api/agendamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { dia, horario } = req.body;

    if (!dia || !horario) {
      return res.status(400).json({ error: "Informe dia e horário" });
    }

    const result = await pool.query(
      "UPDATE agendamentos SET dia = $1, horario = $2 WHERE id = $3 RETURNING *",
      [dia, horario, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao editar agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Excluir agendamento
app.delete("/api/agendamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM agendamentos WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    res.json({ ok: true, msg: "Agendamento excluído" });
  } catch (err) {
    console.error("Erro ao excluir agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Serviços e ganhos
const valoresServico = {
  "Corte Simples": 50,
  "Corte + Barba": 80,
  "Barba": 30,
  "Corte Especial": 100,
};

app.get("/api/ganhos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM agendamentos ORDER BY dia, horario");
    const agendamentos = result.rows;

    const ganhos = {};
    agendamentos.forEach((a) => {
      const valor = valoresServico[a.servico] || 50;
      if (!ganhos[a.barbeiro]) ganhos[a.barbeiro] = 0;
      ganhos[a.barbeiro] += valor * 0.2; // 20%
    });

    res.json(ganhos);
  } catch (err) {
    console.error("Erro ao buscar ganhos:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Fallback para frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
