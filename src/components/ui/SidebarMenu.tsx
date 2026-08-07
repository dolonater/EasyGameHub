import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HorizontalNavBar, HorizontalNavItem } from "./HorizontalNavBar";
import Icon from "./Icon";
import {
  getSidebarOrder,
  getSidebarVisibility,
  onSidebarOrderChange,
  onSidebarVisibilityChange,
  orderBySavedKeys,
  setSidebarOrder,
  type SidebarGroup,
  type SidebarOrderState,
} from "../../lib/sidebarOrder";

interface SidebarMenuProps {
  iconsOnly: boolean;
  dragReorderEnabled: boolean;
  orientation?: "vertical" | "horizontal";
  horizontalPlacement?: "top" | "bottom";
  libraryLabel: string;
  playtimeLabel: string;
  screenshotsLabel: string;
  gamesLabel: string;
  steamHubLabel: string;
  settingsLabel: string;
  fullscreenLabel: string;
  sectionGames: string;
  sectionSteam: string;
  sectionSystem?: string;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  navBtnClass: (args: { isActive: boolean }) => string;
  iconClass: string;
  sectionClass: string;
  pluginItems: { key: string; to: string; title: string; icon?: string }[];
  pluginLabel?: string;
}

type SidebarItem = {
  key: string;
  group: SidebarGroup;
  to: string;
  label: ReactNode;
  icon: ComponentProps<typeof Icon>["name"];
  end?: boolean;
};

function NavIcon({ name, active, iconClass }: { name: ComponentProps<typeof Icon>["name"]; active: boolean; iconClass: string }) {
  return <Icon name={name} size={20} className={active ? "text-primary-foreground" : iconClass} />;
}

function DragHandle() {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 flex-col items-center justify-center gap-[2px] rounded-sm text-current/35 transition-colors hover:text-current/60">
      <span className="flex items-center gap-[2px]">
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
      <span className="flex items-center gap-[2px]">
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
    </span>
  );
}

function SortableSidebarItem({
  item,
  iconsOnly,
  dragReorderEnabled,
  orientation,
  horizontalPlacement,
  navBtnClass,
  iconClass,
}: {
  item: SidebarItem;
  iconsOnly: boolean;
  dragReorderEnabled: boolean;
  orientation: "vertical" | "horizontal";
  horizontalPlacement: "top" | "bottom";
  navBtnClass: SidebarMenuProps["navBtnClass"];
  iconClass: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.key,
    disabled: !dragReorderEnabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        orientation === "horizontal"
          ? "relative flex h-10 flex-none items-stretch gap-1"
          : "relative flex items-stretch gap-1",
        isDragging ? "rounded-[var(--radius)] bg-primary/10 ring-1 ring-primary/30 shadow-sm" : "",
      ].join(" ").trim()}
    >
      {dragReorderEnabled && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex items-center justify-center flex-shrink-0 rounded-[var(--radius)] text-current/35 transition-colors hover:text-current/60 cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: "none" }}
          title="拖拽排序"
          aria-label="拖拽排序"
          {...attributes}
          {...listeners}
        >
          <DragHandle />
        </button>
      )}
      {orientation === "horizontal" ? (
        <HorizontalNavItem
          to={item.to}
          end={item.end}
          icon={item.icon}
          iconClass={iconClass}
          label={item.label}
          placement={horizontalPlacement}
        />
      ) : (
        <NavLink
          to={item.to}
          end={item.end}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          title={iconsOnly || dragReorderEnabled ? `${typeof item.label === "string" ? item.label : item.key}` : undefined}
          className={({ isActive }) => [
            navBtnClass({ isActive }),
            "flex-1 min-w-0",
          ].join(" ").trim()}
        >
          {({ isActive }) => (
            <>
              <NavIcon name={item.icon} active={isActive} iconClass={iconClass} />
              {!iconsOnly && <span className="min-w-0 truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      )}
    </div>
  );
}

export default function SidebarMenu({
  iconsOnly,
  dragReorderEnabled,
  orientation = "vertical",
  horizontalPlacement = "top",
  libraryLabel,
  playtimeLabel,
  screenshotsLabel,
  gamesLabel,
  steamHubLabel,
  settingsLabel,
  fullscreenLabel,
  sectionGames,
  sectionSteam,
  sectionSystem,
  fullscreen,
  onToggleFullscreen,
  navBtnClass,
  iconClass,
  sectionClass,
  pluginItems,
  pluginLabel,
}: SidebarMenuProps) {
  const [order, setOrder] = useState<SidebarOrderState>(() => getSidebarOrder());
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getSidebarVisibility());

  useEffect(() => {
    const sync = () => setOrder(getSidebarOrder());
    sync();
    return onSidebarOrderChange(sync);
  }, []);

  useEffect(() => {
    const sync = () => setVisibility(getSidebarVisibility());
    sync();
    return onSidebarVisibilityChange(sync);
  }, []);

  const allSidebarItems = useMemo(() => {
    const games: SidebarItem[] = [
      { key: "library", group: "games", to: "/steam/inventory", label: libraryLabel, icon: "launcher" },
      { key: "playtime", group: "games", to: "/playtime", label: playtimeLabel, icon: "playtime" },
      { key: "screenshots", group: "games", to: "/screenshots", label: screenshotsLabel, icon: "screenshots" },
      { key: "games", group: "games", to: "/games", label: gamesLabel, icon: "games" },
    ];
    const steam: SidebarItem[] = [
      // end: only highlight on the exact /steam hub page, not on its
      // sub-pages (inventory / accounts / authenticator / downloads), which
      // otherwise also match via NavLink's prefix matching.
      { key: "steam", group: "steam", to: "/steam", label: steamHubLabel, icon: "steamLogo", end: true },
    ];
    const system: SidebarItem[] = [
      { key: "settings", group: "system", to: "/settings", label: settingsLabel, icon: "settings" },
    ];
    const plugins: SidebarItem[] = pluginItems.map((p) => ({
      key: p.key,
      group: "plugins",
      to: p.to,
      label: p.title,
      icon: (p.icon as ComponentProps<typeof Icon>["name"]) || "question",
    }));

    return orderBySavedKeys([...games, ...steam, ...system, ...plugins], order.all);
  }, [
    gamesLabel,
    libraryLabel,
    order.all,
    pluginItems,
    playtimeLabel,
    screenshotsLabel,
    settingsLabel,
    steamHubLabel,
  ]);

  const visibleSidebarItems = useMemo(
    () => allSidebarItems.filter((item) => visibility[item.key] !== false),
    [allSidebarItems, visibility],
  );

  const persistOrder = (next: SidebarOrderState) => {
    setOrder(next);
    setSidebarOrder(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!dragReorderEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    const current = allSidebarItems.map((item) => item.key);
    const oldIndex = current.indexOf(activeKey);
    const newIndex = current.indexOf(overKey);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextAll = [...current];
    const [moved] = nextAll.splice(oldIndex, 1);
    nextAll.splice(newIndex, 0, moved);
    const itemMap = new Map(allSidebarItems.map((item) => [item.key, item] as const));
    const keysForGroup = (group: SidebarGroup) => nextAll.filter((key) => itemMap.get(key)?.group === group);

    persistOrder({
      ...order,
      all: nextAll,
      games: keysForGroup("games"),
      steam: keysForGroup("steam"),
      system: keysForGroup("system"),
      plugins: keysForGroup("plugins"),
    });
  }, [allSidebarItems, dragReorderEnabled, order]);

  const sectionLabels: Record<SidebarGroup, string> = {
    games: sectionGames,
    steam: sectionSteam,
    system: sectionSystem || "System",
    plugins: pluginLabel || "Plugins",
  };

  const renderSectionHeader = (group: SidebarGroup, index: number) => {
    if (iconsOnly) return null;
    const first = index === 0;
    return (
      <div
        key={`section-${group}-${index}`}
        className={[
          "pointer-events-none text-[10px] font-semibold uppercase tracking-wider px-2 pb-1",
          first ? "pt-3" : "pt-4",
          group === "games" ? "" : "text-gray-400 dark:text-muted-foreground",
        ].join(" ").trim()}
      >
        <span className={group === "system" ? undefined : sectionClass}>{sectionLabels[group]}</span>
      </div>
    );
  };

  const renderSortableItems = () => (
    <>
      {visibleSidebarItems.flatMap((item, index) => {
        const previous = visibleSidebarItems[index - 1];
        const showHeader = !previous || previous.group !== item.group;
        return [
          showHeader ? renderSectionHeader(item.group, index) : null,
          <SortableSidebarItem
            key={item.key}
            item={item}
            iconsOnly={iconsOnly}
            dragReorderEnabled={dragReorderEnabled}
            orientation={orientation}
            horizontalPlacement={horizontalPlacement}
            navBtnClass={navBtnClass}
            iconClass={iconClass}
          />,
        ];
      })}
    </>
  );

  const horizontal = orientation === "horizontal";
  const navClass = horizontal
    ? "flex h-full min-w-0 flex-1 items-center justify-center overflow-visible"
    : "sidebar-scrollbar flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto pl-2 pr-0";
  const fullscreenWrapClass = horizontal
    ? "ml-auto flex flex-none items-center border-l border-border/70 pl-2"
    : "mt-auto pt-2 border-t border-border";
  const sortingStrategy = horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <nav className={navClass}>
        {horizontal ? (
          <HorizontalNavBar className="max-w-[min(100%,56rem)] flex-none">
            <SortableContext
              items={visibleSidebarItems.map((item) => item.key)}
              strategy={sortingStrategy}
            >
              {renderSortableItems()}
            </SortableContext>

            <div className={fullscreenWrapClass}>
              <HorizontalNavItem
                icon="fullscreen"
                iconClass={iconClass}
                label={fullscreenLabel}
                active={fullscreen}
                placement={horizontalPlacement}
                onClick={onToggleFullscreen}
              />
            </div>
          </HorizontalNavBar>
        ) : (
          <>
            <SortableContext
              items={visibleSidebarItems.map((item) => item.key)}
              strategy={sortingStrategy}
            >
              {renderSortableItems()}
            </SortableContext>

            <div className={fullscreenWrapClass}>
              <button
                onClick={onToggleFullscreen}
                title={iconsOnly ? fullscreenLabel : undefined}
                className={navBtnClass({ isActive: fullscreen })}
              >
                <Icon name="fullscreen" size={20} className={fullscreen ? "text-primary-foreground" : iconClass} />
                {!iconsOnly && fullscreenLabel}
              </button>
            </div>
          </>
        )}
      </nav>
    </DndContext>
  );
}
