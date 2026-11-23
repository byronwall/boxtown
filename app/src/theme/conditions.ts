export const conditions = {
  extend: {
    // Light is the default; dark follows the OS setting.
    light: ":root &, .light &",
    dark: "@media (prefers-color-scheme: dark)",
    invalid: "&:is(:user-invalid, [data-invalid], [aria-invalid=true])",
    hover: "&:not(:disabled):hover",
    active: "&:not(:disabled):active",
    checked:
      "&:is(:checked, [data-checked], [data-state=checked], [aria-checked=true], [data-state=indeterminate])",
    on: "&:is([data-state=on])",
    pinned: "&:is([data-pinned])",
  },
} as const;
