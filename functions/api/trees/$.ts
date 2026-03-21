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

  console.log("API Request:", request.method, url.pathname);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (url.pathname === "/api/trees" && request.method === "POST") {
    try {
      const bodyText = await request.text();
      console.log("Request body:", bodyText);
      
      const body = JSON.parse(bodyText) as TreeData;
      const id = uuid();
      const editKey = uuid();
      
      const data: TreeData = {
        ...body,
        editKey,
        createdAt: new Date().toISOString(),
      };
      
      await env.TREES.put(id, JSON.stringify(data));
      console.log("Saved tree:", id);
      
      return new Response(JSON.stringify({ id, editKey }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Error POST:", e);
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  const match = url.pathname.match(/^\/api\/trees\/([^/]+)$/);
  if (match) {
    const id = match[1];
    console.log("Tree ID:", id);

    if (request.method === "GET") {
      try {
        const data = await env.TREES.get(id);
        console.log("Got data:", data);
        
        if (!data) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
        
        const tree = JSON.parse(data) as TreeData;
        const { editKey, ...publicData } = tree;
        
        return new Response(JSON.stringify(publicData), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error GET:", e);
        return new Response(JSON.stringify({ error: "Error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    if (request.method === "PUT") {
      try {
        const stored = await env.TREES.get(id);
        if (!stored) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const tree = JSON.parse(stored) as TreeData;
        const { editKey: reqEditKey, treeData } = JSON.parse(await request.text()) as { editKey: string; treeData: TreeData };
        
        if (tree.editKey !== reqEditKey) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const updated: TreeData = {
          ...tree,
          ...treeData,
          updatedAt: new Date().toISOString(),
        };
        
        await env.TREES.put(id, JSON.stringify(updated));
        console.log("Updated tree:", id);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error PUT:", e);
        return new Response(JSON.stringify({ error: "Error" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }
  }

  return new Response("Not found", { status: 404 });
};
