import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface RunningGameInfo {
  game_id: string;
  start_time: string;
  pid: number;
}

interface PlaytimeInfo {
  game_id: string;
  total_seconds: number;
}

/** Hook: poll running games list and playtimes. */
export default function useRunningGames() {
  const [runningGames, setRunningGames] = useState<Set<string>>(new Set());
  const [playtimes, setPlaytimes] = useState<Map<string, number>>(new Map());
  const [startTimes, setStartTimes] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(() => {
    invoke<RunningGameInfo[]>("get_running_games")
      .then((list) => {
        const ids = new Set(list.map((r) => r.game_id));
        setRunningGames(ids);
        const st = new Map<string, string>();
        list.forEach((r) => st.set(r.game_id, r.start_time));
        setStartTimes(st);
      })
      .catch(() => {});
  }, []);

  const loadPlaytime = useCallback((gameId: string) => {
    invoke<PlaytimeInfo>("get_playtime", { gameId }).then((p) => {
      setPlaytimes((prev) => {
        const next = new Map(prev);
        next.set(p.game_id, p.total_seconds);
        return next;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Listen for backup:completed events to detect game-exit backups
  useEffect(() => {
    const unlisten = listen("backup:completed", (event: any) => {
      if (event.payload?.snapshot?.note === "game_exit") {
        refresh(); // game exited, refresh running status
        if (event.payload?.game_id) {
          loadPlaytime(event.payload.game_id);
        }
      }
    });
    return () => { unlisten.then((fn: any) => fn?.()); };
  }, [refresh, loadPlaytime]);

  return { runningGames, playtimes, startTimes, refresh, loadPlaytime };
}
