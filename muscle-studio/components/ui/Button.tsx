import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-[#f06d3a] active:bg-[#d9551f] border border-accent",
  secondary: "bg-panel-2 text-fg hover:bg-panel-3 border border-line hover:border-line-strong",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-panel-2 border border-transparent",
  danger: "bg-transparent text-danger hover:bg-danger/10 border border-danger/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: "sm" | "md";
}

/** Square icon button; `label` is used for both aria-label and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-35",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-transparent text-muted hover:border-line hover:bg-panel-2 hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
});
