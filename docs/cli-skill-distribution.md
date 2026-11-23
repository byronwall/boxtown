# CLI Skill Distribution

The `boxtown` package now ships a bundled agent skill named `boxtown-context`.

The skill teaches agents to use `boxtown` for Boxtown project, node, and task context instead of scraping the browser UI.

## Install From The CLI

After installing the package:

```bash
npm install -g boxtown
```

Install the skill globally for Codex:

```bash
boxtown skill install --agent codex --global
```

Install the skill into the current project:

```bash
boxtown skill install --agent codex
```

The project install target is:

```text
./.agents/skills/boxtown-context/
```

The Codex global install target is:

```text
~/.codex/skills/boxtown-context/
```

Use `--force` to replace an existing install:

```bash
boxtown skill install --agent codex --global --force
```

## Inspect The Bundled Skill

```bash
boxtown skill path
boxtown skill print
```

## Vercel Skills CLI Compatibility

The same skill is mirrored at repo root:

```text
skills/boxtown-context/SKILL.md
```

That lets users install it with the Vercel skills CLI from a GitHub repository or local checkout:

```bash
npx skills add ./ --skill boxtown-context --agent codex --global
```

Once the repo is public:

```bash
npx skills add byronwallrus/product-grid-mgmt --skill boxtown-context --agent codex --global
```

The npm package path is still the primary distribution route for users who install `boxtown`; the repo-root skill exists for ecosystem compatibility.
