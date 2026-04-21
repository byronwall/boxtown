import { createAsync } from "@solidjs/router";
import { Show } from "solid-js";
import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import { getSpatialMapData } from "~/lib/spatial-map/data";

export default function HomeRoute() {
  const data = createAsync(() => getSpatialMapData());

  return <Show when={data()}>{(resolvedData) => <SpatialMapCanvas data={resolvedData()} />}</Show>;
}
