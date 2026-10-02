// Case-insensitive label match used by searchable attribute menus. Matches that
// start with the query come first so typing a prefix picks the obvious option.
export function filterAttributeMenuItems<T extends { label: string }>(items: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  const matches = items.filter((item) => item.label.toLowerCase().includes(needle));
  return [
    ...matches.filter((item) => item.label.toLowerCase().startsWith(needle)),
    ...matches.filter((item) => !item.label.toLowerCase().startsWith(needle)),
  ];
}
