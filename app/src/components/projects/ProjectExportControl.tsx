import { Download } from "lucide-solid";
import { Box } from "styled-system/jsx";
import { css } from "styled-system/css";

type ProjectExportControlProps = {
  projectId: string;
  projectName: string;
};

export function ProjectExportControl(props: ProjectExportControlProps) {
  return (
    <a
      href={`/api/projects/${encodeURIComponent(props.projectId)}/export`}
      download=""
      aria-label={`Download ${props.projectName} archive`}
      class={css({
        alignItems: "center",
        bg: "rgba(229, 239, 229, 0.86)",
        borderColor: "var(--spatial-map-panel-border-strong)",
        borderRadius: "4px",
        borderWidth: "1px",
        color: "var(--spatial-map-accent-strong)",
        display: "inline-flex",
        h: "30px",
        justifyContent: "center",
        minW: "30px",
        px: "0",
        transition: "background-color 140ms ease, border-color 140ms ease",
        _hover: { bg: "rgba(214, 229, 214, 0.95)", borderColor: "var(--spatial-map-accent)" },
        _focusVisible: { outline: "2px solid var(--spatial-map-accent)", outlineOffset: "2px" },
      })}
    >
      <Box as={Download} boxSize="4" />
    </a>
  );
}
