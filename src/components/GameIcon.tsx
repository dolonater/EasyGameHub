import { useState } from "react";
import { getSteamCoverUrl, getSteamIconUrl } from "../lib/types";

export default function GameIcon({ steamAppId, name, className = "" }: {
  steamAppId: number | null;
  name: string;
  className?: string;
}) {
  const [fallback, setFallback] = useState(0); // 0=cover, 1=capsule, 2=letter
  const coverUrl = getSteamCoverUrl(steamAppId);
  const capsuleUrl = getSteamIconUrl(steamAppId);

  if (fallback >= 2 || (!coverUrl && !capsuleUrl)) {
    return (
      <div className={`flex items-center justify-center bg-secondary text-muted-foreground font-bold ${className}`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  const url = fallback === 0 ? coverUrl : capsuleUrl;

  return (
    <img
      src={url!}
      alt=""
      className={`object-cover ${className}`}
      loading="lazy"
      onError={() => setFallback(f => f + 1)}
    />
  );
}
