export interface Env {
  TREES: KVNamespace;
}

interface TreeData {
  persons: unknown[];
  relationships: unknown[];
  rootPersonId: string | null;
  editKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function uuid(): string {
  return crypto.randomUUID().split("-")[0];
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (url.pathname === "/api/trees" && request.method === "POST") {
    try {
      const body = await request.json() as TreeData;
      const id = uuid();
      const editKey = uuid();
      
      const data: TreeData = {
        persons: body.persons || [],
        relationships: body.relationships || [],
        rootPersonId: body.rootPersonId,
        editKey,
        createdAt: new Date().toISOString(),
      };
      
      await env.TREES.put(id, JSON.stringify(data));
      
      return new Response(JSON.stringify({ id, editKey }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
