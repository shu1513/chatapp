"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

export function CallRoom({
  token,
  serverUrl,
  slotEndIso,
}: {
  token: string;
  serverUrl: string;
  slotEndIso: string;
}) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(slotEndIso).getTime();
    const tick = () =>
      setRemainingSec(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [slotEndIso]);

  const warn = remainingSec !== null && remainingSec <= 120;
  const mmss =
    remainingSec !== null
      ? `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`
      : "";

  return (
    <div className="flex h-screen flex-col" data-lk-theme="default">
      <div
        className={`px-4 py-2 text-center text-sm ${
          warn ? "bg-red-600 text-white" : "bg-gray-900 text-gray-300"
        }`}
      >
        {remainingSec === 0
          ? "Time is up — the call is ending."
          : warn
            ? `Call ends in ${mmss}`
            : `Time remaining: ${mmss}`}
      </div>
      <div className="min-h-0 flex-1">
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          video
          audio
          onDisconnected={() => {
            window.location.href = "/bookings";
          }}
          style={{ height: "100%" }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}
