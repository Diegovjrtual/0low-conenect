import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

function makeId() {
  return crypto.randomBytes(5).toString("hex");
}

function broadcast(room, data, except = null) {
  for (const client of room.clients.values()) {
    if (client.id !== except && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data));
    }
  }
}

/*
  Compatível com os DOIS formatos:
  1) public/index.html
  2) index.html na raiz
*/
const publicDir = path.join(__dirname, "public");
const rootDir = __dirname;

if (requireDir(publicDir)) {
  app.use(express.static(publicDir));
} else {
  app.use(express.static(rootDir));
}

function requireDir(dir) {
  try {
    return require("fs").existsSync(dir);
  } catch {
    return false;
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/", (req, res) => {
  const fs = require("fs");
  const publicIndex = path.join(publicDir, "index.html");
  const rootIndex = path.join(rootDir, "index.html");
  const index = fs.existsSync(publicIndex) ? publicIndex : rootIndex;

  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(404).send("0low Connect: index.html não encontrado.");
  }
});

wss.on("connection", ws => {
  let room = null;
  let user = null;

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "create") {
      const code = makeId();
      room = {
        code,
        name: String(msg.name || "Meu servidor").slice(0, 40),
        clients: new Map()
      };

      rooms.set(code, room);

      user = {
        id: String(msg.userId || makeId()),
        name: String(msg.userName || "Usuário").slice(0, 24),
        ws
      };

      room.clients.set(user.id, user);

      ws.send(JSON.stringify({
        type: "created",
        server: { code: room.code, name: room.name }
      }));
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.code || "").toLowerCase();
      const target = rooms.get(code);

      if (!target) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Servidor não encontrado."
        }));
        return;
      }

      room = target;

      user = {
        id: String(msg.userId || makeId()),
        name: String(msg.userName || "Usuário").slice(0, 24),
        ws
      };

      const members = [...room.clients.values()].map(x => ({
        id: x.id,
        name: x.name
      }));

      room.clients.set(user.id, user);

      ws.send(JSON.stringify({
        type: "joined",
        server: { code: room.code, name: room.name },
        members
      }));

      broadcast(room, {
        type: "user-joined",
        user: { id: user.id, name: user.name }
      }, user.id);

      return;
    }

    if (!room || !user) return;

    if (msg.type === "chat") {
      broadcast(room, {
        type: "chat",
        id: user.id,
        name: user.name,
        text: String(msg.text || "").slice(0, 2000)
      });
      return;
    }

    if (["offer", "answer", "ice"].includes(msg.type)) {
      const target = room.clients.get(String(msg.to));

      if (target?.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          ...msg,
          from: user.id
        }));
      }
      return;
    }

    if (msg.type === "leave-call") {
      broadcast(room, {
        type: "call-left",
        id: user.id
      }, user.id);
    }
  });

  ws.on("close", () => {
    if (!room || !user) return;

    room.clients.delete(user.id);

    broadcast(room, {
      type: "user-left",
      id: user.id
    }, user.id);

    if (room.clients.size === 0) {
      rooms.delete(room.code);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`0low Connect online na porta ${PORT}`);
});