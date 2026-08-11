import React, { Button, Toggle, useState } from "sdk";
import { MenuPopover } from "./MenuPopover";

interface CoinPanelProps {
  busy: boolean;
  onClose(): void;
  onSubmit(multiply: 1 | 2, alsoLike: boolean): void;
  style?: Record<string, string | number>;
  triggerRef?: { current: HTMLElement | null };
}

export function CoinPanel({ busy, onClose, onSubmit, style, triggerRef }: CoinPanelProps) {
  const [multiply, setMultiply] = useState<1 | 2>(1);
  const [alsoLike, setAlsoLike] = useState(true);

  return (
    <MenuPopover onClose={onClose} style={style} triggerRef={triggerRef}>
      <div className="bili-menu-heading">
        <strong>投币支持</strong>
        <button className="bili-menu-close" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="bili-segment-row">
        <button
          className={multiply === 1 ? "bili-segment bili-segment-active" : "bili-segment"}
          disabled={busy}
          type="button"
          onClick={() => setMultiply(1)}
        >
          1 个
        </button>
        <button
          className={multiply === 2 ? "bili-segment bili-segment-active" : "bili-segment"}
          disabled={busy}
          type="button"
          onClick={() => setMultiply(2)}
        >
          2 个
        </button>
      </div>
      <label className="bili-toggle-line">
        <Toggle on={alsoLike} onChange={(value: boolean) => setAlsoLike(value)} />
        <span>同时点赞</span>
      </label>
      <Button disabled={busy} size="sm" type="button" onClick={() => onSubmit(multiply, alsoLike)}>
        {busy ? "提交中" : "确认投币"}
      </Button>
    </MenuPopover>
  );
}
