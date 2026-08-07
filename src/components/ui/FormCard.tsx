import React from "react";
import GlassCard from "./GlassCard";

interface FormCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * White form card based on animotion staem登录页面/style1.tsx.
 * Centered title + subtitle, children in spaced form layout.
 * Light: white bg / Dark: card bg — adaptive.
 */
export default function FormCard({ title, subtitle, children, className = "" }: FormCardProps) {
  return (
    <GlassCard bordered={false} className={`w-80 rounded-lg shadow h-auto p-6 relative overflow-hidden ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="flex flex-col justify-center items-center space-y-2">
          {title && <h2 className="text-2xl font-medium text-slate-700 dark:text-foreground">{title}</h2>}
          {subtitle && <p className="text-slate-500 dark:text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      )}
      <div className="w-full mt-4 space-y-3">
        {children}
      </div>
    </GlassCard>
  );
}
