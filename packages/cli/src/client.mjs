import { readFile } from "node:fs/promises";
import path from "node:path";
import { CliError, apiErrorToExitCode } from "./errors.mjs";
import { cliUserAgent } from "./version.mjs";

export class ProductGridClient {
  constructor({ server, token = null, userAgent = cliUserAgent }) {
    this.server = server;
    this.token = token;
    this.userAgent = userAgent;
  }

  listProjects() {
    return this.request("/api/v1/projects").then((body) => body.projects ?? []);
  }

  createProject(input = {}) {
    return this.request("/api/v1/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    }).then((body) => body.project);
  }

  getProject(projectId) {
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}`).then(
      (body) => body.project,
    );
  }

  getProjectSchema(projectId) {
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/schema`).then(
      (body) => body.schema,
    );
  }

  listNodes(projectId, filters = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, value);
      }
    }

    const suffix = searchParams.size > 0 ? `?${searchParams}` : "";
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/nodes${suffix}`).then(
      (body) => body.nodes ?? [],
    );
  }

  getNode(projectId, nodeId, options = {}) {
    const searchParams = new URLSearchParams();
    if (options.fields) {
      searchParams.set("fields", options.fields);
    }
    const suffix = searchParams.size > 0 ? `?${searchParams}` : "";
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}${suffix}`,
    ).then((body) => body.node);
  }

  getNodeContextTree(projectId, nodeId, options = {}) {
    const searchParams = new URLSearchParams();
    if (options.fields) {
      searchParams.set("fields", options.fields);
    }
    if (options.compact) {
      searchParams.set("compact", "true");
    }
    const suffix = searchParams.size > 0 ? `?${searchParams}` : "";
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/context-tree${suffix}`,
    );
  }

  createNode(projectId, input) {
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
  }

  updateNode(projectId, nodeId, input) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
  }

  getNodeContext(projectId, nodeId) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/context`,
    );
  }

  setNodeContext(projectId, nodeId, context) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/context`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ context }),
      },
    );
  }

  getNodeMetadata(projectId, nodeId) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/metadata`,
    );
  }

  patchNodeMetadata(projectId, nodeId, input) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/metadata`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
  }

  moveNode(projectId, nodeId, input) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/move`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
  }

  deleteNode(projectId, nodeId, options = {}) {
    const suffix = options.includeChildren ? "?children=true" : "";
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}${suffix}`,
      { method: "DELETE" },
    );
  }

  importMarkdown(projectId, input) {
    return this.request(`/api/v1/projects/${encodeURIComponent(projectId)}/imports/markdown`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
  }

  async addNodeImages(projectId, nodeId, imagePaths) {
    const formData = new FormData();
    for (const imagePath of imagePaths) {
      const bytes = await readFile(imagePath);
      formData.append(
        "images",
        new File([bytes], path.basename(imagePath), {
          type: getMimeType(imagePath),
        }),
      );
    }

    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/images`,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  listNodeImages(projectId, nodeId) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/images`,
    );
  }

  removeNodeImage(projectId, nodeId, imageId) {
    return this.request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/images`,
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ imageId }),
      },
    );
  }

  exportProjectMarkdown(projectId) {
    return this.requestText(
      `/api/v1/projects/${encodeURIComponent(projectId)}/exports/markdown`,
    );
  }

  downloadAsset(assetPath) {
    return this.requestBytes(assetPath);
  }

  async request(pathname, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("user-agent", this.userAgent);
    if (this.token) {
      headers.set("authorization", `Bearer ${this.token}`);
    }

    let response;
    try {
      response = await fetch(`${this.server}${pathname}`, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new CliError(
        `Could not reach ${this.server}. Is the dev server running? ${formatCause(error)}`,
        1,
      );
    }

    const text = await response.text();
    const body = text ? safeJson(text) : {};

    if (!response.ok) {
      const apiError = body?.error ?? {};
      const message = apiError.message ?? `Request failed with HTTP ${response.status}.`;
      throw new CliError(message, apiErrorToExitCode(apiError.code, response.status));
    }

    return body;
  }

  async requestText(pathname, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("accept", "text/markdown");
    headers.set("user-agent", this.userAgent);
    if (this.token) {
      headers.set("authorization", `Bearer ${this.token}`);
    }

    let response;
    try {
      response = await fetch(`${this.server}${pathname}`, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new CliError(
        `Could not reach ${this.server}. Is the dev server running? ${formatCause(error)}`,
        1,
      );
    }

    const text = await response.text();
    if (!response.ok) {
      const body = text ? safeJson(text) : {};
      const apiError = body?.error ?? {};
      const message = apiError.message ?? `Request failed with HTTP ${response.status}.`;
      throw new CliError(message, apiErrorToExitCode(apiError.code, response.status));
    }

    return text;
  }

  async requestBytes(pathname, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("user-agent", this.userAgent);
    if (this.token) {
      headers.set("authorization", `Bearer ${this.token}`);
    }

    let response;
    try {
      response = await fetch(resolveRequestUrl(this.server, pathname), {
        ...init,
        headers,
      });
    } catch (error) {
      throw new CliError(
        `Could not reach ${this.server}. Is the dev server running? ${formatCause(error)}`,
        1,
      );
    }

    if (!response.ok) {
      throw new CliError(`Asset download failed with HTTP ${response.status}.`, apiErrorToExitCode(undefined, response.status));
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

function resolveRequestUrl(server, pathname) {
  if (/^https?:\/\//i.test(pathname)) {
    return pathname;
  }
  return `${server}${pathname}`;
}

function getMimeType(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }

  return "application/octet-stream";
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function formatCause(error) {
  return error instanceof Error && error.message ? error.message : "";
}
