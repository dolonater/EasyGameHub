import React, { Button, useEffect, useRef, useState } from "sdk";
import { errorMessage, getState, markDynamicPublished } from "../runtime";

interface DynamicPublishDialogProps {
  open: boolean;
  onClose(): void;
}

const maxLength = 1000;
const cooldownSeconds = 30;

/** 纯文字动态发布弹层：≤1000 字、30s 冷却、失败保留输入。 */
export function DynamicPublishDialog({ open, onClose }: DynamicPublishDialogProps) {
  const [content, setContent] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!open) return;
    const closeOnDown = (event: MouseEvent) => {
      if (event.target === event.currentTarget) onClose();
    };
    document.addEventListener("mousedown", closeOnDown);
    return () => document.removeEventListener("mousedown", closeOnDown);
  }, [open, onClose]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!open) return null;

  const text = content.trim();
  const canPublish = Boolean(text && !publishing && cooldown <= 0);

  function submit(event: Event) {
    event.preventDefault();
    if (!canPublish) return;
    setPublishing(true);
    const sdk = getState().sdk;
    if (!sdk) {
      setPublishing(false);
      return;
    }
    sdk.bilibili.dynamic
      .createText({ content: text })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "发布失败");
        sdk.ui.notify("动态已发布");
        setContent("");
        setCooldown(cooldownSeconds);
        markDynamicPublished();
        onClose();
      })
      .catch((reason: Error) => {
        sdk.ui.notify(errorMessage(reason));
      })
      .finally(() => setPublishing(false));
  }

  return (
    <div className="bili-dialog-backdrop" onMouseDown={() => onClose()}>
      <form className="bili-dialog" onSubmit={submit} onMouseDown={(event: any) => event.stopPropagation()}>
        <div className="bili-dialog-title">发布动态</div>
        <textarea
          className="bili-dynamic-publish-input"
          value={content}
          maxLength={maxLength}
          placeholder="分享你的动态…"
          onChange={(event: any) => setContent(event.currentTarget.value.slice(0, maxLength))}
        />
        <div className="bili-dynamic-publish-count">
          {content.length}/{maxLength}
        </div>
        <div className="bili-dialog-actions">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" type="submit" disabled={!canPublish}>
            {publishing ? "发布中" : cooldown > 0 ? `${cooldown}s` : "发布"}
          </Button>
        </div>
      </form>
    </div>
  );
}
