interface AsciiLogoProps {
  className?: string;
  shadow?: boolean;
}

const LOGO = [
  "███████    ██████    ██   ██",
  "██        ██         ██   ██",
  "██████    ██   ███   ███████",
  "██        ██    ██   ██   ██",
  "███████    ██████    ██   ██",
  " ▓▓▓▓▓▓▓    ▓▓▓▓▓▓    ▓▓   ▓▓",
  "  ▒▒▒▒▒▒▒    ▒▒▒▒▒▒    ▒▒   ▒▒",
  "   ░░░░░░░    ░░░░░░    ░░   ░░",
].join("\n");

export default function AsciiLogo({ className = "", shadow = false }: AsciiLogoProps) {
  return (
    <pre
      className={`font-mono whitespace-pre text-primary/80 leading-[1.05] select-none ${className}`.trim()}
      style={shadow ? { textShadow: "0 0 6px var(--color-primary, rgba(99,102,241,0.4))" } : undefined}
    >
      {LOGO}
    </pre>
  );
}
