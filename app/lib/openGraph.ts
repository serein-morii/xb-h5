export type ShareSurface = "order" | "otp" | "lab" | "volunteer" | "peach";

function upsertMeta(selector: string, attr: "content", value: string, create: { property?: string; name?: string }) {
  let node = document.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    if (create.property) node.setAttribute("property", create.property);
    if (create.name) node.setAttribute("name", create.name);
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
}

export function resolveShareSurface(pathname: string): ShareSurface {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/otp" || path.startsWith("/otp/") || path.startsWith("/s/") || path.startsWith("/t/")) return "otp";
  if (path === "/lab" || path.startsWith("/lab/") || path === "/bead-studio" || path === "/utilities" || path.startsWith("/handy/")) return "lab";
  if (path === "/volunteer" || path.startsWith("/volunteer/")) return "volunteer";
  if (path === "/peach" || path.startsWith("/customer/")) return "peach";
  return "order";
}

export function applyOpenGraph(title: string, description: string, surface: ShareSurface = "order") {
  const origin = window.location.origin;
  const image = `${origin}/og-${surface}.png`;
  const url = `${origin}${window.location.pathname}${window.location.search}`;
  document.title = title;
  upsertMeta('meta[name="description"]', "content", description, { name: "description" });
  upsertMeta('meta[property="og:title"]', "content", title, { property: "og:title" });
  upsertMeta('meta[property="og:description"]', "content", description, { property: "og:description" });
  upsertMeta('meta[property="og:image"]', "content", image, { property: "og:image" });
  upsertMeta('meta[property="og:image:width"]', "content", "478", { property: "og:image:width" });
  upsertMeta('meta[property="og:image:height"]', "content", "478", { property: "og:image:height" });
  upsertMeta('meta[property="og:url"]', "content", url, { property: "og:url" });
  upsertMeta('meta[property="og:type"]', "content", "website", { property: "og:type" });
  upsertMeta('meta[name="twitter:card"]', "content", "summary", { name: "twitter:card" });
  upsertMeta('meta[name="twitter:image"]', "content", image, { name: "twitter:image" });
}
