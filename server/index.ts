import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { allowRoomCreation, getRequestIp, registerSocketProtection, securityConfig } from "./security";
import {
  createCrocodileRoom,
  getCrocodileRoomInfo,
  getCrocodileStats,
  registerCrocodileRoomSockets
} from "./crocodileRooms";
import {
  createBunkerRoom,
  createDevBunkerRoom,
  getBunkerRoomInfo,
  getBunkerStats,
  registerBunkerRoomSockets
} from "./bunkerRooms";
import { createDevRoom, createRoom, getRoom, getStats, registerRoomSockets } from "./rooms";
import { createDevSpyRoom, createSpyRoom, getSpyRoomInfo, getSpyStats, registerSpyRoomSockets } from "./spyRooms";
import { createAliasRoom, createDevAliasRoom, getAliasRoomInfo, getAliasStats, registerAliasRoomSockets } from "./aliasRooms";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/create-room") {
      const activeRooms = getCombinedStats().activeRooms;
      if (activeRooms >= securityConfig.maxActiveRooms) {
        sendJson(res, 503, { error: "Сервер временно перегружен. Попробуйте создать комнату позже." });
        return;
      }

      const creation = allowRoomCreation(getRequestIp(req.socket.remoteAddress, req.headers));
      if (!creation.allowed) {
        res.setHeader("retry-after", String(creation.retryAfterSeconds));
        sendJson(res, 429, { error: "Слишком много созданных комнат. Повторите попытку позже." });
        return;
      }

      const body = await readJsonBody<{ gameId?: "mafia" | "crocodile" | "bunker" | "spy" | "alias"; visibility?: "private" | "public" }>(req);
      const visibility = body?.visibility === "public" ? "public" : "private";
      const room =
        body?.gameId === "crocodile"
          ? createCrocodileRoom(visibility)
          : body?.gameId === "bunker"
            ? createBunkerRoom(visibility)
            : body?.gameId === "spy"
              ? createSpyRoom(visibility)
              : body?.gameId === "alias"
                ? createAliasRoom(visibility)
                : createRoom(visibility);
      sendJson(res, 200, room);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dev/create-mafia-test-room") {
      const room = createDevRoom();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dev/create-bunker-test-room") {
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevBunkerRoom(body?.playersCount ?? 6);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dev/create-spy-test-room") {
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevSpyRoom(body?.playersCount ?? 6);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dev/create-alias-test-room") {
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevAliasRoom(body?.playersCount ?? 6);
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
      const bunkerRoom = code ? getBunkerRoomInfo(code) : undefined;
      const spyRoom = code ? getSpyRoomInfo(code) : undefined;
      const aliasRoom = code ? getAliasRoomInfo(code) : undefined;
      const roomInfo = mafiaRoom
        ? { code: mafiaRoom.code, gameId: mafiaRoom.gameId, phase: mafiaRoom.phase }
        : crocodileRoom ?? bunkerRoom ?? spyRoom ?? aliasRoom;

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
    path: "/socket.io",
    maxHttpBufferSize: 10_000,
    connectTimeout: 15_000
  });

  registerSocketProtection(io);

  registerRoomSockets(io);
  registerCrocodileRoomSockets(io);
  registerBunkerRoomSockets(io);
  registerSpyRoomSockets(io);
  registerAliasRoomSockets(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Project Game is running on http://localhost:${port}`);
  });
});

function getCombinedStats() {
  const mafiaStats = getStats();
  const crocodileStats = getCrocodileStats();
  const bunkerStats = getBunkerStats();
  const spyStats = getSpyStats();
  const aliasStats = getAliasStats();

  return {
    roomsCreatedToday: mafiaStats.roomsCreatedToday + crocodileStats.roomsCreatedToday + bunkerStats.roomsCreatedToday + spyStats.roomsCreatedToday + aliasStats.roomsCreatedToday,
    activeRooms: mafiaStats.activeRooms + crocodileStats.activeRooms + bunkerStats.activeRooms + spyStats.activeRooms + aliasStats.activeRooms,
    onlinePlayers: mafiaStats.onlinePlayers + crocodileStats.onlinePlayers + bunkerStats.onlinePlayers + spyStats.onlinePlayers + aliasStats.onlinePlayers,
    publicRooms: [...mafiaStats.publicRooms, ...crocodileStats.publicRooms, ...bunkerStats.publicRooms, ...spyStats.publicRooms, ...aliasStats.publicRooms].sort(
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

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
