import { createMemo } from "solid-js";
import { ensureProjectNodeTypeOptions } from "~/lib/projects/node-types";
import type { ProjectRecord } from "~/lib/projects/types";
import { SpatialMapNodeAttributeMenu } from "./SpatialMapNodeAttributeMenu";

type SpatialMapNodeTypePickerProps = {
  project: ProjectRecord;
  type: string;
  pending?: boolean;
  showLabel?: boolean;
  variant?: "inspector" | "tree";
  onChange: (type: string) => void;
};

export function SpatialMapNodeTypePicker(props: SpatialMapNodeTypePickerProps) {
  const options = createMemo(() =>
    ensureProjectNodeTypeOptions(props.project.nodeTypeSchema, props.type),
  );

  return (
    <SpatialMapNodeAttributeMenu
      ariaLabel={`Change node type. Current type: ${props.type}`}
      class="spatial-map-type-chip"
      currentLabel={props.type}
      currentValue={props.type}
      items={options().map((item) => ({
        label: item.name,
        value: item.name,
      }))}
      label={props.showLabel ? "Type" : undefined}
      menuClass="spatial-map-type-menu"
      searchable
      searchPlaceholder="Filter types"
      pending={Boolean(props.pending)}
      variant={props.variant ?? "tree"}
      onChange={(value) => {
        if (value) props.onChange(value);
      }}
    />
  );
}
