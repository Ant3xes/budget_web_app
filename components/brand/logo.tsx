import { cn } from "@/lib/utils";

/** Monogramme : trois barres ascendantes sur un carré arrondi dégradé (même dessin que app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
      <rect x="7" y="16" width="4.5" height="9" rx="1.5" fill="#fff" fillOpacity=".75" />
      <rect x="13.75" y="11" width="4.5" height="14" rx="1.5" fill="#fff" fillOpacity=".88" />
      <rect x="20.5" y="6" width="4.5" height="19" rx="1.5" fill="#fff" />
    </svg>
  );
}

export function Logo({ title, className }: { title: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-base font-semibold tracking-tight">{title}</span>
    </span>
  );
}
