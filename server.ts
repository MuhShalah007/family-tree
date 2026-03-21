import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = path.join(process.cwd(), 'trees.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadData(): Record<string, any> {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveData(data: Record<string, any>) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API routes
app.post("/api/trees", (req, res) => {
  const data = loadData();
  const id = crypto.randomUUID().split('-')[0]; // short id
  const editKey = crypto.randomUUID().split('-')[0]; // short edit key
  
  data[id] = {
    ...req.body,
    editKey,
    createdAt: new Date().toISOString()
  };
  
  saveData(data);
  res.json({ id, editKey });
});

app.get("/api/trees/:id", (req, res) => {
  const data = loadData();
  const tree = data[req.params.id];
  if (!tree) return res.status(404).json({ error: "Not found" });
  
  // Don't send editKey to client on GET
  const { editKey, ...publicData } = tree;
  res.json(publicData);
});

app.put("/api/trees/:id", (req, res) => {
  const data = loadData();
  const tree = data[req.params.id];
  if (!tree) return res.status(404).json({ error: "Not found" });
  
  const { editKey, treeData } = req.body;
  if (tree.editKey !== editKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  data[req.params.id] = {
    ...tree,
    ...treeData,
    updatedAt: new Date().toISOString()
  };
  
  saveData(data);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
