import { useIdleSessionLogout } from "../hooks/useIdleSessionLogout";
import IdleSessionWarningBanner from "./IdleSessionWarningBanner";

/** Wraps authenticated workspace children with idle logout. */
export default function IdleSessionGuard({ children }) {
  const { warnSeconds, staySignedIn, timeoutMinutes } = useIdleSessionLogout({ enabled: true });
  return (
    <>
      {children}
      <IdleSessionWarningBanner
        warnSeconds={warnSeconds}
        staySignedIn={staySignedIn}
        timeoutMinutes={timeoutMinutes}
      />
    </>
  );
}
