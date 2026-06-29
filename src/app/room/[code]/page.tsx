import { RoomClient } from "./room-client";

export default function RoomPage({ params }: { params: { code: string } }) {
  return <RoomClient code={params.code.toUpperCase()} />;
}
