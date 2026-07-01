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
      const body = await readJsonBody<{ visibility?: "private" | "public" }>(req);
      const room = createRoom(body?.visibility === "public" ? "public" : "private");
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

function readJsonBody<T>(req: import("node:http").IncomingMessage): Promise<T | undefined> {
  return new Promise((resolve) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });

    req.on("end", () => {
      if (!body) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(body) as T);
      } catch {
        resolve(undefined);
      }
    });

    req.on("error", () => resolve(undefined));
  });
}
