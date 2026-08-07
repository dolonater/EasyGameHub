interface AppBackgroundShellProps {
  backgroundUrl: string | null;
  autoDarken: boolean;
  backgroundBlur: number;
}

export default function AppBackgroundShell({ backgroundUrl, autoDarken, backgroundBlur }: AppBackgroundShellProps) {
  if (!backgroundUrl) return null;

  return (
    <div className="app-shell-background" aria-hidden="true">
      <img
        className="app-shell-background-image"
        src={backgroundUrl}
        alt=""
        draggable={false}
        style={{
          filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : "none",
          transform: backgroundBlur > 0 ? "scale(1.04)" : "scale(1)",
        }}
      />
      <div
        className="app-shell-background-overlay"
        style={{ opacity: autoDarken ? undefined : 0 }}
      />
    </div>
  );
}
