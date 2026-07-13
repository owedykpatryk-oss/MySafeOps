import { describe, expect, it } from "vitest";
import {
  buildRosterLinkedEmailSet,
  isPermitNotificationRecipientAllowed,
} from "./permitNotificationRecipients.js";

describe("permitNotificationRecipients", () => {
  const permit = { issuedTo: "Alex Morgan", issuedBy: "Patryk Owedyk — Supervisor" };
  const roster = [
    { name: "Alex Morgan", email: "alex@site.example" },
    { name: "Sam Taylor", email: "sam@site.example" },
    { name: "Patryk Owedyk", email: "patryk@org.example" },
  ];

  it("links roster emails only when names match permit people", () => {
    const linked = buildRosterLinkedEmailSet(permit, roster);
    expect(linked.has("alex@site.example")).toBe(true);
    expect(linked.has("patryk@org.example")).toBe(true);
    expect(linked.has("sam@site.example")).toBe(false);
  });

  it("rejects roster emails not tied to permit people", () => {
    const members = new Set(["member@org.example"]);
    const linked = buildRosterLinkedEmailSet(permit, roster);
    expect(
      isPermitNotificationRecipientAllowed("sam@site.example", { memberAllowlist: members, rosterLinked: linked })
    ).toBe(false);
    expect(
      isPermitNotificationRecipientAllowed("alex@site.example", { memberAllowlist: members, rosterLinked: linked })
    ).toBe(true);
    expect(
      isPermitNotificationRecipientAllowed("member@org.example", { memberAllowlist: members, rosterLinked: linked })
    ).toBe(true);
  });
});
