# CLI releases

Add a release note to every change. The published CLI bundles the app, so app changes count too:

```sh
pnpm changeset:add patch "Describe the change for CLI users"
```

Use `minor` for new features and `patch` for fixes. See [release setup](../README.md#release) for the workflow and npm configuration.
