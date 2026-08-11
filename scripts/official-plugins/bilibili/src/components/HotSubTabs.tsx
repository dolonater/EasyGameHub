import React, { Button } from "sdk";

export type HotSubMode = "all" | "ranking" | "weekly" | "precious";

interface HotSubTabsProps {
  sub: HotSubMode;
  onSub(sub: HotSubMode): void;
}

const SUBS: Array<{ key: HotSubMode; label: string }> = [
  { key: "all", label: "综合热门" },
  { key: "ranking", label: "排行榜" },
  { key: "weekly", label: "每周必看" },
  { key: "precious", label: "入站必刷" },
];

export function HotSubTabs({ sub, onSub }: HotSubTabsProps) {
  return (
    <div className="bili-hot-subtabs" role="tablist" aria-label="热门分类">
      {SUBS.map((item) => (
        <Button
          key={item.key}
          aria-selected={sub === item.key}
          className={sub === item.key ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
          variant="ghost"
          size="sm"
          role="tab"
          type="button"
          onClick={() => onSub(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
