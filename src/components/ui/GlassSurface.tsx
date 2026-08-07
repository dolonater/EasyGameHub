import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import {
  glassControlBaseClass,
  glassFloatingBaseClass,
  glassMenuItemBaseClass,
  glassMenuPanelBaseClass,
  glassSidebarBaseClass,
  glassTitleBarBaseClass,
  glassToastBaseClass,
} from "./glassClasses";

function joinClasses(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const glassFloatingClass = glassFloatingBaseClass;
export const glassTitleBarClass = glassTitleBarBaseClass;
export const glassSidebarClass = glassSidebarBaseClass;
export const glassControlClass = glassControlBaseClass;
export const glassToastClass = glassToastBaseClass;
export const glassMenuPanelClass = glassMenuPanelBaseClass;
export const glassMenuItemClass = glassMenuItemBaseClass;

interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function GlassFloating({ className = "", children, ...props }: ShellProps) {
  return (
    <div className={joinClasses([glassFloatingClass, className])} {...props}>
      {children}
    </div>
  );
}

export function GlassTitleBar({ className = "", children, ...props }: ShellProps) {
  return (
    <div className={joinClasses([glassTitleBarClass, className])} {...props}>
      {children}
    </div>
  );
}

export function GlassSidebar({ className = "", children, ...props }: ShellProps) {
  return (
    <aside className={joinClasses([glassSidebarClass, className])} {...props}>
      {children}
    </aside>
  );
}

export const GlassMenuPanel = forwardRef<HTMLDivElement, ShellProps>(function GlassMenuPanel({ className = "", children, ...props }, ref) {
  return (
    <div ref={ref} className={joinClasses([glassMenuPanelClass, className])} {...props}>
      {children}
    </div>
  );
});

export function GlassToastPanel({ className = "", children, ...props }: ShellProps) {
  return (
    <div className={joinClasses([glassToastClass, className])} {...props}>
      {children}
    </div>
  );
}
