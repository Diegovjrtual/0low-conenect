import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const rooms = new Map();

const publicDir = path.join(__dirname, "public");
const rootIndex = path.join(__dirname, "index.html");
const publicIndex = path.join(publicDir, "index.html");

// Serve both layouts. This prevents "Cannot GET /" when files are in the repo root.
app.use(express.static(__dirname));
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

app.get("/", (req, res) => {
  const file = fs.existsSync(rootIndex) ? rootIndex : publicIndex;
  if (fs.existsSync(file)) return res.sendFile(file);
  res.status(404).send("0low Connect: index.html não encontrado.");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

function makeId() {
  return crypto.randomBytes(5).toString("hex");
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(room, data, except = null) {
  for (const client of room.clients.values()) {
    if (client.id !== except) send(client.ws, data);
  }
}

wss.on("connection", ws => {
  let room = null;
  let user = null;

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === "create") {
      const code = makeId();
      room = {
        code,
        name: String(m.name || "Meu servidor").slice(0, 40),
        clients: new Map()
      };
      rooms.set(code, room);

      user = {
        id: String(m.userId || makeId()),
        name: String(m.userName || "Usuário").slice(0, 24),
        ws
      };
      room.clients.set(user.id, user);

      send(ws, { type: "created", server: { code, name: room.name } });
      return;
    }

    if (m.type === "join") {
      const code = String(m.code || "").trim().toLowerCase();
      const target = rooms.get(code);

      if (!target) {
        send(ws, {
          type: "error",
          message: "Servidor não encontrado. O servidor pode ter sido reiniciado; crie outro código."
        });
        return;
      }

      room = target;
      user = {
        id: String(m.userId || makeId()),
        name: String(m.userName || "Usuário").slice(0, 24),
        ws
      };

      const members = [...room.clients.values()].map(x => ({
        id: x.id, name: x.name
      }));

      room.clients.set(user.id, user);

      send(ws, {
        type: "joined",
        server: { code: room.code, name: room.name },
        members
      });

      broadcast(room, {
        type: "user-joined",
        user: { id: user.id, name: user.name }
      }, user.id);
      return;
    }

    if (!room || !user) return;

    if (m.type === "chat") {
      broadcast(room, {
        type: "chat",
        id: user.id,
        name: user.name,
        text: String(m.text || "").slice(0, 2000)
      });
      return;
    }

    if (["offer", "answer", "ice"].includes(m.type)) {
      const target = room.clients.get(String(m.to));
      if (target) send(target.ws, { ...m, from: user.id });
      return;
    }

    if (m.type === "leave-call") {
      broadcast(room, { type: "call-left", id: user.id }, user.id);
    }
  });

  ws.on("close", () => {
    if (!room || !user) return;
    room.clients.delete(user.id);
    broadcast(room, { type: "user-left", id: user.id }, user.id);
    if (room.clients.size === 0) rooms.delete(room.code);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`0low Connect online na porta ${PORT}`);
});
