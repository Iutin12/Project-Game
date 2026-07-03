import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import {
  createCrocodileRoom,
  getCrocodileRoomInfo,
  getCrocodileStats,
  registerCrocodileRoomSockets
} from "./crocodileRooms";
import { createDevRoom, createRoom, getRoom, getStats, registerRoomSockets } from "./rooms";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/create-room") {
      const body = await readJsonBody<{ gameId?: "mafia" | "crocodile"; visibility?: "private" | "public" }>(req);
      const visibility = body?.visibility === "public" ? "public" : "private";
      const room = body?.gameId === "crocodile" ? createCrocodileRoom(visibility) : createRoom(visibility);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dev/create-mafia-test-room") {
      const room = createDevRoom();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(getCombinedStats()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/room-info") {
      const code = url.searchParams.get("code")?.toUpperCase();
      const mafiaRoom = code ? getRoom(code) : undefined;
      const crocodileRoom = code ? getCrocodileRoomInfo(code) : undefined;
      const roomInfo = mafiaRoom
        ? { code: mafiaRoom.code, gameId: mafiaRoom.gameId, phase: mafiaRoom.phase }
        : crocodileRoom;

      if (!roomInfo) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Комната не найдена" }));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(roomInfo));
      return;
    }

    await handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io"
  });

  registerRoomSockets(io);
  registerCrocodileRoomSockets(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Project Game is running on http://localhost:${port}`);
  });
});

function getCombinedStats() {
  const mafiaStats = getStats();
  const crocodileStats = getCrocodileStats();

  return {
    roomsCreatedToday: mafiaStats.roomsCreatedToday + crocodileStats.roomsCreatedToday,
    activeRooms: mafiaStats.activeRooms + crocodileStats.activeRooms,
    onlinePlayers: mafiaStats.onlinePlayers + crocodileStats.onlinePlayers,
    publicRooms: [...mafiaStats.publicRooms, ...crocodileStats.publicRooms].sort(
      (first, second) => second.createdAt - first.createdAt
    )
  };
}

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
