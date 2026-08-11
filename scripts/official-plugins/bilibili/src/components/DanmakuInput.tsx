import React, { Button, TextField, useEffect, useState } from "sdk";
import { errorMessage } from "../runtime";
import type { BiliDanmakuItem, BiliVideoDetail, BiliVideoPage, PluginSdk } from "../types";

interface DanmakuInputProps {
  detail: BiliVideoDetail;
  disabled: boolean;
  hidden: boolean;
  sdk: PluginSdk | null;
  selectedPage: BiliVideoPage | null;
  videoRef: { current: HTMLVideoElement | null };
  onSent(item: BiliDanmakuItem): void;
}

const maxDanmakuLength = 100;
const cooldownSeconds = 4;

export function DanmakuInput({
  detail,
  disabled,
  hidden,
  sdk,
  selectedPage,
  videoRef,
  onSent,
}: DanmakuInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const text = message.trim();
  const canSend = Boolean(sdk && selectedPage && text && !disabled && !sending && cooldown <= 0);

  return (
    <form className="bili-danmaku-input" onSubmit={submit}>
      <TextField
        disabled={disabled || sending}
        maxLength={maxDanmakuLength}
        placeholder={disabled ? "登录后发送弹幕" : "发一条友善的弹幕"}
        type="text"
        value={message}
        onChange={(event: any) => setMessage(event.currentTarget.value.slice(0, maxDanmakuLength))}
      />
      <span className="bili-danmaku-count">
        {message.length}/{maxDanmakuLength}
      </span>
      <Button disabled={!canSend} size="sm" type="submit">
        {sending ? "发送中" : cooldown > 0 ? `${cooldown}s` : "发送"}
      </Button>
    </form>
  );

  function submit(event: Event) {
    event.preventDefault();
    if (!sdk || !selectedPage || !canSend) return;

    const progress = currentProgress();
    setSending(true);
    sdk.bilibili.danmaku
      .send({
        aid: detail.aid,
        bvid: detail.bvid,
        cid: selectedPage.cid,
        message: text,
        progress,
      })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "弹幕发送失败");
        onSent({
          id: `local-${Date.now()}`,
          time: progress / 1000,
          text,
          color: "#ffffff",
          mode: 1,
          fontSize: 25,
          timestamp: Math.floor(Date.now() / 1000),
        });
        setMessage("");
        setCooldown(cooldownSeconds);
        sdk.ui.notify(hidden ? "弹幕已发送，当前弹幕显示已关闭" : "弹幕已发送");
      })
      .catch((error) => {
        sdk.ui.notify(errorMessage(error));
      })
      .finally(() => {
        setSending(false);
      });
  }

  function currentProgress() {
    const time = videoRef.current?.currentTime ?? 0;
    if (!Number.isFinite(time) || time < 0) return 0;
    return Math.max(0, Math.floor(time * 1000));
  }
}
