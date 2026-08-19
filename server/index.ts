import { createServer } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { timingSafeEqual } from "node:crypto";
import next from "next";
import { Server } from "socket.io";
import { allowPublicApiRequest, allowRoomCreation, getRequestIp, registerSocketProtection, securityConfig } from "./security";
import {
  createCrocodileRoom,
  getCrocodileRoomCount,
  getCrocodileRoomInfo,
  getCrocodileStats,
  registerCrocodileRoomSockets
} from "./crocodileRooms";
import {
  createBunkerRoom,
  createDevBunkerRoom,
  getBunkerRoomCount,
  getBunkerRoomInfo,
  getBunkerStats,
  registerBunkerRoomSockets
} from "./bunkerRooms";
import { createDevRoom, createRoom, getMafiaRoomCount, getRoom, getStats, registerRoomSockets } from "./rooms";
import { createDevSpyRoom, createSpyRoom, getSpyRoomCount, getSpyRoomInfo, getSpyStats, registerSpyRoomSockets } from "./spyRooms";
import { createAliasRoom, createDevAliasRoom, getAliasRoomCount, getAliasRoomInfo, getAliasStats, registerAliasRoomSockets } from "./aliasRooms";
import { getCompletionStats } from "./completionStats";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const devToolsEnabled = dev || process.env.ENABLE_DEV_TOOLS === "true";
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "https://game.24lumio.ru").split(",").map((value) => value.trim()).filter(Boolean);
const allowedHosts = new Set(
  allowedOrigins.flatMap((origin) => {
    try {
      return [new URL(origin).host.toLowerCase()];
    } catch {
      return [];
    }
  })
);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/create-room") {
      if (!allowNewRoom(req, res)) return;

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

    if (req.method === "POST" && url.pathname.startsWith("/api/dev/") && !devToolsEnabled) {
      sendJson(res, 403, {
        error: "Тестовые комнаты отключены на сервере. Включите ENABLE_DEV_TOOLS=true, чтобы использовать этот режим."
      });
      return;
    }

    if (devToolsEnabled && req.method === "POST" && url.pathname === "/api/dev/create-mafia-test-room") {
      if (!allowNewRoom(req, res)) return;
      const room = createDevRoom();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (devToolsEnabled && req.method === "POST" && url.pathname === "/api/dev/create-bunker-test-room") {
      if (!allowNewRoom(req, res)) return;
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevBunkerRoom(clampDevPlayers(body?.playersCount, 4, 16));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (devToolsEnabled && req.method === "POST" && url.pathname === "/api/dev/create-spy-test-room") {
      if (!allowNewRoom(req, res)) return;
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevSpyRoom(clampDevPlayers(body?.playersCount, 3, 12));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (devToolsEnabled && req.method === "POST" && url.pathname === "/api/dev/create-alias-test-room") {
      if (!allowNewRoom(req, res)) return;
      const body = await readJsonBody<{ playersCount?: number }>(req);
      const room = createDevAliasRoom(clampDevPlayers(body?.playersCount, 4, 12));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(room));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      if (!allowPublicApi(req, res)) return;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(getCombinedStats()));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/completed-games") {
      if (!isAdminRequest(req)) {
        sendJson(res, 401, { error: "Недостаточно прав" });
        return;
      }
      sendJson(res, 200, getCompletionStats());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/room-info") {
      if (!allowPublicApi(req, res)) return;
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
    connectTimeout: 15_000,
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ["GET", "POST"]
    },
    allowRequest: (request, callback) => callback(null, isAllowedSocketRequest(request.headers))
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

function getTotalRoomCount() {
  return getMafiaRoomCount() + getCrocodileRoomCount() + getBunkerRoomCount() + getSpyRoomCount() + getAliasRoomCount();
}

function allowNewRoom(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  if (getTotalRoomCount() >= securityConfig.maxActiveRooms) {
    sendJson(res, 503, { error: "Сервер временно перегружен. Попробуйте создать комнату позже." });
    return false;
  }

  const creation = allowRoomCreation(getRequestIp(req.socket.remoteAddress, req.headers));
  if (creation.allowed) return true;
  res.setHeader("retry-after", String(creation.retryAfterSeconds));
  sendJson(res, 429, { error: "Слишком много созданных комнат. Повторите попытку позже." });
  return false;
}

function clampDevPlayers(value: unknown, min: number, max: number) {
  const playersCount = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 6;
  return Math.min(max, Math.max(min, playersCount));
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

function isAdminRequest(req: import("node:http").IncomingMessage) {
  const expectedToken = process.env.ADMIN_STATS_TOKEN;
  const providedToken = req.headers["x-admin-token"];
  const token = Array.isArray(providedToken) ? providedToken[0] : providedToken;
  if (!expectedToken || !token) return false;
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function allowPublicApi(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const result = allowPublicApiRequest(getRequestIp(req.socket.remoteAddress, req.headers));
  if (result.allowed) return true;
  res.setHeader("retry-after", String(result.retryAfterSeconds));
  sendJson(res, 429, { error: "Слишком много запросов. Повторите позже." });
  return false;
}

function isAllowedOrigin(origin: string | undefined) {
  if (dev) return true;
  return Boolean(origin && allowedOrigins.includes(origin));
}

function isAllowedSocketRequest(headers: IncomingHttpHeaders) {
  if (dev) return true;

  const origin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
  if (origin) return isAllowedOrigin(origin);

  // Some reverse proxies omit Origin during the WebSocket handshake. Accept
  // only the explicitly configured public host in that case.
  const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
  return Boolean(host && allowedHosts.has(host.toLowerCase()));
}
