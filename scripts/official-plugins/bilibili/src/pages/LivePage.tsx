import React, { useEffect, useRef, useState } from "sdk";
import { openSpace } from "../navigation";
import { LivePlayer } from "../player/livePlayer";
import { errorMessage, getState } from "../runtime";
import type { BiliLiveRoom, BiliLiveStream } from "../types";

interface LivePageProps {
  roomId: number;
}

interface LiveDanmakuEntry {
  id: string;
  type: "danmu" | "gift" | "sc" | "system";
  user: string;
  text: string;
  detail?: string;
}

let danmakuSeq = 0;

function pushDanmaku(
  setter: (update: (prev: LiveDanmakuEntry[]) => LiveDanmakuEntry[]) => void,
  entry: Omit<LiveDanmakuEntry, "id">,
) {
  danmakuSeq += 1;
  setter((prev) => [...prev.slice(-199), { ...entry, id: `dm-${danmakuSeq}` }]);
}

/**
 * 直播间（P6）：房间信息卡 + mpegts.js 播放器 + 弹幕层（本地 WS 桥）
 * + 发送弹幕（30s 冷却）+ 画质切换 + 心跳保活；离开视图清理播放器与 WS。
 */
export function LivePage({ roomId }: LivePageProps) {
  const [room, setRoom] = useState<BiliLiveRoom | null>(null);
  const [stream, setStream] = useState<BiliLiveStream | null>(null);
  const [currentQn, setCurrentQn] = useState<number | null>(null);
  const [danmaku, setDanmaku] = useState<LiveDanmakuEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [input, setInput] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [playError, setPlayError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [qualityOpen, setQualityOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<LivePlayer | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 房间信息 + 直播流
  useEffect(() => {
    let active = true;
    setRoom(null);
    setStream(null);
    setLoadError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    Promise.all([
      sdk.bilibili.live.room({ roomId }),
      sdk.bilibili.live.stream({ roomId }),
    ])
      .then(([roomInfo, streamInfo]) => {
        if (!active) return;
        setRoom(roomInfo);
        setStream(streamInfo);
      })
      .catch((err: Error) => {
        if (active) setLoadError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [roomId]);

  // 播放器：stream 变化（进入 / 切画质）时重建
  useEffect(() => {
    if (!stream || stream.durl.length === 0) return;
    const video = videoRef.current;
    if (!video) return;
    const player = new LivePlayer(video, (message) => setPlayError(message));
    playerRef.current = player;
    player.load(stream.durl[0].url);
    setPlayError("");
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [stream]);

  // 弹幕 WS（本地桥）
  useEffect(() => {
    let ws: WebSocket | null = null;
    let active = true;
    setWsConnected(false);
    setDanmaku([]);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.live
      .danmakuWsUrl({ roomId })
      .then((url) => {
        if (!active) return;
        ws = new WebSocket(url);
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          if (!active) return;
          setWsConnected(false);
          pushDanmaku(setDanmaku, { type: "system", user: "", text: "弹幕连接已断开" });
        };
        ws.onerror = () => {
          if (active) setWsConnected(false);
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const entry = parseDanmakuMessage(message);
            if (entry) pushDanmaku(setDanmaku, entry);
          } catch {
            // 忽略坏帧
          }
        };
      })
      .catch((err: Error) => {
        if (!active) return;
        setWsConnected(false);
        pushDanmaku(setDanmaku, { type: "system", user: "", text: errorMessage(err) });
      });
    return () => {
      active = false;
      if (ws) ws.close();
    };
  }, [roomId]);

  // 心跳保活（HTTP 通道，60s；WS 协议心跳由后端桥内部 30s）
  useEffect(() => {
    const timer = setInterval(() => {
      getState()
        .sdk?.bilibili.live.heartbeat({ roomId })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [roomId]);

  // 弹幕列表自动滚动到底部
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [danmaku]);

  // 发送冷却倒计时
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((count) => count - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function sendDanmaku() {
    const text = input.trim();
    if (!text || cooldown > 0) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setCooldown(30);
    setSendError("");
    sdk.bilibili.live
      .sendDanmaku({ roomId, text })
      .then((result) => {
        if (result.ok) {
          setInput("");
          pushDanmaku(setDanmaku, { type: "danmu", user: "我", text });
        } else {
          setSendError(result.message || "发送失败，请稍后再试");
        }
      })
      .catch((err: Error) => setSendError(errorMessage(err)));
  }

  function switchQuality(qn: number) {
    if (qn === currentQn) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setQualityOpen(false);
    sdk.bilibili.live
      .stream({ roomId, qn })
      .then((next) => {
        setStream(next);
        setCurrentQn(qn);
      })
      .catch((err: Error) => setPlayError(errorMessage(err)));
  }

  const live = room?.liveStatus === 1;

  return (
    <section className="bili-live">
      <div className="bili-live-main">
        <div className="bili-live-player">
          <video ref={videoRef} className="bili-live-video" controls playsInline />
          {playError ? <div className="bili-live-overlay">{playError}</div> : null}
          {loadError ? (
            <div className="bili-live-overlay">
              {loadError}
              <a className="bili-link-button" href={`https://live.bilibili.com/${roomId}`} target="_blank" rel="noreferrer">
                外部打开直播间
              </a>
            </div>
          ) : null}
          {!stream && !loadError ? <div className="bili-live-overlay">正在加载直播间…</div> : null}
        </div>

        {room ? (
          <div className="bili-live-room-card">
            <div className="bili-live-room-head">
              <strong className="bili-live-room-title" title={room.title}>
                {room.title || "未命名直播间"}
              </strong>
              <div className="bili-live-room-meta">
                <span className={live ? "bili-live-room-status bili-live-room-status-on" : "bili-live-room-status"}>
                  {live ? "直播中" : "未开播"}
                </span>
                <span>{formatOnline(room.online)}人观看</span>
                <span>{room.parentAreaName} · {room.areaName}</span>
              </div>
            </div>
            <p className="bili-live-room-desc">{room.description || "暂无简介"}</p>
            <div className="bili-live-room-foot">
              <button type="button" className="bili-live-room-uid" onClick={() => openSpace(room.uid)}>
                UP {room.uid}
              </button>
              <span>{formatCount(room.attention)} 关注</span>
              <a className="bili-link-button" href={`https://live.bilibili.com/${roomId}`} target="_blank" rel="noreferrer">
                外部打开
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="bili-live-side">
        <div className="bili-live-danmaku-head">
          弹幕
          <span className={wsConnected ? "bili-live-ws bili-live-ws-on" : "bili-live-ws"}>{wsConnected ? "已连接" : "未连接"}</span>
        </div>
        <div className="bili-live-danmaku-list" ref={listRef}>
          {danmaku.map((entry) => (
            <div key={entry.id} className={`bili-live-danmaku-item bili-live-danmaku-${entry.type}`}>
              {entry.type === "system" ? (
                <span className="bili-live-danmaku-system">{entry.text}</span>
              ) : (
                <>
                  <strong className="bili-live-danmaku-user">{entry.user}：</strong>
                  <span className="bili-live-danmaku-text">{entry.text}</span>
                  {entry.detail ? <small className="bili-live-danmaku-detail">{entry.detail}</small> : null}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="bili-live-send">
          <input
            className="bili-live-send-input"
            value={input}
            placeholder="发个友善的弹幕"
            maxLength={30}
            onChange={(event: { target: { value: string } }) => setInput(event.target.value)}
            onKeyDown={(event: { key: string }) => {
              if (event.key === "Enter") sendDanmaku();
            }}
          />
          <button
            type="button"
            className="bili-live-send-btn"
            onClick={sendDanmaku}
            disabled={cooldown > 0 || input.trim().length === 0}
          >
            {cooldown > 0 ? `${cooldown}s` : "发送"}
          </button>
        </div>
        {sendError ? <div className="bili-live-send-error">{sendError}</div> : null}
        {stream && stream.qualityDescription.length > 0 ? (
          <div className="bili-live-quality">
            <button
              type="button"
              className="bili-live-quality-btn"
              onClick={() => setQualityOpen((open) => !open)}
            >
              画质 {currentQn ? qualityName(stream, currentQn) : "自动"}
            </button>
            {qualityOpen ? (
              <div className="bili-live-quality-menu">
                {stream.qualityDescription.map((quality) => (
                  <button
                    key={quality.qn}
                    type="button"
                    className={currentQn === quality.qn ? "bili-live-quality-option bili-live-quality-option-active" : "bili-live-quality-option"}
                    onClick={() => switchQuality(quality.qn)}
                  >
                    {quality.desc}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function parseDanmakuMessage(message: { cmd?: string; data?: unknown }): Omit<LiveDanmakuEntry, "id"> | null {
  const cmd = message.cmd || "";
  if (cmd === "DANMU_MSG") {
    const info = (message.data as { info?: unknown[] })?.info;
    const text = Array.isArray(info) && typeof info[1] === "string" ? info[1] : "";
    const user = Array.isArray(info) && Array.isArray(info[2]) && typeof info[2][1] === "string" ? info[2][1] : "弹幕";
    return { type: "danmu", user, text };
  }
  if (cmd === "SEND_GIFT") {
    const data = message.data as { data?: { uname?: string; giftName?: string; num?: number } };
    const payload = data?.data;
    if (!payload) return null;
    return {
      type: "gift",
      user: payload.uname || "神秘用户",
      text: `送出了 ${payload.giftName || "礼物"}${payload.num ? ` ×${payload.num}` : ""}`,
    };
  }
  if (cmd === "SUPER_CHAT_MESSAGE") {
    const data = message.data as { data?: { message?: string; price?: number; user_info?: { uname?: string } } };
    const payload = data?.data;
    if (!payload) return null;
    return {
      type: "sc",
      user: payload.user_info?.uname || "神秘用户",
      text: payload.message || "",
      detail: payload.price ? `¥${payload.price}` : undefined,
    };
  }
  if (cmd === "CONNECTION_ERROR") {
    const data = message.data as { message?: string };
    return { type: "system", user: "", text: data?.message || "弹幕连接失败" };
  }
  if (cmd === "CONNECTION_LOST") {
    return { type: "system", user: "", text: "弹幕连接已断开，稍后自动重连" };
  }
  return null;
}

function qualityName(stream: BiliLiveStream, qn: number): string {
  const quality = stream.qualityDescription.find((item) => item.qn === qn);
  return quality ? quality.desc : String(qn);
}

function formatOnline(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return String(count);
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}
