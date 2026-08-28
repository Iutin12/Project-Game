import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type GameId = "mafia" | "crocodile" | "bunker" | "spy" | "alias";
type Device = "mobile" | "tablet" | "desktop";
type EventName = "phase_changed" | "report_opened" | "report_sent";
type Totals = Record<EventName, number>;
type ProductAnalytics = { daily: { date: string; totals: Totals; byGame: Record<GameId, Totals>; devices: Record<Device, number> }; allTime: { totals: Totals; byGame: Record<GameId, Totals>; devices: Record<Device, number> }; updatedAt: number };

const file = process.env.PRODUCT_ANALYTICS_FILE ?? "/app/data/product-analytics.json";
const games: GameId[] = ["mafia", "crocodile", "bunker", "spy", "alias"];
const events: EventName[] = ["phase_changed", "report_opened", "report_sent"];
let analytics = load();

export function trackProductEvent(event: EventName, gameId: GameId, device: Device) {
  ensureToday();
  analytics.daily.totals[event] += 1;
  analytics.daily.byGame[gameId][event] += 1;
  analytics.daily.devices[device] += 1;
  analytics.allTime.totals[event] += 1;
  analytics.allTime.byGame[gameId][event] += 1;
  analytics.allTime.devices[device] += 1;
  analytics.updatedAt = Date.now();
  persist();
}

export function getProductAnalytics() { ensureToday(); return analytics; }

function blankTotals(): Totals { return { phase_changed: 0, report_opened: 0, report_sent: 0 }; }
function blankByGame() { return Object.fromEntries(games.map((game) => [game, blankTotals()])) as Record<GameId, Totals>; }
function blankDevices() { return { mobile: 0, tablet: 0, desktop: 0 } as Record<Device, number>; }
function today() { return new Date().toISOString().slice(0, 10); }
function blank(): ProductAnalytics { return { daily: { date: today(), totals: blankTotals(), byGame: blankByGame(), devices: blankDevices() }, allTime: { totals: blankTotals(), byGame: blankByGame(), devices: blankDevices() }, updatedAt: Date.now() }; }
function ensureToday() { if (analytics.daily.date === today()) return; analytics.daily = { date: today(), totals: blankTotals(), byGame: blankByGame(), devices: blankDevices() }; analytics.updatedAt = Date.now(); persist(); }
function load(): ProductAnalytics { try { const parsed = JSON.parse(readFileSync(file, "utf8")) as ProductAnalytics; return parsed?.allTime && parsed?.daily ? parsed : blank(); } catch { return blank(); } }
function persist() { try { mkdirSync(dirname(file), { recursive: true }); const temporary = `${file}.tmp`; writeFileSync(temporary, JSON.stringify(analytics), "utf8"); renameSync(temporary, file); } catch (error) { console.error("Unable to persist product analytics", error); } }

export function isProductEvent(value: unknown): value is EventName { return typeof value === "string" && events.includes(value as EventName); }
export function isProductGame(value: unknown): value is GameId { return typeof value === "string" && games.includes(value as GameId); }
export function isProductDevice(value: unknown): value is Device { return value === "mobile" || value === "tablet" || value === "desktop"; }
