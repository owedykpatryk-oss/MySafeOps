import FessClientSitesHub from "../components/FessClientSitesHub";
import FessPulseCard from "../components/FessPulseCard";
import PageHero from "../components/PageHero";
import { loadOrgScoped as load } from "../utils/orgStorage";
import { canUseFessExclusiveFeatures } from "../utils/fessExclusive";
import { ms } from "../utils/moduleStyles";

const ss = ms;

export default function FessSitesModule() {
  const projects = load("mysafeops_projects", []);
  const rams = load("rams_builder_docs", []);
  const permits = load("permits_v2", []);
  const methodStatements = load("method_statements", []);
  const workers = load("mysafeops_workers", []);

  if (!canUseFessExclusiveFeatures()) {
    return (
      <div>
        <PageHero
          badgeText="FESS"
          title="FESS client & sites"
          lead="Client site directory and one-click job packs are only available for the FESS Group workspace."
        />
        <div style={{ ...ss.card, padding: 16, fontSize: 13, color: "var(--color-text-secondary)" }}>
          Switch to your FESS organisation or ask an admin to provision access.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        badgeText="FESS"
        title="Client & sites"
        lead="Your food factory client base — pick a site, launch RAMS + method statement + permits from MC-mapped playbooks, or repeat a visit with a new job ref."
      />
      <FessPulseCard
        rams={rams}
        permits={permits}
        methodStatements={methodStatements}
        workers={workers}
        projects={projects}
      />
      <FessClientSitesHub
        projects={projects}
        rams={rams}
        permits={permits}
        methodStatements={methodStatements}
        variant="full"
      />
    </div>
  );
}
