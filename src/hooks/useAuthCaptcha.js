import { useCallback, useState } from "react";
import { isTurnstileEnabled } from "../config/turnstile";
import { requireCaptchaToken, withCaptchaOptions } from "../lib/authCaptcha";

export function useAuthCaptcha() {
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const enabled = isTurnstileEnabled();

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setTurnstileNonce((n) => n + 1);
  }, []);

  const validateCaptcha = useCallback(() => requireCaptchaToken(captchaToken), [captchaToken]);

  const wrapAuthOptions = useCallback(
    (options = {}) => withCaptchaOptions(options, captchaToken),
    [captchaToken]
  );

  return {
    enabled,
    captchaToken,
    setCaptchaToken,
    turnstileNonce,
    resetCaptcha,
    validateCaptcha,
    wrapAuthOptions,
  };
}
