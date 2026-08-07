import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import Icon from "./Icon";
import { glassMenuItemClass, GlassMenuPanel } from "./GlassSurface";

const MENU_ITEM_CLASS = [
  `${glassMenuItemClass} flex w-full items-center gap-2 px-[7px] py-[3px] rounded-md text-sm font-semibold whitespace-nowrap`,
  "text-foreground/80 dark:text-muted-foreground",
  "hover:!text-primary-foreground",
  "hover:bg-primary",
  "hover:-translate-y-[1px]",
  "active:scale-[0.99]",
  "transition-all duration-300 ease-out",
  "[&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:transition-all [&_svg]:duration-300 [&_svg]:ease-out",
  "[&_svg]:stroke-current",
].join(" ");

export interface ChipOption {
  value: string;
  label: string;
}

/** Compact click-to-open dropdown menu (used for sort / filter controls). */
export default function ChipDropdown({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} ripple={false}>
        <Icon name="chevronDown" size={12} />
        {label}:{current?.label}
      </Button>
      {open && (
        <GlassMenuPanel className="absolute right-0 top-full z-30 mt-1 w-max min-w-[7rem] rounded-[10px] border border-border px-[5px] py-[6px] flex flex-col gap-[3px] shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={MENU_ITEM_CLASS}
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value && <Icon name="check" size={14} className="ml-auto" />}
            </button>
          ))}
        </GlassMenuPanel>
      )}
    </div>
  );
}
