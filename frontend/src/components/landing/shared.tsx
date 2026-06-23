import type { ReactNode } from "react";
import { AFTER_IMG } from "./data";

export function Wordmark({ className = "h-8" }: { className?: string }) {
  return (
    <img
      src="/gemcheck-logo.png"
      alt="GemCheck — by Looky"
      className={`${className} w-auto select-none`}
      draggable={false}
    />
  );
}

export function SectionHeading({
  kicker,
  title,
  copy,
  center = true,
}: {
  kicker?: string;
  title: string;
  copy?: string;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {kicker && (
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
          {kicker}
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl lg:text-[2.15rem] font-semibold tracking-tight text-balance">
        {title}
      </h2>
      {copy && <p className="mt-3 text-text-secondary text-base leading-relaxed">{copy}</p>}
    </div>
  );
}

export function HoloCard({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-auto rounded-[5%] drop-shadow-[0_22px_45px_rgba(0,0,0,0.55)] select-none"
        draggable={false}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[5%] mix-blend-screen opacity-40 animate-[holo-pan_7s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 30%, rgba(124,108,246,0.35) 45%, rgba(56,189,248,0.35) 55%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

export function AppWindow({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden shadow-2xl shadow-black/30 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5 bg-surface-overlay/50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-[11px] font-medium text-text-muted truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function StarRating({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function DemoCardThumb({ className = "" }: { className?: string }) {
  return (
    <img
      src={AFTER_IMG}
      alt=""
      className={`rounded border border-border-subtle bg-surface-overlay object-contain ${className}`}
      draggable={false}
    />
  );
}
