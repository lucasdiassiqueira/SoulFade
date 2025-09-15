import express from "express";
import cors from "cors";

const app = express();

// Middleware global de CORS
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // força liberar tudo
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200); // responde preflight
  }
  next();
});

app.get("/", (req, res) => {
  res.json({ ok: true, msg: "CORS funcionando 🚀" });
});

app.get("/agendamentos", (req, res) => {
  res.json({ horarios: ["10:00", "11:00"] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
