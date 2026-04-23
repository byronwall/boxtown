import { A } from "@solidjs/router";
import { For } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type { ProjectRecord } from "~/lib/projects/types";
import { SpatialMapCreateContextNodeDialog } from "./SpatialMapCreateContextNodeDialog";
import { useSpatialMap } from "./SpatialMapContext";
import { InspectorToggle } from "./SpatialMapInspector";

interface SpatialMapToolbarProps {
  projectId: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function SpatialMapToolbar(props: SpatialMapToolbarProps) {
  const spatialMap = useSpatialMap();

  return (
    <Box class="spatial-map-topbar">
      <HStack gap="3" alignItems="center" class="spatial-map-topbar-copy">
        {props.backHref ? (
          <A href={props.backHref} class="spatial-map-backlink">
            {props.backLabel ?? "Back"}
          </A>
        ) : null}
        <Box>
          <Text as="span" class="spatial-map-eyebrow">
            {props.eyebrow ?? "System map / operator view"}
          </Text>
          <Box as="h1" class="spatial-map-title">
            {props.title ?? "Recipe Architecture Grid"}
          </Box>
          {props.subtitle ? (
            <Text as="p" class="spatial-map-subtitle">
              {props.subtitle}
            </Text>
          ) : null}
        </Box>
      </HStack>

      <HStack gap="1.5" flexWrap="wrap" justifyContent="flex-end" class="spatial-map-control-strip">
        {spatialMap.isolationModeActive() ? (
          <>
            <Text as="span" class="spatial-map-isolation-readout">
              Isolated: {spatialMap.isolationLabel() ?? "Current node"}
            </Text>
            <Button
              colorPalette="green"
              variant="outline"
              size="xs"
              class="spatial-map-button"
              onClick={() => spatialMap.clearIsolation()}
            >
              Clear Isolation
            </Button>
          </>
        ) : null}
        <Button
          colorPalette="green"
          variant="surface"
          size="xs"
          class="spatial-map-button spatial-map-button--strong"
          onClick={() => spatialMap.openAddNodesFlow()}
        >
          Add Nodes
        </Button>
        <SpatialMapCreateContextNodeDialog
          projectId={props.projectId}
          onProjectUpdated={props.onProjectUpdated}
        />
        <HStack gap="0" class="spatial-map-toggle-group" aria-label="Map view mode">
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "canvas" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-button spatial-map-toggle-button${spatialMap.viewMode() === "canvas" ? " is-active" : ""}`}
            aria-pressed={spatialMap.viewMode() === "canvas"}
            onClick={() => spatialMap.setViewMode("canvas")}
          >
            Canvas
          </Button>
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "tree" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-button spatial-map-toggle-button${spatialMap.viewMode() === "tree" ? " is-active" : ""}`}
            aria-pressed={spatialMap.viewMode() === "tree"}
            onClick={() => spatialMap.setViewMode("tree")}
          >
            Tree
          </Button>
        </HStack>
        <HStack gap="0" class="spatial-map-toggle-group" aria-label="Displayed hierarchy depth">
          <For each={spatialMap.availableDepthLevels()}>
            {(level) => (
              <Button
                colorPalette="green"
                variant={spatialMap.visibleDepthLevel() === level ? "surface" : "outline"}
                size="xs"
                class={`spatial-map-button spatial-map-depth-button${spatialMap.visibleDepthLevel() === level ? " is-active" : ""}`}
                aria-label={`Show ${level} hierarchy ${level === 1 ? "level" : "levels"}`}
                aria-pressed={spatialMap.visibleDepthLevel() === level}
                onClick={() => spatialMap.setVisibleDepthLevel(level)}
              >
                {level}
              </Button>
            )}
          </For>
        </HStack>
        <Button
          colorPalette="green"
          variant="outline"
          size="xs"
          class="spatial-map-button"
          onClick={() => spatialMap.toggleEdges()}
        >
          {spatialMap.showEdges() ? "Hide Edges" : "Show Edges"}
        </Button>
        <Button
          colorPalette="green"
          variant="surface"
          size="xs"
          class="spatial-map-button spatial-map-button--strong"
          onClick={() => spatialMap.reflowLayout()}
        >
          Reflow Layout
        </Button>
        <Text as="span" class="spatial-map-zoom-readout">
          Zoom {spatialMap.zoomPercent()}
        </Text>
        <Button
          colorPalette="green"
          variant="plain"
          size="xs"
          class="spatial-map-button"
          onClick={() => spatialMap.fitCameraToNodes()}
        >
          Fit View <span class="spatial-map-shortcut">F</span>
        </Button>
        {!spatialMap.inspectorOpen() ? <InspectorToggle inToolbar /> : null}
      </HStack>
    </Box>
  );
}
