import { describe, expect, it } from "vitest";
import {
  BUILD_SHA_DIRTY_HINT,
  BUILD_SHA_MISMATCH_HINT,
  assessProductionHtml,
  buildShaMetaTag,
  extractBuildSha,
  injectBuildShaMeta,
  resolveBuildCommitSha,
  runProductionBuildShaCheck,
  sanitizeBuildSha,
  selectExpectedBuildSha,
} from "./productionBuildSha.mjs";

const MAIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("sanitizeBuildSha", () => {
  it("keeps a full sha and marks dirty builds", () => {
    expect(sanitizeBuildSha(`  ${MAIN.toUpperCase()}  `)).toBe(MAIN);
    expect(sanitizeBuildSha(`${MAIN}-dirty`)).toBe(`${MAIN}-dirty`);
    expect(sanitizeBuildSha("unknown")).toBe("unknown");
  });

  it("rejects values that are not a commit sha", () => {
    expect(sanitizeBuildSha(`${MAIN}"><script>`)).toBe("unknown");
    expect(sanitizeBuildSha("")).toBe("unknown");
    expect(sanitizeBuildSha("not-a-sha")).toBe("unknown");
  });
});

describe("injectBuildShaMeta", () => {
  it("injects one meta tag before the closing head", () => {
    const html = "<head>\n  <title>MySafeOps</title>\n</head>";
    const out = injectBuildShaMeta(html, MAIN);
    expect(out).toContain(buildShaMetaTag(MAIN));
    expect(out.indexOf("build-sha")).toBeLessThan(out.indexOf("</head>"));
    expect(injectBuildShaMeta(out, OTHER)).toBe(out);
  });
});

describe("extractBuildSha", () => {
  it("reads the content attribute in either order", () => {
    expect(extractBuildSha(`<meta name="build-sha" content="${MAIN}" />`)).toBe(MAIN);
    expect(extractBuildSha(`<meta content='${MAIN}-dirty' name="build-sha">`)).toBe(`${MAIN}-dirty`);
  });

  it("returns empty when the tag is absent", () => {
    expect(extractBuildSha("<html><head><title>x</title></head></html>")).toBe("");
    expect(extractBuildSha("")).toBe("");
  });
});

describe("assessProductionHtml", () => {
  it("matches the expected sha", () => {
    const result = assessProductionHtml(MAIN, MAIN.toUpperCase());
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("match");
  });

  it("fails when the tag is missing, dirty, or a different commit", () => {
    for (const served of ["", OTHER, "unknown"]) {
      const result = assessProductionHtml(served, MAIN);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(`expected ${MAIN}`);
      expect(result.message).toContain(served ? `served ${served}` : "served none");
      expect(result.message).toContain(BUILD_SHA_MISMATCH_HINT);
    }
    const dirty = assessProductionHtml(`${MAIN}-dirty`, MAIN);
    expect(dirty.ok).toBe(false);
    expect(dirty.reason).toBe("dirty");
    expect(dirty.message).toContain(`expected ${MAIN}`);
    expect(dirty.message).toContain(`served ${MAIN}-dirty`);
    expect(dirty.message).toContain(BUILD_SHA_DIRTY_HINT);
    expect(assessProductionHtml("", MAIN).reason).toBe("missing");
    expect(assessProductionHtml(OTHER, MAIN).reason).toBe("mismatch");
  });
});

describe("resolveBuildCommitSha", () => {
  function git(map) {
    return (args) => {
      const key = args.join(" ");
      if (!Object.prototype.hasOwnProperty.call(map, key)) {
        throw new Error(`git ${key} failed`);
      }
      return map[key];
    };
  }

  it("uses VERCEL_GIT_COMMIT_SHA when the working tree is clean", () => {
    const sha = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": "" }),
    });
    expect(sha).toBe(MAIN);
  });

  it("falls back to git rev-parse HEAD", () => {
    const sha = resolveBuildCommitSha({
      env: {},
      runGit: git({
        "rev-parse HEAD": `${OTHER}\n`,
        "status --porcelain": "",
      }),
    });
    expect(sha).toBe(OTHER);
  });

  it("appends -dirty when git reports uncommitted changes", () => {
    const sha = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": " M src/lib/billingPlans.js\n" }),
    });
    expect(sha).toBe(`${MAIN}-dirty`);
  });

  it("logs the porcelain lines that made the build dirty", () => {
    const lines = [];
    const sha = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": " M package-lock.json\n M public/blog/rss.xml\n?? .cache/x\n" }),
      log: (line) => lines.push(line),
    });
    expect(sha).toBe(`${MAIN}-dirty`);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(" M public/blog/rss.xml");
    expect(lines[0]).toContain("?? .cache/x");
    expect(lines[0]).not.toContain("package-lock.json");
  });

  it("does not log when the tree is clean", () => {
    const lines = [];
    resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": " M package-lock.json\n" }),
      log: (line) => lines.push(line),
    });
    expect(lines).toEqual([]);
  });

  it("ignores a lockfile-only diff left by npm install", () => {
    const clean = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": " M package-lock.json\n" }),
    });
    expect(clean).toBe(MAIN);
    const dirty = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: MAIN },
      runGit: git({ "status --porcelain": " M package-lock.json\n M src/App.jsx\n" }),
    });
    expect(dirty).toBe(`${MAIN}-dirty`);
  });

  describe("vercel.json rewritten by vercel build", () => {
    const committed = JSON.stringify(
      { $schema: "https://openapi.vercel.sh/vercel.json", framework: "vite", headers: [{ source: "/a" }] },
      null,
      2
    );
    const gitWith = (status) => git({ "status --porcelain": status, "show HEAD:vercel.json": committed });

    it("ignores a whitespace / key-order only rewrite", () => {
      const lines = [];
      const sha = resolveBuildCommitSha({
        env: { VERCEL_GIT_COMMIT_SHA: MAIN },
        runGit: gitWith(" M vercel.json\n"),
        readWorkingFile: () =>
          '{"headers":[{"source":"/a"}],"framework":"vite","$schema":"https://openapi.vercel.sh/vercel.json"}',
        log: (line) => lines.push(line),
      });
      expect(sha).toBe(MAIN);
      expect(lines).toEqual([]);
    });

    it("still marks a real vercel.json edit dirty", () => {
      const sha = resolveBuildCommitSha({
        env: { VERCEL_GIT_COMMIT_SHA: MAIN },
        runGit: gitWith(" M vercel.json\n"),
        readWorkingFile: () =>
          '{"framework":"vite","headers":[{"source":"/b"}],"$schema":"https://openapi.vercel.sh/vercel.json"}',
        log: () => {},
      });
      expect(sha).toBe(`${MAIN}-dirty`);
    });

    it("still marks a staged vercel.json change or unparsable file dirty", () => {
      const staged = resolveBuildCommitSha({
        env: { VERCEL_GIT_COMMIT_SHA: MAIN },
        runGit: gitWith("M  vercel.json\n"),
        readWorkingFile: () => committed,
        log: () => {},
      });
      expect(staged).toBe(`${MAIN}-dirty`);
      const broken = resolveBuildCommitSha({
        env: { VERCEL_GIT_COMMIT_SHA: MAIN },
        runGit: gitWith(" M vercel.json\n"),
        readWorkingFile: () => "{ not json",
        log: () => {},
      });
      expect(broken).toBe(`${MAIN}-dirty`);
    });

    it("does not extend the allowance to other JSON files", () => {
      const sha = resolveBuildCommitSha({
        env: { VERCEL_GIT_COMMIT_SHA: MAIN },
        runGit: git({ "status --porcelain": " M package.json\n", "show HEAD:package.json": "{}" }),
        readWorkingFile: () => "{}",
        log: () => {},
      });
      expect(sha).toBe(`${MAIN}-dirty`);
    });
  });

  it("returns unknown when a CLI build has no git metadata", () => {
    const sha = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: "" },
      runGit: () => {
        throw new Error("not a git repository");
      },
    });
    expect(sha).toBe("unknown");
  });

  it("keeps the Vercel sha when git status is unavailable", () => {
    const sha = resolveBuildCommitSha({
      env: { VERCEL_GIT_COMMIT_SHA: ` ${MAIN.toUpperCase()} ` },
      runGit: () => {
        throw new Error("git not installed");
      },
    });
    expect(sha).toBe(MAIN);
  });
});

describe("selectExpectedBuildSha", () => {
  it("uses GITHUB_SHA for a successful Production deployment of main", () => {
    const byRef = selectExpectedBuildSha({
      eventName: "deployment_status",
      githubSha: MAIN,
      originMainSha: OTHER,
      deploymentRef: "refs/heads/main",
      deploymentEnvironment: "Production",
      deploymentState: "success",
    });
    expect(byRef).toMatchObject({ run: true, expectedSha: MAIN, source: "GITHUB_SHA" });

    const vercelShaRef = selectExpectedBuildSha({
      eventName: "deployment_status",
      githubSha: MAIN,
      originMainSha: MAIN,
      deploymentRef: MAIN,
      deploymentEnvironment: "Production",
      deploymentState: "success",
    });
    expect(vercelShaRef).toMatchObject({ run: true, expectedSha: MAIN, source: "GITHUB_SHA" });
  });

  it("uses origin/main for scheduled and manual runs", () => {
    for (const eventName of ["schedule", "workflow_dispatch"]) {
      expect(
        selectExpectedBuildSha({
          eventName,
          githubSha: OTHER,
          originMainSha: MAIN,
        })
      ).toMatchObject({ run: true, expectedSha: MAIN, source: "origin/main" });
    }
  });

  it("does not run for preview deployments or a Production SHA that is not main", () => {
    expect(
      selectExpectedBuildSha({
        eventName: "deployment_status",
        githubSha: OTHER,
        originMainSha: MAIN,
        deploymentRef: OTHER,
        deploymentEnvironment: "Preview",
        deploymentState: "success",
      }).run
    ).toBe(false);

    const superseded = selectExpectedBuildSha({
      eventName: "deployment_status",
      githubSha: OTHER,
      originMainSha: MAIN,
      deploymentRef: OTHER,
      deploymentEnvironment: "Production",
      deploymentState: "success",
    });
    expect(superseded.run).toBe(false);
    expect(superseded.message).toContain("not origin/main");
  });
});

describe("runProductionBuildShaCheck", () => {
  it("retries a stale document until the expected sha is served", async () => {
    let calls = 0;
    const clock = { t: 1_000 };
    const result = await runProductionBuildShaCheck({
      expectedSha: MAIN,
      retryMs: 50,
      intervalMs: 20,
      now: () => clock.t,
      sleep: async (ms) => {
        clock.t += ms;
      },
      log: () => {},
      fetchImpl: async () => {
        calls += 1;
        const sha = calls < 3 ? OTHER : MAIN;
        return {
          ok: true,
          status: 200,
          text: async () => `<meta name="build-sha" content="${sha}" />`,
        };
      },
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it("fails after the retry window when the tag is missing or dirty", async () => {
    const clock = { t: 0 };
    const result = await runProductionBuildShaCheck({
      expectedSha: MAIN,
      retryMs: 30,
      intervalMs: 15,
      now: () => clock.t,
      sleep: async (ms) => {
        clock.t += ms;
      },
      log: () => {},
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => `<meta name="build-sha" content="${MAIN}-dirty" />`,
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.message).toContain(`expected ${MAIN}`);
    expect(result.message).toContain(`served ${MAIN}-dirty`);
    expect(result.message).toContain(BUILD_SHA_DIRTY_HINT);
  });
});
