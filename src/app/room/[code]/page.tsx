import { RoomRouterClient } from "./room-router-client";

export default function RoomPage({ params }: { params: { code: string } }) {
  return <RoomRouterClient code={params.code.toUpperCase()} />;
}
