import { allowRoomCreation, securityConfig } from "../server/security";

const attempts = Array.from({ length: securityConfig.roomCreationPerMinute }, (_, index) => allowRoomCreation(`test-${index}`));
if (attempts.some((attempt) => !attempt.allowed)) throw new Error("A unique IP should be allowed to create its first room.");

const ip = "single-ip";
for (let index = 0; index < securityConfig.roomCreationPerMinute; index += 1) {
  if (!allowRoomCreation(ip).allowed) throw new Error("Rate limit rejected an allowed request too early.");
}
if (allowRoomCreation(ip).allowed) throw new Error("Room creation limit was not applied.");

console.log(JSON.stringify({ ok: true, roomCreationPerMinute: securityConfig.roomCreationPerMinute }));
