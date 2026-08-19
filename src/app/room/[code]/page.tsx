import { RoomRouterClient } from "./room-router-client";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomRouterClient code={code.toUpperCase()} />;
}
