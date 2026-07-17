/**
 * Premium org-invite email HTML — company branding + MySafeOps chrome.
 * Email-client safe: table layout, inline styles, absolute image URLs only.
 */

export type InviteEmailBrand = {
  orgName: string;
  inviteeEmail: string;
  acceptUrl: string;
  supportEmail: string;
  siteUrl: string;
  /** Absolute https logo for the inviting company (optional). */
  companyLogoUrl?: string;
  /** Absolute https MySafeOps mark (optional). */
  productLogoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  website?: string;
  address?: string;
  phone?: string;
  inviterName?: string;
};

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve logo for email: https only (or site-relative → absolute). Skip data: blobs. */
export function resolveEmailLogoUrl(raw: unknown, siteUrl: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return ""; // avoid mixed-content / insecure in mail
  if (s.startsWith("data:")) return "";
  if (s.startsWith("/") && siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}${s}`;
  }
  return "";
}

export function buildOrgInviteEmailSubject(orgName: string): string {
  const name = String(orgName || "your team").trim() || "your team";
  return `You're invited to join ${name} on MySafeOps`;
}

export function buildOrgInviteEmailText(brand: InviteEmailBrand): string {
  const org = brand.orgName || "your organisation";
  return [
    `You've been invited to join ${org} on MySafeOps.`,
    "",
    `Sign in with ${brand.inviteeEmail} and accept the invite:`,
    brand.acceptUrl,
    "",
    brand.inviterName ? `Sent on behalf of ${org}${brand.inviterName ? ` · ${brand.inviterName}` : ""}.` : `Sent by ${org}.`,
    "",
    `Support: ${brand.supportEmail}`,
    "MySafeOps — UK construction H&S",
  ].join("\n");
}

/**
 * Premium transactional invite — company logo + product chrome.
 */
export function buildOrgInviteEmailHtml(brand: InviteEmailBrand): string {
  const primary = /^#[0-9a-fA-F]{6}$/.test(String(brand.primaryColor || ""))
    ? String(brand.primaryColor)
    : "#0f766e";
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(brand.accentColor || ""))
    ? String(brand.accentColor)
    : "#14b8a6";
  const org = esc(brand.orgName || "MySafeOps");
  const email = esc(brand.inviteeEmail);
  const acceptUrl = esc(brand.acceptUrl);
  const support = esc(brand.supportEmail);
  const site = esc(brand.siteUrl || "https://mysafeops.com");
  const website = brand.website ? esc(String(brand.website).replace(/\/$/, "")) : "";
  const address = brand.address ? esc(brand.address) : "";
  const phone = brand.phone ? esc(brand.phone) : "";
  const inviter = brand.inviterName ? esc(brand.inviterName) : "";
  const companyLogo = brand.companyLogoUrl ? esc(brand.companyLogoUrl) : "";
  const productLogo = brand.productLogoUrl ? esc(brand.productLogoUrl) : "";

  const companyLogoBlock = companyLogo
    ? `<img src="${companyLogo}" width="168" height="60" alt="${org}" style="display:block;max-width:168px;max-height:60px;width:auto;height:auto;border:0;outline:none;"/>`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;line-height:1.15">${org}</div>`;

  const productLogoBlock = productLogo
    ? `<img src="${productLogo}" width="128" height="30" alt="MySafeOps" style="display:block;max-height:30px;width:auto;border:0;"/>`
    : `<span style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.28);font-size:11px;font-weight:800;letter-spacing:0.08em;color:#ffffff;text-transform:uppercase">MySafeOps</span>`;

  const sendingLogo = companyLogo
    ? `<img src="${companyLogo}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;object-fit:contain;border:0;border-radius:10px;background:#ffffff;"/>`
    : `<div style="width:48px;height:48px;border-radius:10px;background:${primary};color:#ffffff;font-size:18px;font-weight:800;line-height:48px;text-align:center">${esc(
        (brand.orgName || "M").trim().charAt(0).toUpperCase() || "M",
      )}</div>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Invite to ${org}</title>
</head>
<body style="margin:0;padding:0;background:#e8eef5;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    Join ${org} on MySafeOps — accept your workspace invite.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8eef5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="width:580px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.12);">
          <!-- Hero band -->
          <tr>
            <td style="background:${primary};padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,${accent},#ffffff55,${accent});font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:26px 32px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="left" valign="middle" style="padding-right:12px;">
                          <div style="display:inline-block;padding:10px 14px;background:#ffffff;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.12);">
                            ${companyLogoBlock}
                          </div>
                        </td>
                        <td align="right" valign="middle" style="white-space:nowrap;">
                          ${productLogoBlock}
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">Workspace invite</p>
                    <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                      You're invited to join ${org}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
                ${inviter ? `<strong style="color:#0f172a">${inviter}</strong> has invited you` : "You've been invited"} to collaborate on <strong style="color:#0f172a">MySafeOps</strong> — RAMS, permits, surveys and site safety in one place.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Sign in with</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${email}</p>
                  </td>
                </tr>
              </table>
              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="${primary}" style="border-radius:12px;background:${primary};box-shadow:0 8px 20px ${primary}55;">
                          <a href="${acceptUrl}" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                            Accept invite →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                Button not working? Copy this link:
              </p>
              <p style="margin:0 0 24px;font-size:11px;line-height:1.45;word-break:break-all;text-align:center;">
                <a href="${acceptUrl}" style="color:${primary};text-decoration:underline;">${acceptUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Sending company card -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:14px;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%);">
                <tr>
                  <td style="padding:18px 20px;" width="64" valign="top">
                    ${sendingLogo}
                  </td>
                  <td style="padding:18px 20px 18px 0;" valign="middle">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Sending organisation</p>
                    <p style="margin:0;font-size:17px;font-weight:800;color:#0f172a;">${org}</p>
                    ${
                      website
                        ? `<p style="margin:6px 0 0;font-size:13px;"><a href="${website}" style="color:${primary};text-decoration:none;font-weight:600;">${website.replace(/^https?:\/\//i, "")}</a></p>`
                        : ""
                    }
                    ${address ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b;line-height:1.45;">${address}</p>` : ""}
                    ${phone ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">${phone}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 26px;background:#0b1220;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#ffffff;">MySafeOps</p>
              <p style="margin:0;font-size:12px;line-height:1.55;color:#94a3b8;">
                UK construction health &amp; safety — RAMS, permits, surveys.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#64748b;">
                Support: <a href="mailto:${support}" style="color:${accent};text-decoration:none;">${support}</a>
                · <a href="${site}" style="color:#94a3b8;text-decoration:none;">mysafeops.com</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;text-align:center;max-width:580px;line-height:1.5;">
          This invite was sent because an admin at ${org} added your email. If you weren't expecting it, you can ignore this message.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
