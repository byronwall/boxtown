# CLI Skill Distribution

The `pgm` package now ships a bundled agent skill named `product-grid-context`.

The skill teaches agents to use `pgm` for Product Grid project, node, and task context instead of scraping the browser UI.

## Install From The CLI

After installing the package:

```bash
npm install -g @byronwallrus/product-grid-cli
```

Install the skill globally for Codex:

```bash
pgm skill install --agent codex --global
```

Install the skill into the current project:

```bash
pgm skill install --agent codex
```

The project install target is:

```text
./.agents/skills/product-grid-context/
```

The Codex global install target is:

```text
~/.codex/skills/product-grid-context/
```

Use `--force` to replace an existing install:

```bash
pgm skill install --agent codex --global --force
```

## Inspect The Bundled Skill

```bash
pgm skill path
pgm skill print
```

## Vercel Skills CLI Compatibility

The same skill is mirrored at repo root:

```text
skills/product-grid-context/SKILL.md
```

That lets users install it with the Vercel skills CLI from a GitHub repository or local checkout:

```bash
npx skills add ./ --skill product-grid-context --agent codex --global
```

Once the repo is public:

```bash
npx skills add byronwallrus/product-grid-mgmt --skill product-grid-context --agent codex --global
```

The npm package path is still the primary distribution route for users who install `pgm`; the repo-root skill exists for ecosystem compatibility.
