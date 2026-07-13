import { surveyTabIsComplete } from "./surveyReportListUtils";
import { getQaChecklistProgress } from "./surveyQaPack";

/** Key milestones for the hero strip — visual progress storytelling. */
export function getSurveyMilestones(report) {
  const qa = getQaChecklistProgress(report?.qaChecklist, report?.surveyType);
  const signed =
    Boolean(report?.documentControl?.approvedBy?.trim()) ||
    Boolean(report?.signatures?.surveyorSignedDate?.trim()) ||
    Boolean(report?.documentControl?.checkedBy?.trim());

  return [
    { id: "setup", label: "Setup", done: surveyTabIsComplete(report, "details") && surveyTabIsComplete(report, "scope"), tab: "details" },
    { id: "records", label: "Records", done: surveyTabIsComplete(report, "records"), tab: "records" },
    { id: "findings", label: "Findings", done: surveyTabIsComplete(report, "findings"), tab: "findings" },
    { id: "qa", label: "QA", done: qa.pct >= 40 || qa.complete, tab: "professional", detail: qa.total ? `${qa.checked}/${qa.total}` : null },
    { id: "photos", label: "Photos", done: surveyTabIsComplete(report, "photos"), tab: "photos" },
    { id: "signoff", label: "Sign-off", done: signed, tab: "professional" },
  ];
}

export function surveyMilestoneProgress(milestones) {
  const done = milestones.filter((m) => m.done).length;
  return { done, total: milestones.length, pct: milestones.length ? Math.round((done / milestones.length) * 100) : 0 };
}
