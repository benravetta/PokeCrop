import { useEffect, useRef } from "react";
import { loadTurnstileScript, TURNSTILE_SITE_KEY } from "../lib/turnstile";

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    void loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onVerify,
        "expired-callback": onExpire,
        "error-callback": onError,
        theme: "dark",
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onExpire, onError]);

  return <div ref={containerRef} className="min-h-[65px] flex justify-center" />;
}

export function TurnstileField({
  enabled,
  widgetKey,
  onVerify,
  onExpire,
  onError,
}: {
  enabled: boolean;
  widgetKey: number;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}) {
  if (!enabled) return null;

  return (
    <TurnstileWidget
      key={widgetKey}
      onVerify={onVerify}
      onExpire={onExpire}
      onError={onError}
    />
  );
}
