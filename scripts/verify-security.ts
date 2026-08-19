import { allowRoomCreation, securityConfig } from "../server/security";

async function main() {
  const globalLimit = securityConfig.roomCreationGlobalPerSecond;
  const uniqueAttempts = Array.from({ length: globalLimit }, (_, index) => allowRoomCreation(`unique-ip-${index}`));
  if (uniqueAttempts.some((attempt) => !attempt.allowed)) throw new Error("Global limit rejected an allowed room creation.");
  if (allowRoomCreation("global-overflow").allowed) throw new Error("Global room creation limit was not applied.");

  await waitForNextSecond();
  const ip = "single-ip";
  for (let index = 0; index < securityConfig.roomCreationPerMinute; index += 1) {
    if (index > 0 && index % globalLimit === 0) await waitForNextSecond();
    if (!allowRoomCreation(ip).allowed) throw new Error("Rate limit rejected an allowed request too early.");
  }
  await waitForNextSecond();
  if (allowRoomCreation(ip).allowed) throw new Error("Per-IP room creation limit was not applied.");

  console.log(JSON.stringify({ ok: true, roomCreationPerMinute: securityConfig.roomCreationPerMinute, roomCreationGlobalPerSecond: globalLimit }));
}

function waitForNextSecond() {
  return new Promise((resolve) => setTimeout(resolve, 1_050));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
