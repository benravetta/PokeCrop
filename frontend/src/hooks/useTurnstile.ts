import { useCallback, useState } from "react";
import { isTurnstileConfigured } from "../lib/turnstile";

export function useTurnstileToken() {
  const enabled = isTurnstileConfigured();
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setWidgetKey((k) => k + 1);
  }, []);

  const onVerify = useCallback((value: string) => setToken(value), []);
  const onExpire = useCallback(() => setToken(null), []);
  const onError = useCallback(() => setToken(null), []);

  const ready = !enabled || token !== null;

  return {
    enabled,
    token,
    ready,
    widgetKey,
    reset,
    onVerify,
    onExpire,
    onError,
  };
}
