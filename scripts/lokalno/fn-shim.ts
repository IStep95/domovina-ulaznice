// Poslužuje supabase/functions/events-*/index.ts na :55390 pod /functions/v1/<ime>,
// ostalo proxyja na Kong :55321.
const root = Deno.env.get("FN_ROOT")!;
const handlers = new Map<string, (r: Request) => Response | Promise<Response>>();
let current = "";
const realServe = Deno.serve;
Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: (a: any, b?: any) => {
    const h = typeof a === "function" ? a : (b ?? a.handler);
    handlers.set(current, h);
    return { finished: new Promise(() => {}), shutdown() {}, ref() {}, unref() {} };
  },
});
for await (const e of Deno.readDir(root)) {
  if (!e.isDirectory || !e.name.startsWith("events-")) continue;
  current = e.name;
  await import(`file://${root}/${e.name}/index.ts`);
  console.log("loaded", e.name, handlers.has(e.name));
}
realServe({ port: 55390, hostname: "127.0.0.1" }, async (req) => {
  const u = new URL(req.url);
  const m = u.pathname.match(/^\/functions\/v1\/([^/]+)/);
  if (m && handlers.has(m[1])) return await handlers.get(m[1])!(req);
  const target = "http://127.0.0.1:55321" + u.pathname + u.search;
  const h = new Headers(req.headers); h.delete("host");
  return fetch(target, { method: req.method, headers: h, body: req.body, redirect: "manual" });
});
