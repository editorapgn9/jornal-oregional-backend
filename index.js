console.log("Iniciando backend...");
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

// Google Sheets
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 5000; // Render usa a porta automática
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos
app.use("/arquivos", express.static(path.join(__dirname, "arquivos")));

const edicoesPath = path.join(__dirname, "edicoes.json");
const contatosPath = path.join(__dirname, "contatos.json");

// ---------------- CONFIG GOOGLE SHEETS ----------------
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "credentials.json"), // credenciais do Google Cloud
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const spreadsheetId = "1tDOxSS_CuCsmqkKMH9NhwPMImv3HfWNuMjHVqNfAwuE"; // <-- substitua pelo ID da sua planilha

async function salvarNoGoogleSheets(nome, email) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const data = [[nome, email, new Date().toISOString()]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A:C", // Nome | Email | Data
    valueInputOption: "USER_ENTERED",
    resource: { values: data },
  });
}

// ---------------- EDIÇÕES ----------------
// GET - lista todas as edições
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

// POST - adiciona uma nova edição
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

// ---------------- CONTATOS ----------------
// POST - salva contato no arquivo + Google Sheets
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

    // Grava no arquivo local
    fs.writeFile(
      contatosPath,
      JSON.stringify(contatos, null, 2),
      { encoding: "utf8" },
      async (err) => {
        if (err) return res.status(500).json({ error: "Erro ao salvar contato" });

        try {
          // Também grava no Google Sheets
          await salvarNoGoogleSheets(nome, email);
          res.json({ message: "Contato salvo com sucesso (JSON + Sheets)" });
        } catch (e) {
          console.error("Erro ao salvar no Google Sheets:", e);
          res.status(500).json({ error: "Erro ao salvar no Google Sheets" });
        }
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend rodando na porta ${PORT}`);
});