import React, { forwardRef } from "react";
import { glassControlClass } from "./GlassSurface";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  density?: "default" | "compact";
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ className = "", density = "default", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={[
          "w-full rounded border border-border",
          density === "compact" ? "px-2 py-0.5 text-xs" : "px-3 py-2 text-sm",
          "border border-border",
          `${glassControlClass} text-foreground placeholder:text-muted-foreground`,
          "shadow-[0px_0px_14px_-20px] shadow-black/10",
          "transition-[border-color,box-shadow,color] duration-150 ease-out",
          "hover:border-primary/20",
          "focus:outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/15",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "read-only:text-muted-foreground read-only:bg-primary/[0.02]",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);

export default TextField;
