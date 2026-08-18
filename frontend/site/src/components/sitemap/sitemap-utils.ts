import type { SitemapApiEntry } from "@/lib/seo";

export type SitemapNode = {
  path: string;
  title: string;
  entry?: SitemapApiEntry;
  children: SitemapNode[];
};

export type SitemapSectionData = {
  key: string;
  title: string;
  nodes: SitemapNode[];
  count: number;
};

export function normalizeSitemapPath(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const noTrailing = withSlash.replace(/\/+$/, "");
  return noTrailing || "/";
}

export function titleFromPath(path: string): string {
  const normalized = normalizeSitemapPath(path);
  if (normalized === "/") return "Home";
  const last = normalized.split("/").filter(Boolean).pop() || normalized;
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSitemapDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function lastUpdatedLabel(entry?: SitemapApiEntry): string | null {
  if (!entry) return null;
  return formatSitemapDate(entry.lastmod) || formatSitemapDate(entry.updated_at);
}

export function countNodes(nodes: SitemapNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

function buildTree(entries: SitemapApiEntry[]): SitemapNode[] {
  const nodes = new Map<string, SitemapNode>();

  for (const entry of entries) {
    const path = normalizeSitemapPath(entry.url_path);
    nodes.set(path, {
      path,
      title: titleFromPath(path),
      entry,
      children: [],
    });
  }

  const sortedPaths = [...nodes.keys()].sort((a, b) => {
    const depth = a.split("/").filter(Boolean).length - b.split("/").filter(Boolean).length;
    return depth || a.localeCompare(b);
  });

  const roots: SitemapNode[] = [];
  for (const path of sortedPaths) {
    const node = nodes.get(path);
    if (!node) continue;
    if (path === "/") {
      roots.push(node);
      continue;
    }
    const parts = path.split("/").filter(Boolean);
    let parent: SitemapNode | undefined;
    for (let i = parts.length - 1; i >= 1; i -= 1) {
      parent = nodes.get(`/${parts.slice(0, i).join("/")}`);
      if (parent) break;
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

function collectSectionNodes(root: SitemapNode): SitemapNode[] {
  return [root];
}

export function groupSitemapSections(entries: SitemapApiEntry[]): SitemapSectionData[] {
  const tree = buildTree(entries);
  return tree
    .map((root) => {
      const nodes = collectSectionNodes(root);
      return {
        key: root.path,
        title: root.title,
        nodes,
        count: countNodes(nodes),
      };
    })
    .sort((a, b) => {
      if (a.key === "/") return -1;
      if (b.key === "/") return 1;
      return a.title.localeCompare(b.title);
    });
}

function nodeMatchesQuery(node: SitemapNode, query: string): boolean {
  if (!query) return true;
  const haystack = `${node.title} ${node.path}`.toLowerCase();
  if (haystack.includes(query)) return true;
  return node.children.some((child) => nodeMatchesQuery(child, query));
}

export function filterSitemapTree(nodes: SitemapNode[], query: string): SitemapNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes
    .map((node) => {
      const children = filterSitemapTree(node.children, q);
      if (nodeMatchesQuery(node, q) || children.length) {
        const selfMatch = `${node.title} ${node.path}`.toLowerCase().includes(q);
        return {
          ...node,
          children: selfMatch ? node.children : children,
        };
      }
      return null;
    })
    .filter((node): node is SitemapNode => node != null);
}

export function filterSitemapSections(
  sections: SitemapSectionData[],
  query: string,
  categoryKey: string,
): SitemapSectionData[] {
  return sections
    .filter((section) => categoryKey === "all" || section.key === categoryKey)
    .map((section) => {
      const nodes = filterSitemapTree(section.nodes, query);
      return {
        ...section,
        nodes,
        count: countNodes(nodes),
      };
    })
    .filter((section) => section.count > 0);
}
