import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.get("/api/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));

function id() { return crypto.randomBytes(5).toString("hex"); }

function broadcast(room, message, exceptId=null) {
  for (const client of room.clients.values()) {
    if (client.id !== exceptId && client.ws.readyState === 1)
      client.ws.send(JSON.stringify(message));
  }
}

wss.on("connection", ws => {
  let room = null, user = null;

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === "create") {
      const code = id();
      room = { code, name: String(m.name || "Meu servidor").slice(0, 40), clients: new Map() };
      rooms.set(code, room);
      user = { id: String(m.userId), name: String(m.userName || "Usuário").slice(0, 24), ws };
      room.clients.set(user.id, user);
      ws.send(JSON.stringify({ type:"created", server:{code,name:room.name} }));
      return;
    }

    if (m.type === "join") {
      const target = rooms.get(String(m.code || "").toLowerCase());
      if (!target) {
        ws.send(JSON.stringify({type:"error", message:"Servidor não encontrado. Crie um servidor primeiro ou use o código correto."}));
        return;
      }
      room = target;
      user = { id:String(m.userId), name:String(m.userName||"Usuário").slice(0,24), ws };
      const existing = [...room.clients.values()].map(x=>({id:x.id,name:x.name}));
      room.clients.set(user.id,user);
      ws.send(JSON.stringify({type:"joined",server:{code:room.code,name:room.name},members:existing}));
      broadcast(room,{type:"user-joined",user:{id:user.id,name:user.name}},user.id);
      return;
    }

    if (!room || !user) return;

    if (m.type === "chat") {
      broadcast(room,{type:"chat",id:user.id,name:user.name,text:String(m.text||"").slice(0,2000)},null);
      return;
    }

    if (["offer","answer","ice"].includes(m.type)) {
      const target=room.clients.get(String(m.to));
      if(target?.ws.readyState===1) target.ws.send(JSON.stringify({...m,from:user.id}));
      return;
    }

    if (m.type === "leave-call") {
      broadcast(room,{type:"call-left",id:user.id},user.id);
      return;
    }
  });

  ws.on("close",()=>{
    if(!room||!user)return;
    room.clients.delete(user.id);
    broadcast(room,{type:"user-left",id:user.id},user.id);
    if(room.clients.size===0) rooms.delete(room.code);
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`0low Connect V3 running on port ${PORT}`));