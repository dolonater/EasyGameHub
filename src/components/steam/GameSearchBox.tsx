import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../ui/Icon";
import TextField from "../ui/TextField";
import StoreDetailDialog from "./StoreDetailDialog";
import { formatPriceCents } from "../../lib/steamCommunity";
import type { SearchResultDto } from "../../lib/steamCommunity";

interface GameSearchBoxProps {
  /** Called when the user picks a search result. */
  onPick: (appId: number, name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Search-by-name input for adding games to the watchlist. Replaces the raw
 * AppID field: type a name, pick a result from the store search dropdown.
 * `onPick` receives the resolved AppID + display name.
 */
export default function GameSearchBox({
  onPick,
  placeholder,
  autoFocus,
  className = "",
}: GameSearchBoxProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailAppId, setDetailAppId] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // Debounced store search (350 ms).
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const list = await invoke<SearchResultDto[]>("search_steam_games", {
          term: query,
        });
        setResults(list.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [term]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (r: SearchResultDto) => {
    onPick(r.appId, r.name);
    setTerm("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <Icon
          name="search"
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <TextField
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              const first = results[0];
              if (first) pick(first);
            }
          }}
          placeholder={placeholder || t("steam.searchPlaceholder", { defaultValue: "搜索 Steam 游戏..." })}
          autoFocus={autoFocus}
          className="pl-8"
        />
        {searching && (
          <Icon
            name="reset"
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <div className="app-surface absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/60 shadow-lg shadow-black/10">
          {results.length === 0 && !searching && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              {t("steam.searchEmpty", { defaultValue: "未找到相关游戏" })}
            </div>
          )}
          {results.map((r) => (
            <div
              key={r.appId}
              className="flex w-full items-center gap-1 px-3 py-1.5 transition-colors hover:bg-secondary/50"
            >
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex min-w-0 flex-1 items-center gap-3 py-0.5 text-left"
              >
                {r.tinyImage ? (
                  <img src={r.tinyImage} alt="" className="h-7 w-12 flex-none rounded object-cover" />
                ) : (
                  <div className="flex h-7 w-12 flex-none items-center justify-center rounded bg-secondary/40 text-muted-foreground">
                    <Icon name="steamInventory" size={13} />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                {r.finalPrice != null && r.finalPrice > 0 && (
                  <span className="flex-none text-xs text-muted-foreground">
                    {formatPriceCents(r.finalPrice, r.currency)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDetailAppId(r.appId)}
                className="flex-none rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={t("steam.storeDetail", { defaultValue: "商店详情" })}
              >
                <Icon name="info" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <StoreDetailDialog appId={detailAppId} onClose={() => setDetailAppId(null)} />
    </div>
  );
}
