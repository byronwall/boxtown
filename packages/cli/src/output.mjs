export function writeJson(value, stdout = process.stdout) {
  writeStdout(stdout, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTable(rows, columns, stdout = process.stdout) {
  if (rows.length === 0) {
    writeStdout(stdout, "No results.\n");
    return;
  }

  const widths = columns.map((column) => {
    const values = rows.map((row) => String(column.value(row) ?? ""));
    return Math.max(column.header.length, ...values.map((value) => value.length));
  });

  writeStdout(stdout, `${columns.map((column, index) => column.header.padEnd(widths[index])).join("  ")}\n`);
  writeStdout(stdout, `${widths.map((width) => "-".repeat(width)).join("  ")}\n`);

  for (const row of rows) {
    writeStdout(stdout,
      `${columns
        .map((column, index) => String(column.value(row) ?? "").padEnd(widths[index]))
        .join("  ")}\n`,
    );
  }
}

export function pickProjectColumns() {
  return [
    { header: "ID", value: (row) => row.id },
    { header: "NAME", value: (row) => row.name },
    { header: "NODES", value: (row) => row.nodeCount },
    { header: "UPDATED", value: (row) => formatDate(row.updatedAt) },
  ];
}

export function pickNodeColumns() {
  return [
    { header: "ID", value: (row) => row.id },
    { header: "STATUS", value: (row) => row.status },
    { header: "TYPE", value: (row) => row.type },
    { header: "TITLE", value: (row) => row.titlePath ?? row.label ?? row.title },
  ];
}

function formatDate(value) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";
}

export function writeStdout(stdout, chunk) {
  try {
    stdout.write(chunk);
  } catch (error) {
    if (error?.code === "EPIPE") {
      return;
    }
    throw error;
  }
}
