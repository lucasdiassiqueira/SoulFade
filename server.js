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
app.use(express.static(path.join(__dirname, "public")));

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------- ROTAS API ---------- //

// Teste
app.get("/api", (req, res) => res.json({ ok: true, msg: "API funcionando 🚀" }));

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) return res.status(400).json({ error: "Informe usuário e senha" });

    if (senha === "lucasmanager") return res.json({ ok: true, barbeiro: "lucas", tipo: "gerente" });

    const result = await pool.query(
      "SELECT * FROM barbeiros WHERE usuario = $1 AND senha = $2",
      [usuario, senha]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: "Usuário ou senha inválidos" });

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
    let query = "SELECT * FROM agendamentos";
    const params = [];
    const conditions = [];

    if (barbeiro) { params.push(barbeiro); conditions.push(`barbeiro = $${params.length}`); }
    if (dia) { params.push(dia); conditions.push(`dia = $${params.length}`); }

    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY dia, horario";

    const result = await pool.query(query, params);
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
    if (!nome || !servico || !barbeiro || !dia || !horario) 
      return res.status(400).json({ error: "Dados incompletos" });

    const existe = await pool.query(
      "SELECT * FROM agendamentos WHERE barbeiro=$1 AND dia=$2 AND horario=$3",
      [barbeiro, dia, horario]
    );
    if (existe.rows.length) return res.status(400).json({ error: "Horário já ocupado" });

    const result = await pool.query(
      `INSERT INTO agendamentos (nome, servico, barbeiro, dia, horario)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nome, servico, barbeiro, dia, horario]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Editar agendamento
app.put("/api/agendamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { dia, horario, barbeiro } = req.body;
    if (!dia || !horario || !barbeiro) return res.status(400).json({ error: "Informe barbeiro, dia e horário" });

    const conflito = await pool.query(
      "SELECT * FROM agendamentos WHERE barbeiro=$1 AND dia=$2 AND horario=$3 AND id<>$4",
      [barbeiro, dia, horario, id]
    );
    if (conflito.rows.length) return res.status(400).json({ error: "Horário já ocupado" });

    const result = await pool.query(
      "UPDATE agendamentos SET dia=$1, horario=$2, barbeiro=$3 WHERE id=$4 RETURNING *",
      [dia, horario, barbeiro, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Agendamento não encontrado" });

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
      "DELETE FROM agendamentos WHERE id=$1 RETURNING *",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Agendamento não encontrado" });

    res.json({ ok: true, msg: "Agendamento excluído" });
  } catch (err) {
    console.error("Erro ao excluir agendamento:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Ganhos
const valoresServico = { "Corte Simples":50, "Corte + Barba":80, "Barba":30, "Corte Especial":100 };
app.get("/api/ganhos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM agendamentos");
    const ganhos = {};
    result.rows.forEach(a => {
      const valor = valoresServico[a.servico] || 50;
      ganhos[a.barbeiro] = (ganhos[a.barbeiro] || 0) + valor * 0.2;
    });
    res.json(ganhos);
  } catch (err) {
    console.error("Erro ao buscar ganhos:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// Fallback frontend
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
