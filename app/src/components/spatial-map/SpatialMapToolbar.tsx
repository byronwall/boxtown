import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { useSpatialMap } from "./SpatialMapContext";

export function SpatialMapToolbar() {
  const spatialMap = useSpatialMap();

  return (
    <Box class="spatial-map-topbar">
      <HStack gap="3" alignItems="center" class="spatial-map-topbar-copy">
        <Text as="span" class="spatial-map-eyebrow">
          System map / operator view
        </Text>
        <Box as="h1" class="spatial-map-title">
          Recipe Architecture Grid
        </Box>
      </HStack>

      <HStack gap="1.5" flexWrap="wrap" justifyContent="flex-end" class="spatial-map-control-strip">
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
      </HStack>
    </Box>
  );
}
