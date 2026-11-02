# Company Operations Manuals

Open **Aerial Survey Operations → Operations Manuals → New manual**. Company contact details are copied from the current organisation settings; confirm the legal entity before use. The manual belongs to the active organisation and country workspace.

## Authoring

- Record the document title, code, version, owner, accountable manager, next review date and scope.
- Define controlled distribution and references to aircraft/operator documentation, authorisations, competence evidence, insurance and controlled forms.
- Work through the ten regional procedure chapters. Each chapter includes drafting topics and a separate confirmation that its contents have been checked against actual company procedures.
- **Add outlines to empty chapters** creates prompts only in empty sections. It preserves existing text and marks missing facts with `[TO COMPLETE: …]`. Replace these placeholders with verified company information.
- Progress counts drafted chapters; it is not a measure of regulatory compliance. The readiness panel identifies missing fields and reviews and links to the next item.

## Save and review

Edits save to organisation-scoped storage. **Save company manual** explicitly retries the current version. The save bar confirms local-device persistence; the existing cloud synchronization banner reports remote sync separately. A failed save retains the edited contents for retry or discard, including when switching workspace tabs or navigating within the app. This recovery is held in browser memory, scoped to the organisation, country and user; save successfully before closing or reloading the page.

The responsible-person review requires identity, document control, a valid next review date, scope, an amendment record and all chapter reviews. Review locks that stored version. **Create revision** copies its contents and company details while clearing the review confirmations and requiring a new amendment record. Concurrent changes to the same row are rejected instead of silently overwritten.

UK drone manuals, Australian drone manuals and Australian helicopter survey coordination plans retain distinct prompts and applicability. The helicopter coordination plan does not replace the aviation operator’s manuals. Recording a company review does not grant certification or flight permission.

## PDF

Download a draft or reviewed version with company branding, manual cover, document-control register, clickable contents and bookmarks, numbered chapters, chapter review records, distribution and source references. Reviewed versions retain the company branding captured at review. The demonstration PDF in `output/pdf/company-operations-manual-example.pdf` uses fictional data and is a drafting/design example only.

## Follow-up automation

- **Review planner** automatically lists drafts, overdue reviews, missing review dates and reviews due in the next 30 days. A reviewed descendant replaces earlier versions in this planner; a draft replacement does not remove the earlier version's reminder. It is an in-app document-control view, not a notification service.
- **Fill missing company details** previews available profile values and fills only blank contact fields. Existing company information is preserved. Applying new company facts clears the operator chapter review so it can be checked again.
- **Changes since version …** lists changed document-control fields and procedure chapters against the earlier reviewed version. **Append change summary** adds this list to the amendment record, preserving existing text. Add the reasons and substantive details yourself. Repeating the button with the same comparison does not duplicate the summary.
- PDF exports include the review schedule and revision comparison. A responsible-person review freezes the comparison in that version; the next review status is assessed at export time. A missing prior version is reported as unavailable, not interpreted as no change.

## Cloud write restrictions

A `billing_write_blocked` response means the service has refused a mutation under its membership/billing gate. In the reported case the user confirmed an expired UK trial with no active subscription. Reads and export remain available; writing to that country requires restoring its subscription.

The client now skips mutation requests when the active workspace is already known to be read-only. A server billing denial also pauses subsequent KV/audit writes for up to 60 seconds, scoped by API, organisation, country and authentication session. Other countries, organisations and reads remain independent. Pending payloads remain in the existing outbox. After billing information refreshes, writes can resume; the existing manual retry clears only the active scope's server-denial pause. This does not grant or bypass access.

On transient navigation HTTP 5xx responses the service worker now uses an available cached shell. This improves offline recovery but does not establish the cause of the user's earlier single 503 response; live app/API health checks returned 200 during investigation.

## Delivery notes

This change extends the existing `drone_manuals` records without a database migration. The shared write guard also validates new company-manual reviews; include the D1 API worker as well as the frontend in the next deployment. Historical reviewed versions remain immutable and readable. This iteration has not been deployed.
