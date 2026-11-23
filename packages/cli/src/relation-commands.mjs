import { requireOption, requireProject, writeMaybeJson } from "./cli-helpers.mjs";
import { CliError, exitCodes } from "./errors.mjs";

const usage = "Usage: boxtown relation <list <node-id> | add|remove <source-id> <target-id> [--relationship related|dependency|reuse]>";

// Relationship links between nodes. Hierarchy uses `boxtown node move` instead.
export async function dispatchRelation(context, action) {
  const projectId = requireProject(context);
  const [source, target] = context.parsed.positionals;
  const relationship = context.parsed.options.relationship;

  if (action === "list") {
    const nodeId = requireOption(source, usage);
    const result = await context.client.listNodeRelations(projectId, nodeId);
    writeMaybeJson(
      context,
      result,
      result.relations.length === 0
        ? "No relations.\n"
        : result.relations
          .map((link) => `${link.relationship}  ${link.source} -> ${link.target}\n`)
          .join(""),
    );
    return;
  }

  if (action === "add" || action === "remove") {
    requireOption(source, usage);
    requireOption(target, usage);
    const input = { target, ...(typeof relationship === "string" ? { relationship } : {}) };
    if (action === "add") {
      const result = await context.client.addNodeRelation(projectId, source, input);
      const verb = result.created ? "Added" : "Already linked:";
      writeMaybeJson(context, result, `${verb} ${result.link.relationship} ${source} -> ${target}.\n`);
    } else {
      const result = await context.client.removeNodeRelation(projectId, source, input);
      writeMaybeJson(context, result, `Removed ${result.removed.relationship} ${source} -> ${target}.\n`);
    }
    return;
  }

  throw new CliError(usage, exitCodes.usage);
}
