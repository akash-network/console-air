#!/usr/bin/env node
// Render `npm audit --json` output as a Markdown summary.
// Usage: node audit-summary.mjs <path-to-audit.json>
// Filters findings to high+critical (the gate used by the security-audit workflow).

import { readFileSync } from "node:fs";

const [, , path] = process.argv;
if (!path) {
  console.error("usage: audit-summary.mjs <audit.json>");
  process.exit(2);
}

const audit = JSON.parse(readFileSync(path, "utf8"));
const counts = audit.metadata?.vulnerabilities ?? {};
const vulns = audit.vulnerabilities ?? {};

const escalated = Object.values(vulns).filter(v => v.severity === "high" || v.severity === "critical");

const fixLabel = fa => {
  if (fa === undefined || fa === null) return "unknown";
  if (fa === false) return "no";
  if (fa === true) return "yes";
  if (typeof fa === "object") {
    return `${fa.name}@${fa.version}${fa.isSemVerMajor ? " (breaking)" : ""}`;
  }
  return String(fa);
};

const advisoryUrl = via => {
  if (!Array.isArray(via)) return "";
  const found = via.find(v => typeof v === "object" && v.url);
  return found?.url ?? "";
};

const lines = [];
lines.push("### Summary");
lines.push(`- **Critical:** ${counts.critical ?? 0}`);
lines.push(`- **High:** ${counts.high ?? 0}`);
lines.push(`- **Moderate:** ${counts.moderate ?? 0} _(ignored — below gate)_`);
lines.push(`- **Low:** ${counts.low ?? 0} _(ignored — below gate)_`);
lines.push("");

if (escalated.length === 0) {
  lines.push("✅ No high or critical advisories.");
} else {
  lines.push(`### Findings (${escalated.length} package${escalated.length === 1 ? "" : "s"} at high+critical)`);
  lines.push("");
  lines.push("| Package | Severity | Advisory | Fix available |");
  lines.push("|---|---|---|---|");
  for (const v of escalated.sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1) || a.name.localeCompare(b.name))) {
    const url = advisoryUrl(v.via);
    const advisoryCell = url ? `[link](${url})` : "—";
    lines.push(`| \`${v.name}\` | ${v.severity} | ${advisoryCell} | ${fixLabel(v.fixAvailable)} |`);
  }
}

process.stdout.write(lines.join("\n") + "\n");
