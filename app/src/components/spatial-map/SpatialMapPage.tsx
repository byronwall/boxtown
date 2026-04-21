import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import type { SpatialMapData } from "~/lib/spatial-map/types";

interface SpatialMapPageProps {
  data: SpatialMapData;
}

export default function SpatialMapPage(props: SpatialMapPageProps) {
  return <SpatialMapCanvas data={props.data} />;
}
