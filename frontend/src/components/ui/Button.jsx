import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover border-primary",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-border",
  ghost: "border-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
};
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    children,
    className = "",
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex gap-2 items-center justify-center rounded-lg border font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${size === "sm" ? "px-3 py-2 text-sm" : size === "icon" ? "p-2.5" : "px-4 py-2.5 text-sm"} ${className}`}
      {...props}
    >
      {loading && (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
});
