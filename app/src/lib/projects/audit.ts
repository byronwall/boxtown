import { getArchivedSubtreeNodeIds } from "~/lib/spatial-map/archive";
import type { MapNode } from "~/lib/spatial-map/types";
import type { ProjectRecord } from "./types";

// A read-only completeness and integrity report over a selection of nodes.
// Rules flag records for review; they never change or merge anything.

export type AuditSeverity = "info" | "warning" | "error";

export interface AuditFinding {
  rule: string;
  severity: AuditSeverity;
  nodeId: string | null;
  nodeIds?: string[];
  reason: string;
}

export interface AuditOptions {
  subtree?: string;
  includeArchived?: boolean;
  // Fields an implemented node should have. Defaults to the declared ones of
  // `solution` and `verification`.
  requireImplemented?: string[];
}

export interface AuditInputs {
  // Problems found in the raw node files before the loader repaired them.
  integrityIssues: string[];
  // Image references whose files are missing on disk.
  missingImages: Array<{ nodeId: string; filename: string }>;
}

export const auditSeverityRank: Record<AuditSeverity, number> = { info: 0, warning: 1, error: 2 };

export function auditProject(project: ProjectRecord, options: AuditOptions, inputs: AuditInputs) {
  const declared = new Set(project.nodeMetadataSchema.map((field) => field.key));
  const required = options.requireImplemented
    ?? ["solution", "verification"].filter((key) => declared.has(key));
  const unknownRequired = required.filter((key) => !declared.has(key));
  const nodes = selectNodes(project, options);
  const selectedIds = new Set(nodes.map((node) => node.id));
  const findings: AuditFinding[] = [];

  for (const issue of inputs.integrityIssues) {
    findings.push({ rule: "graph-integrity", severity: "error", nodeId: null, reason: issue });
  }
  for (const image of inputs.missingImages) {
    if (!selectedIds.has(image.nodeId)) continue;
    findings.push({
      rule: "missing-image-file",
      severity: "error",
      nodeId: image.nodeId,
      reason: `Image file "${image.filename}" is missing.`,
    });
  }

  for (const node of nodes) {
    if (node.status === "implemented") {
      const missing = required.filter((key) => declared.has(key) && !node.metadata[key]?.trim());
      if (missing.length > 0) {
        findings.push({
          rule: "implemented-missing-field",
          severity: "warning",
          nodeId: node.id,
          reason: `Implemented without ${missing.join(", ")}.`,
        });
      }
    } else if (node.metadata.solution?.trim()) {
      // A workaround or partial result on an open node is legitimate; list it for review.
      const outcome = node.metadata.outcome?.trim();
      findings.push({
        rule: "open-with-solution",
        severity: "info",
        nodeId: node.id,
        reason: `Status ${node.status} with solution text${outcome ? ` (outcome: ${outcome})` : " and no outcome"}.`,
      });
    }
    if (declared.has("owner") && node.status === "working" && !node.metadata.owner?.trim()) {
      findings.push({ rule: "working-without-owner", severity: "warning", nodeId: node.id, reason: "Working with no owner." });
    }
  }

  findings.push(...findDuplicateTitles(nodes));

  return {
    projectId: project.id,
    selection: {
      subtree: options.subtree ?? null,
      includeArchived: options.includeArchived === true,
      nodeCount: nodes.length,
    },
    rules: {
      requireImplemented: required,
      ...(unknownRequired.length > 0 ? { undeclaredRequiredFields: unknownRequired } : {}),
      ownerCheck: declared.has("owner"),
    },
    counts: {
      byStatus: countBy(nodes, (node) => node.status),
      byType: countBy(nodes, (node) => node.type),
      archived: nodes.filter((node) => node.archived).length,
    },
    summary: countBy(findings, (finding) => finding.severity),
    findings: findings.sort((left, right) =>
      auditSeverityRank[right.severity] - auditSeverityRank[left.severity] || left.rule.localeCompare(right.rule)),
  };
}

function selectNodes(project: ProjectRecord, options: AuditOptions) {
  const hidden = options.includeArchived ? new Set<string>() : getArchivedSubtreeNodeIds(project.spatialMap);
  let nodes = project.spatialMap.nodes.filter((node) => !hidden.has(node.id));
  if (options.subtree) {
    const inSubtree = new Set([options.subtree]);
    let added = true;
    while (added) {
      added = false;
      for (const link of project.spatialMap.links) {
        if (link.parentChild && inSubtree.has(link.source) && !inSubtree.has(link.target)) {
          inSubtree.add(link.target);
          added = true;
        }
      }
    }
    nodes = nodes.filter((node) => inSubtree.has(node.id));
  }
  return nodes;
}

// Same title after case and spacing are normalized. Possible duplicates only.
function findDuplicateTitles(nodes: MapNode[]): AuditFinding[] {
  const byTitle = new Map<string, MapNode[]>();
  for (const node of nodes) {
    const key = node.label.trim().toLowerCase().replace(/\s+/g, " ");
    byTitle.set(key, [...(byTitle.get(key) ?? []), node]);
  }
  return [...byTitle.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      rule: "duplicate-title",
      severity: "warning" as const,
      nodeId: group[0]!.id,
      nodeIds: group.map((node) => node.id),
      reason: `${group.length} nodes are titled "${group[0]!.label}". Link duplicates to one canonical node rather than merging.`,
    }));
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}
