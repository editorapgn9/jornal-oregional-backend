console.log("Iniciando backend...");
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

// Google Sheets
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

app.use("/arquivos", express.static(path.join(__dirname, "arquivos")));

const edicoesPath = path.join(__dirname, "edicoes.json");
const contatosPath = path.join(__dirname, "contatos.json");

// ---------------- CONFIG GOOGLE SHEETS ----------------
let googleCredentials;
try {
  googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  // Corrige o private_key (recoloca quebras de linha caso o Render tenha escapado)
  if (googleCredentials.private_key) {
    googleCredentials.private_key = googleCredentials.private_key.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error("❌ Erro ao carregar GOOGLE_CREDENTIALS:", err);
}

const auth = new google.auth.GoogleAuth({
  credentials: googleCredentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = "1tDOxSS_CuCsmqkKMH9NhwPMImv3HfWNuMjHVqNfAwuE";

async function salvarNoGoogleSheets(nome, email) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const data = [[nome, email, new Date().toISOString()]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A:C",
    valueInputOption: "USER_ENTERED",
    resource: { values: data },
  });
}

// ---------------- ROTAS ----------------

// GET edições
app.get("/edicoes", (req, res) => {
  fs.readFile(edicoesPath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Erro ao ler edicoes.json" });

    try {
      const edicoes = JSON.parse(data || "[]");
      res.json(edicoes);
    } catch {
      res.status(500).json({ error: "Erro ao processar edicoes.json" });
    }
  });
});

// POST nova edição
app.post("/edicoes", (req, res) => {
  const novaEdicao = req.body;

  if (!novaEdicao.nome || !novaEdicao.link) {
    return res.status(400).json({ error: "Nome e link são obrigatórios" });
  }

  fs.readFile(edicoesPath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Erro ao ler edicoes.json" });

    let edicoes = [];
    try {
      edicoes = JSON.parse(data || "[]");
    } catch {
      return res.status(500).json({ error: "Erro ao processar edicoes.json" });
    }

    edicoes.push(novaEdicao);

    fs.writeFile(edicoesPath, JSON.stringify(edicoes, null, 2), (err) => {
      if (err) return res.status(500).json({ error: "Erro ao salvar edicao" });
      res.json({ message: "Edição adicionada com sucesso" });
    });
  });
});

// POST contato
app.post("/contatos", async (req, res) => {
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: "Nome e e-mail são obrigatórios" });
  }

  fs.readFile(contatosPath, "utf8", async (err, data) => {
    let contatos = [];
    if (!err) {
      try {
        contatos = JSON.parse(data || "[]");
      } catch {
        contatos = [];
      }
    }

    const novoContato = { nome, email, data: new Date().toISOString() };
    contatos.push(novoContato);

    fs.writeFile(
      contatosPath,
      JSON.stringify(contatos, null, 2),
      { encoding: "utf8" },
      async (err) => {
        if (err) return res.status(500).json({ error: "Erro ao salvar contato" });

        try {
          await salvarNoGoogleSheets(nome, email);
          res.json({ message: "Contato salvo com sucesso (JSON + Sheets)" });
        } catch (e) {
          console.error("❌ Erro ao salvar no Google Sheets:", e.message);
          res.status(500).json({ error: "Erro ao salvar no Google Sheets" });
        }
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend rodando na porta ${PORT}`);
});