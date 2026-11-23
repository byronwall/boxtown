import { Download } from "lucide-solid";
import { css } from "styled-system/css";
import { Tooltip } from "~/components/ui/tooltip";

type ProjectExportControlProps = {
  projectId: string;
  projectName: string;
};

// A download link has to stay an anchor, so it is styled with a class to match
// the plain 24px icon buttons beside it.
const exportLinkClass = css({
  alignItems: "center",
  borderRadius: "4px",
  color: "var(--spatial-map-copy-dim)",
  display: "inline-flex",
  h: "24px",
  justifyContent: "center",
  w: "24px",
  transition: "background-color 120ms ease, color 120ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
  _hover: { bg: "color-mix(in srgb, var(--spatial-map-ink) 8%, transparent)", color: "var(--spatial-map-copy)" },
  _active: { transform: "scale(0.97)" },
  _focusVisible: { outline: "2px solid var(--spatial-map-accent)", outlineOffset: "2px" },
});

export function ProjectExportControl(props: ProjectExportControlProps) {
  return (
    <Tooltip content="Download archive" openDelay={150} closeDelay={80}>
      <a
        href={`/api/projects/${encodeURIComponent(props.projectId)}/export`}
        download=""
        aria-label={`Download ${props.projectName} archive`}
        class={exportLinkClass}
      >
        <Download size={14} />
      </a>
    </Tooltip>
  );
}
