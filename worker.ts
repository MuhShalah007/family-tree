interface TreeData {
  persons: unknown[];
  relationships: unknown[];
  rootPersonId: string | null;
  editKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Env {
  TREES: KVNamespace;
  ASSETS: Fetcher;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function createShortId(): string {
  return crypto.randomUUID().split("-")[0];
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function optionsResponse(): Response {
  return new Response(null, {
    headers: CORS_HEADERS,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/trees")) {
      if (request.method === "OPTIONS") {
        return optionsResponse();
      }

      if (url.pathname === "/api/trees" && request.method === "POST") {
        try {
          const body = (await request.json()) as TreeData;
          const id = createShortId();
          const editKey = createShortId();

          const data: TreeData = {
            persons: body.persons ?? [],
            relationships: body.relationships ?? [],
            rootPersonId: body.rootPersonId ?? null,
            editKey,
            createdAt: new Date().toISOString(),
          };

          await env.TREES.put(id, JSON.stringify(data));
          return jsonResponse({ id, editKey });
        } catch (error) {
          return jsonResponse({ error: `Invalid request: ${String(error)}` }, { status: 400 });
        }
      }

      const idMatch = url.pathname.match(/^\/api\/trees\/([^/]+)$/);
      if (!idMatch) {
        return jsonResponse({ error: "Not found" }, { status: 404 });
      }

      const treeId = idMatch[1];

      if (request.method === "GET") {
        const stored = await env.TREES.get(treeId);
        if (!stored) {
          return jsonResponse({ error: "Not found" }, { status: 404 });
        }

        const tree = JSON.parse(stored) as TreeData;
        const { editKey: _editKey, ...publicTree } = tree;
        return jsonResponse(publicTree);
      }

      if (request.method === "PUT") {
        const stored = await env.TREES.get(treeId);
        if (!stored) {
          return jsonResponse({ error: "Not found" }, { status: 404 });
        }

        const tree = JSON.parse(stored) as TreeData;

        try {
          const payload = (await request.json()) as { editKey: string; treeData: TreeData };
          if (payload.editKey !== tree.editKey) {
            return jsonResponse({ error: "Unauthorized" }, { status: 403 });
          }

          const updated: TreeData = {
            ...tree,
            persons: payload.treeData?.persons ?? tree.persons,
            relationships: payload.treeData?.relationships ?? tree.relationships,
            rootPersonId: payload.treeData?.rootPersonId ?? tree.rootPersonId,
            updatedAt: new Date().toISOString(),
          };

          await env.TREES.put(treeId, JSON.stringify(updated));
          return jsonResponse({ success: true });
        } catch (error) {
          return jsonResponse({ error: `Invalid request: ${String(error)}` }, { status: 400 });
        }
      }

      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const isGetOrHead = request.method === "GET" || request.method === "HEAD";
    const looksLikeFile = /\.[a-zA-Z0-9]+$/.test(url.pathname);
    if (isGetOrHead && !looksLikeFile) {
      const appShellUrl = new URL("/", url.origin);
      return env.ASSETS.fetch(new Request(appShellUrl.toString(), request));
    }

    return assetResponse;
  },
};
