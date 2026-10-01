import { useAction } from "@solidjs/router";
import { Upload } from "lucide-solid";
import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { toaster } from "~/components/ui/toast";
import { importProject } from "~/lib/projects/data";

// One button: choosing a ZIP starts the import, so there is no separate
// file field and submit step.
export function ProjectImportControl() {
  const submitImportProject = useAction(importProject);
  const [pending, setPending] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;

  const importArchive = (file: File | undefined) => {
    if (!file || pending()) {
      return;
    }

    // The server action reads the archive from FormData.
    const formData = new FormData();
    formData.set("archive", file);

    setPending(true);
    void submitImportProject(formData).catch((error) => {
      setPending(false);
      toaster.error({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "The project archive could not be imported.",
      });
    });
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          importArchive(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        size="xs"
        variant="outline"
        loading={pending()}
        loadingText="Importing"
        onClick={() => fileInput?.click()}
      >
        <Upload size={14} />
        Import archive
      </Button>
    </>
  );
}
