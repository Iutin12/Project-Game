import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { createDevRoom, createRoom, getStats, registerRoomSockets } from "./rooms";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/create-room") {
      const room = createRoom();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "POST" && req.url === "/api/dev/create-mafia-test-room") {
      const room = createDevRoom();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "GET" && req.url === "/api/stats") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(getStats()));
      return;
    }

    await handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io"
  });

  registerRoomSockets(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Project Game is running on http://localhost:${port}`);
  });
});
