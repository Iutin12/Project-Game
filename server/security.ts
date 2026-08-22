import type { IncomingHttpHeaders } from "node:http";
import type { Server, Socket } from "socket.io";

type RateBucket = { startedAt: number; count: number };

class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(private readonly windowMs: number) {}

  consume(key: string, limit: number) {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    const activeBucket = !bucket || now - bucket.startedAt >= this.windowMs ? { startedAt: now, count: 0 } : bucket;
    activeBucket.count += 1;
    this.buckets.set(key, activeBucket);

    if (this.buckets.size > 10_000) this.removeExpired(now);

    return {
      allowed: activeBucket.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (now - activeBucket.startedAt)) / 1_000))
    };
  }

  private removeExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.startedAt >= this.windowMs) this.buckets.delete(key);
    }
  }
}

export const securityConfig = {
  maxActiveRooms: envInteger("MAX_ACTIVE_ROOMS", 500, 1, 100_000),
  roomCreationPerMinute: envInteger("ROOM_CREATION_LIMIT_PER_MINUTE", 10, 1, 1_000),
  roomCreationGlobalPerSecond: envInteger("ROOM_CREATION_GLOBAL_PER_SECOND", 5, 1, 1_000),
  socketConnectionsPerMinute: envInteger("SOCKET_CONNECTIONS_PER_MINUTE", 60, 1, 10_000),
  maxSocketsPerIp: envInteger("MAX_SOCKETS_PER_IP", 12, 1, 10_000),
  maxSockets: envInteger("MAX_SOCKET_CONNECTIONS", 2_000, 1, 100_000),
  socketEventsPerTenSeconds: envInteger("SOCKET_EVENTS_PER_10_SECONDS", 120, 1, 10_000),
  chatMessagesPerTenSeconds: envInteger("CHAT_MESSAGES_PER_10_SECONDS", 12, 1, 1_000),
  trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === "true"
};

const roomCreationsByIp = new FixedWindowRateLimiter(60_000);
const roomCreationsGlobal = new FixedWindowRateLimiter(1_000);
const publicApiByIp = new FixedWindowRateLimiter(60_000);

export function getRequestIp(remoteAddress: string | undefined, headers: IncomingHttpHeaders) {
  if (securityConfig.trustProxyHeaders) {
    // Nginx Proxy Manager owns X-Real-IP. X-Forwarded-For can be pre-populated by a client.
    const realIp = headers["x-real-ip"];
    const trustedIp = Array.isArray(realIp) ? realIp[0] : realIp;
    if (trustedIp?.trim()) return trustedIp.trim();
  }

  return remoteAddress || "unknown";
}

export function allowRoomCreation(ip: string) {
  const ipResult = roomCreationsByIp.consume(ip, securityConfig.roomCreationPerMinute);
  if (!ipResult.allowed) return ipResult;
  return roomCreationsGlobal.consume("all", securityConfig.roomCreationGlobalPerSecond);
}

export function allowPublicApiRequest(ip: string) {
  return publicApiByIp.consume(ip, 60);
}

export function registerSocketProtection(io: Server) {
  const connectionAttempts = new FixedWindowRateLimiter(60_000);
  const eventLimiter = new FixedWindowRateLimiter(10_000);
  const chatLimiter = new FixedWindowRateLimiter(10_000);
  const socketsByIp = new Map<string, number>();

  io.use((socket, next) => {
    const ip = getRequestIp(socket.handshake.address, socket.handshake.headers);
    const attempt = connectionAttempts.consume(ip, securityConfig.socketConnectionsPerMinute);
    const activeForIp = socketsByIp.get(ip) ?? 0;

    if (!attempt.allowed) return next(new Error("Слишком много попыток подключения. Повторите через минуту."));
    if (activeForIp >= securityConfig.maxSocketsPerIp) return next(new Error("Слишком много подключений с этого адреса."));
    if (io.of("/").sockets.size >= securityConfig.maxSockets) return next(new Error("Сервер временно перегружен."));

    socket.data.clientIp = ip;
    socketsByIp.set(ip, activeForIp + 1);
    next();
  });

  io.on("connection", (socket) => {
    socket.use((packet, next) => {
      const eventName = String(packet[0] ?? "");
      const payload = packet[1];
      const hasPayload = packet.length > 1;
      const isObject = typeof payload === "object" && payload !== null && !Array.isArray(payload);
      const isJoinEvent = eventName.startsWith("join_");

      if ((hasPayload && !isObject) || (isJoinEvent && (!isObject || typeof (payload as Record<string, unknown>).code !== "string" || typeof (payload as Record<string, unknown>).name !== "string"))) {
        return next(new Error("Некорректные данные запроса."));
      }
      const ip = String(socket.data.clientIp ?? "unknown");
      const limiter = eventName.startsWith("send_") ? chatLimiter : eventLimiter;
      const limit = eventName.startsWith("send_") ? securityConfig.chatMessagesPerTenSeconds : securityConfig.socketEventsPerTenSeconds;
      const result = limiter.consume(`${ip}:${eventName.startsWith("send_") ? "chat" : "events"}`, limit);

      if (!result.allowed) return next(new Error("Слишком много запросов. Попробуйте немного позже."));
      next();
    });

    socket.once("disconnect", () => {
      const ip = String(socket.data.clientIp ?? "unknown");
      const current = socketsByIp.get(ip) ?? 0;
      if (current <= 1) socketsByIp.delete(ip);
      else socketsByIp.set(ip, current - 1);
    });
  });
}

function envInteger(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}
