import React, { forwardRef } from "react";
import { glassControlClass } from "./GlassSurface";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/**
 * Search input based on animotion searth1 design — 25% smaller.
 */
const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        className={[
        "w-full max-w-[165px] h-[34px] px-2 rounded-xl text-xs",
        "border-[1.5px] border-border",
        `${glassControlClass} text-foreground placeholder:text-muted-foreground`,
        "outline-none shadow-[0px_0px_20px_-18px] shadow-black/20",
        "transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]",
        "hover:border-2 hover:border-primary/30 hover:shadow-[0px_0px_20px_-17px]",
        "focus:border-2 focus:border-primary/50",
        "active:scale-95",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

export default SearchInput;
