export function runPermitQualityGates(permit) {
  const checks = [
    { id: "description", ok: !!String(permit?.description || "").trim(), message: "Description required" },
    { id: "location", ok: !!String(permit?.location || "").trim(), message: "Location required" },
    { id: "issuedBy", ok: !!String(permit?.issuedBy || "").trim(), message: "Issuer required" },
    { id: "issuedTo", ok: !!String(permit?.issuedTo || "").trim(), message: "Permit holder required" },
    {
      id: "timeRange",
      ok: !!permit?.startDateTime && !!permit?.endDateTime && new Date(permit.endDateTime) > new Date(permit.startDateTime),
      message: "End date/time must be after start date/time",
    },
  ];
  return {
    checks,
    ok: checks.every((c) => c.ok),
    failed: checks.filter((c) => !c.ok),
  };
}

