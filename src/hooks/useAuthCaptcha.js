import { useCallback, useState } from "react";
import { isTurnstileEnabled } from "../config/turnstile";
import {
  captchaBlocksAuthSubmit,
  validateAuthCaptchaState,
  withCaptchaOptions,
} from "../lib/authCaptcha";

/**
 * Turnstile gate for auth forms.
 * - Not configured → skip captcha (local without VITE_TURNSTILE_SITE_KEY).
 * - Configured + unavailable → fail-closed (do not send auth without token).
 * - Configured + ready → require token before submit.
 */
export function useAuthCaptcha() {
  const [captchaToken, setCaptchaToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const turnstileConfigured = isTurnstileEnabled();
  /** Widget should render whenever a site key is configured (even after load failure). */
  const enabled = turnstileConfigured;
  const captchaBlocksSubmit = captchaBlocksAuthSubmit({
    configured: turnstileConfigured,
    unavailable: captchaUnavailable,
    token: captchaToken,
  });

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaUnavailable(false);
    setTurnstileNonce((n) => n + 1);
  }, []);

  const validateCaptcha = useCallback(() => {
    return validateAuthCaptchaState({
      configured: turnstileConfigured,
      unavailable: captchaUnavailable,
      token: captchaToken,
    });
  }, [turnstileConfigured, captchaUnavailable, captchaToken]);

  const wrapAuthOptions = useCallback(
    (options = {}) => withCaptchaOptions(options, captchaToken),
    [captchaToken]
  );

  return {
    enabled,
    turnstileConfigured,
    captchaUnavailable,
    captchaToken,
    captchaBlocksSubmit,
    setCaptchaToken,
    setCaptchaUnavailable,
    turnstileNonce,
    resetCaptcha,
    validateCaptcha,
    wrapAuthOptions,
  };
}
