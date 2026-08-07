import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { glassMenuItemClass, GlassMenuPanel } from "./GlassSurface";

export interface MenuItem {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  sepBefore?: boolean;
  children?: MenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

type SubmenuDirection = "right" | "left";

const MENU_WIDTH = 200;
const ROOT_PANEL_CLASS =
  "fixed z-50 w-fit rounded-[10px] px-[5px] py-[6px] flex flex-col gap-[3px] shadow-xl animate-fade-in border border-border";
const SUBMENU_PANEL_CLASS =
  "absolute top-0 z-[60] w-fit rounded-[10px] px-[5px] py-[6px] flex flex-col gap-[3px] shadow-xl animate-fade-in border border-border";

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [submenuPath, setSubmenuPath] = useState<number[]>([]);
  const [submenuDirections, setSubmenuDirections] = useState<Record<string, SubmenuDirection>>({});
  const [position, setPosition] = useState({ left: x, top: y });
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    setSubmenuPath([]);
    setSubmenuDirections({});
  }, [items]);

  useLayoutEffect(() => {
    setMeasured(false);
    setPosition({ left: x, top: y });
  }, [x, y, items]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const nextLeft = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const nextTop = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));

    setPosition((prev) => (
      prev.left === nextLeft && prev.top === nextTop
        ? prev
        : { left: nextLeft, top: nextTop }
    ));
    setMeasured(true);
  }, [x, y, items]);

  const isPathOpen = (path: number[]) =>
    submenuPath.length >= path.length && path.every((v, idx) => submenuPath[idx] === v);

  const handleHoverPath = (path: number[], button: HTMLButtonElement | null, hasChildren: boolean) => {
    if (!hasChildren) {
      setSubmenuPath(path.slice(0, -1));
      return;
    }

    if (button) {
      const rect = button.getBoundingClientRect();
      const openRight = rect.right + MENU_WIDTH + 16 <= window.innerWidth;
      setSubmenuDirections((prev) => ({
        ...prev,
        [path.join("-")]: openRight ? "right" : "left",
      }));
    }

    setSubmenuPath(path);
  };

  const renderItems = (menuItems: MenuItem[], path: number[] = []): React.ReactNode => (
    <>
      {menuItems.map((item, i) => {
        const nextPath = [...path, i];
        const nextKey = nextPath.join("-");
        const hasChildren = !!item.children?.length;
        const direction = submenuDirections[nextKey] ?? "right";

        return (
          <React.Fragment key={nextKey}>
            {item.sepBefore && (
              <div className="border-t-[1.5px] border-border" />
            )}
            <div className="relative">
              <button
                onMouseEnter={(e) => handleHoverPath(nextPath, e.currentTarget, hasChildren)}
                onClick={() => {
                  if (hasChildren) return;
                  item.onClick?.();
                  onClose();
                }}
                className={[
                  `${glassMenuItemClass} flex w-full items-center justify-between gap-[8px] px-[7px] py-[3px] rounded-md text-sm font-semibold whitespace-nowrap`,
                  "text-foreground/80 dark:text-muted-foreground",
                  "hover:!text-primary-foreground",
                  item.danger ? "hover:bg-destructive" : "hover:bg-primary",
                  "hover:-translate-y-[1px]",
                  "active:scale-[0.99]",
                  "transition-all duration-300 ease-out",
                  "[&_svg]:w-[19px] [&_svg]:h-[19px] [&_svg]:transition-all [&_svg]:duration-300 [&_svg]:ease-out",
                  "[&_svg]:stroke-current",
                ].join(" ")}
              >
                <span className="flex items-center gap-[8px]">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {hasChildren && (
                  <Icon
                    name="caretRight"
                    size={12}
                    className="opacity-70 text-current"
                  />
                )}
              </button>

              {hasChildren && isPathOpen(nextPath) && (
                <GlassMenuPanel className={[SUBMENU_PANEL_CLASS, direction === "right" ? "left-full ml-2" : "right-full mr-2"].join(" ")}>
                  {renderItems(item.children!, nextPath)}
                </GlassMenuPanel>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <GlassMenuPanel
      ref={ref}
      className={ROOT_PANEL_CLASS}
      style={{
        left: position.left,
        top: position.top,
        visibility: measured ? "visible" : "hidden",
      }}
    >
      {renderItems(items)}
    </GlassMenuPanel>
  );
}
