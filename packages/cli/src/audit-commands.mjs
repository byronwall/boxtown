import { writeFile } from "node:fs/promises";
import { requireOption, resolveInputPath } from "./cli-helpers.mjs";
import { CliError, exitCodes } from "./errors.mjs";
import { writeJson } from "./output.mjs";

const severityRank = { info: 0, warning: 1, error: 2 };

// pgm project audit: read-only report. --fail-on makes findings at or above a
// severity fail the process, for automated checks.
export async function dispatchProjectAudit(context) {
  const options = context.parsed.options;
  const projectId = requireOption(
    context.parsed.positionals[0] ?? context.projectId,
    "A project id is required. Pass one or run pgm project link <id>.",
  );
  const failOn = options.failOn;
  if (failOn !== undefined && !(failOn in severityRank)) {
    throw new CliError("--fail-on must be info, warning, or error.", exitCodes.usage);
  }

  const { audit } = await context.client.getProjectAudit(projectId, {
    subtree: options.subtree,
    includeArchived: options.includeArchived ? "true" : undefined,
    require: typeof options.require === "string" ? options.require : undefined,
  });

  const markdown = formatAuditMarkdown(audit);
  if (typeof options.output === "string") {
    await writeFile(resolveInputPath(options.output, context.io.cwd), markdown, "utf8");
  }
  if (options.json) {
    writeJson({ audit }, context.io.stdout);
  } else {
    context.io.stdout.write(markdown);
  }

  if (failOn !== undefined) {
    const failing = audit.findings.filter((finding) => severityRank[finding.severity] >= severityRank[failOn]);
    if (failing.length > 0) {
      throw new CliError(`${failing.length} audit finding${failing.length === 1 ? "" : "s"} at ${failOn} or above.`, exitCodes.auditFindings);
    }
  }
}

export function formatAuditMarkdown(audit) {
  const lines = [
    `# Audit: ${audit.projectId}`,
    "",
    `Selection: ${audit.selection.subtree ? `subtree ${audit.selection.subtree}` : "whole project"}, ` +
      `${audit.selection.includeArchived ? "including" : "excluding"} archived, ${audit.selection.nodeCount} nodes.`,
    `Implemented nodes must have: ${audit.rules.requireImplemented.join(", ") || "(nothing)"}.`,
    ...(audit.rules.undeclaredRequiredFields
      ? [`Not in the schema, so not checked: ${audit.rules.undeclaredRequiredFields.join(", ")}.`]
      : []),
    "",
    `Status: ${formatCounts(audit.counts.byStatus)}`,
    `Type: ${formatCounts(audit.counts.byType)}`,
    `Findings: ${formatCounts(audit.summary) || "none"}`,
    "",
  ];
  for (const finding of audit.findings) {
    const ids = finding.nodeIds?.join(", ") ?? finding.nodeId;
    lines.push(`- **${finding.severity}** \`${finding.rule}\`${ids ? ` ${ids}` : ""}: ${finding.reason}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatCounts(counts) {
  return Object.entries(counts).map(([key, count]) => `${key} ${count}`).join(", ");
}
