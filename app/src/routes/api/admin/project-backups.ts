import { listProjectBackupFilesFromDisk } from "~/lib/projects/data.server";

export async function GET() {
  const backups = await listProjectBackupFilesFromDisk();

  return new Response(JSON.stringify(backups), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
