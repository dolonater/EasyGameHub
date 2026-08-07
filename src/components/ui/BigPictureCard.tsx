import React, { useState, useEffect, useRef } from "react";

interface BigPictureCardProps {
  steamAppId: number | null;
  name: string;
  playtime?: string;
  focused?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Big Picture mode cover card.
 * Hover: scale up + glow shadow. Focused: ring + stronger glow.
 * Name + playtime always visible at bottom via subtle gradient overlay.
 */
export default function BigPictureCard({
  steamAppId,
  name,
  playtime,
  focused = false,
  onClick,
  className = "",
  style,
}: BigPictureCardProps) {
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focused]);

  return (
    <div
      ref={ref}
      className={`relative rounded-lg overflow-hidden cursor-pointer select-none transition-all duration-300 ${
        focused
          ? "ring-2 ring-primary scale-[1.04] shadow-[0_0_40px_rgba(124,58,237,0.2)] z-10"
          : "hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] hover:z-[5]"
      } ${className}`}
      onClick={onClick}
      style={style}
    >
      {/* Cover image — no desaturation, always full color */}
      <div className="aspect-[600/900] bg-secondary/20 relative">
        {steamAppId && !imgError ? (
          <img
            src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_600x900.jpg`}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/10">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Thin bottom gradient for name readability */}
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none">
          <h3 className="text-white text-sm font-semibold truncate leading-tight drop-shadow-md">{name}</h3>
          {playtime && (
            <p className="text-white/70 text-[11px] mt-0.5 drop-shadow-md">{playtime}</p>
          )}
        </div>
      </div>
    </div>
  );
}
