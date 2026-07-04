import { useCallback, useState } from "react";
import { isTurnstileEnabled } from "../config/turnstile";
import { requireCaptchaToken, withCaptchaOptions } from "../lib/authCaptcha";

export function useAuthCaptcha() {
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const turnstileConfigured = isTurnstileEnabled();
  const enabled = turnstileConfigured && !captchaUnavailable;

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaUnavailable(false);
    setTurnstileNonce((n) => n + 1);
  }, []);

  const validateCaptcha = useCallback(() => {
    if (!enabled) return null;
    return requireCaptchaToken(captchaToken);
  }, [enabled, captchaToken]);

  const wrapAuthOptions = useCallback(
    (options = {}) => withCaptchaOptions(options, captchaToken),
    [captchaToken]
  );

  return {
    enabled,
    turnstileConfigured,
    captchaToken,
    setCaptchaToken,
    setCaptchaUnavailable,
    turnstileNonce,
    resetCaptcha,
    validateCaptcha,
    wrapAuthOptions,
  };
}
