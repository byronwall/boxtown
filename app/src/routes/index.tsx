import { createAsync } from "@solidjs/router";
import { Show } from "solid-js";
import SpatialMapPage from "~/components/spatial-map/SpatialMapPage";
import { getSpatialMapData } from "~/lib/spatial-map/data";

export default function HomeRoute() {
  const data = createAsync(() => getSpatialMapData());

  return <Show when={data()}>{(resolvedData) => <SpatialMapPage data={resolvedData()} />}</Show>;
}
