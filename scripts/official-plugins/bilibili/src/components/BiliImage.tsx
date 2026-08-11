import React, { useEffect, useState } from "sdk";
import { getState } from "../runtime";

interface BiliImageProps {
  src?: string;
  fallbackSrc?: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function BiliImage({ src, fallbackSrc, alt = "", className, loading }: BiliImageProps) {
  const [displaySrc, setDisplaySrc] = useState("");

  useEffect(() => {
    let active = true;
    const candidates = unique([src, fallbackSrc].filter(Boolean) as string[]);
    const sdk = getState().sdk;
    setDisplaySrc("");

    void (async () => {
      for (const rawUrl of candidates) {
        if (!needsProxy(rawUrl)) {
          if (active) setDisplaySrc(rawUrl);
          return;
        }
        if (!sdk) continue;
        try {
          const url = await sdk.bilibili.cache.coverProxyUrl(rawUrl);
          if (active && url) {
            setDisplaySrc(url);
            return;
          }
        } catch {
          // Try the next candidate instead of falling back to a raw Bilibili URL.
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [src, fallbackSrc]);

  if (!displaySrc) return null;

  return (
    <img
      alt={alt}
      className={className}
      loading={loading}
      src={displaySrc}
      onError={() => {
        if (fallbackSrc && !needsProxy(fallbackSrc) && displaySrc !== fallbackSrc) {
          setDisplaySrc(fallbackSrc);
        } else {
          setDisplaySrc("");
        }
      }}
    />
  );
}

function unique(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function needsProxy(rawUrl: string) {
  try {
    const url = new URL(rawUrl, window.location.href);
    const host = url.hostname.toLowerCase();
    return host.endsWith("hdslb.com") || host.endsWith("bilibili.com");
  } catch {
    return false;
  }
}
