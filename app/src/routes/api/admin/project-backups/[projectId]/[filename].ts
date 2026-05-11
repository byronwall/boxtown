import type { APIEvent } from "@solidjs/start/server";
import { readProjectBackupFileFromDisk } from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  const backup = await readProjectBackupFileFromDisk({
    projectId: event.params.projectId,
    filename: event.params.filename,
  });

  if (!backup) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(event.request.url);
  const shouldDownload = url.searchParams.get("download") === "1";

  return new Response(new Uint8Array(backup.data), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${backup.filename}"`,
      "content-length": String(backup.size),
      "content-type": "application/json; charset=utf-8",
    },
  });
}
