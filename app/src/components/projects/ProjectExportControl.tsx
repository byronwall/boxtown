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
        bg: "#dbe3da",
        borderColor: "#42614d",
        borderRadius: "0",
        borderWidth: "1px",
        color: "#1e4f39",
        display: "inline-flex",
        h: "8",
        justifyContent: "center",
        minW: "8",
        px: "0",
        _hover: { bg: "#e4ebe2" },
        _focusVisible: { outline: "2px solid #1e4f39", outlineOffset: "2px" },
      })}
    >
      <Box as={Download} boxSize="4" />
    </a>
  );
}
