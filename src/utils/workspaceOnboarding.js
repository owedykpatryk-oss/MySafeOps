import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

export function isOnboardingWizardComplete() {
  return Boolean(loadOrgSettingsRaw().onboardingWizardCompleted);
}

export function markOnboardingComplete() {
  saveOrgSettingsRaw({
    ...loadOrgSettingsRaw(),
    onboardingWizardCompleted: true,
    onboardingWizardCompletedAt: new Date().toISOString(),
  });
}
