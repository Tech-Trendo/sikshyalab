import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type SeoPage } from "@/components/dashboard/DashboardDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Share2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paginate } from "@/lib/dashboard-utils";
import { apiList, apiMutateDetailed, type ApiSeoRow } from "@/lib/dashboard-api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDirtyForm } from "@/hooks/useDirtyForm";

export const Route = createFileRoute("/dashboard/seo")({
  component: SeoPageView,
});

const emptyTrackForm = {
  url: "",
  title: "",
  description: "",
  keywords: "",
  ogImage: "",
  robots: "index,follow",
};

function normalizeSeoPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      return u.pathname || "/";
    }
  } catch {
    return null;
  }
  if (trimmed.startsWith("/")) return trimmed.split("?")[0] || "/";
  if (/^[a-z0-9][a-z0-9-._/]*$/i.test(trimmed)) {
    return `/${trimmed.replace(/^\/+/, "")}`;
  }
  return null;
}

function slugFromPath(path: string): string {
  const cleaned = path.replace(/^\/+|\/+$/g, "");
  return cleaned.replace(/\//g, "-") || "home";
}

function toCanonicalUrl(raw: string, path: string): string {
  if (/^https?:\/\//i.test(raw.trim())) return raw.trim();
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/:\d+$/, "");
    return `${origin}${path}`;
  }
  return path;
}

function mapApiSeoRow(row: ApiSeoRow): SeoPage {
  const path = row.canonical_url || (row.slug ? `/${row.slug}` : "/");
  let displayPath = path;
  try {
    if (/^https?:\/\//i.test(path)) displayPath = new URL(path).pathname || "/";
  } catch {
    displayPath = path;
  }
  return {
    id: String(row.id),
    path: displayPath,
    title: row.meta_title || row.slug || "Page",
    score: row.calculated_score ?? row.seo_score ?? 80,
    description: row.meta_description || undefined,
    keywords: row.meta_keywords || undefined,
    canonical: row.canonical_url || undefined,
    ogImage: row.og_image || undefined,
    robots: row.robots || undefined,
    createdAt: row.created_at,
  };
}

function SeoPageView() {
  const { seoPages, updateSeoPage, addSeoPage } = useDashboardData();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SeoPage | null>(null);
  const [trackForm, setTrackForm] = useState(emptyTrackForm);
  const [editingBaseline, setEditingBaseline] = useState<SeoPage | null>(null);
  const [savingTrack, setSavingTrack] = useState(false);
  const seoEditDirty = useDirtyForm(editing, editingBaseline, Boolean(editing));

  const orderedPages = useMemo(
    () =>
      [...seoPages].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }),
    [seoPages],
  );
  const paged = paginate(orderedPages, page);
  const trackPath = normalizeSeoPath(trackForm.url);
  const trackDirty = Boolean(trackPath);

  useEffect(() => {
    setPage(1);
  }, [seoPages.length]);

  const startTracking = async () => {
    const path = normalizeSeoPath(trackForm.url);
    if (!path) {
      toast.error("Add a valid page URL or path (e.g. /about or https://example.com/about)");
      return;
    }
    setSavingTrack(true);
    try {
      const existing = seoPages.find((p) => p.path === path);
      if (existing) {
        updateSeoPage(existing.path, {
          title: trackForm.title || existing.title,
          description: trackForm.description,
          keywords: trackForm.keywords,
          canonical: toCanonicalUrl(trackForm.url, path),
          ogImage: trackForm.ogImage,
          robots: trackForm.robots,
        });
        addSeoPage({
          ...existing,
          title: trackForm.title || existing.title,
          description: trackForm.description,
          keywords: trackForm.keywords,
          canonical: toCanonicalUrl(trackForm.url, path),
          ogImage: trackForm.ogImage,
          robots: trackForm.robots,
          createdAt: new Date().toISOString(),
        });
        toast.success(`Updated tracking for ${path}`);
        setTrackForm(emptyTrackForm);
        setPage(1);
        return;
      }

      const types = await apiList<{ id: number; app_label: string; model: string; label: string }>(
        "/seo/content-types/",
      );
      const pageType =
        types.find((t) => t.label === "cms.page" || (t.app_label === "cms" && t.model === "page")) ||
        types.find((t) => t.model === "page") ||
        types[0];
      if (!pageType?.id) {
        toast.error("Could not start tracking — no SEO content type available");
        return;
      }

      const basePayload = {
        content_type: pageType.id,
        object_id: crypto.randomUUID?.() || `${Date.now()}`,
        slug: slugFromPath(path),
        meta_title: trackForm.title.trim() || path,
        meta_description: trackForm.description.trim(),
        meta_keywords: trackForm.keywords.trim(),
        robots: trackForm.robots.trim() || "index,follow",
        is_indexed: true,
        structured_data: trackForm.ogImage.trim()
          ? { og_image_url: trackForm.ogImage.trim() }
          : undefined,
      };
      let result = await apiMutateDetailed<ApiSeoRow>("/seo/metadata/", "POST", {
        ...basePayload,
        canonical_url: path,
      });
      if (!result.data) {
        result = await apiMutateDetailed<ApiSeoRow>("/seo/metadata/", "POST", {
          ...basePayload,
          canonical_url: toCanonicalUrl(trackForm.url, path),
        });
      }
      if (!result.data) {
        toast.error(result.error || "Could not start tracking this page");
        return;
      }
      addSeoPage({
        ...mapApiSeoRow(result.data),
        path,
        createdAt: result.data.created_at || new Date().toISOString(),
      });
      toast.success(`Started tracking ${path}`);
      setTrackForm(emptyTrackForm);
      setPage(1);
    } finally {
      setSavingTrack(false);
    }
  };

  return (
    <>
      <PageHeader
        title="SEO Management"
        subtitle="Titles, descriptions, canonical URLs, and social previews power the public site metadata."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Pages tracked" value={seoPages.length} icon={FileText} tone="primary" />
        <StatCard
          label="Social ready"
          value={seoPages.filter((p) => p.ogImage || p.description).length}
          icon={Share2}
          tone="highlight"
        />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-5">
          <p className="mb-1 text-sm font-semibold">Pages</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Newly tracked pages appear at the top. Course SEO is also editable under Courses → Edit → SEO.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Title</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.items.map((p) => (
                <TableRow key={p.path}>
                  <TableCell className="font-mono text-xs">{p.path}</TableCell>
                  <TableCell className="text-sm">{p.title}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing({ ...p });
                        setEditingBaseline({ ...p });
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-6">
          <p className="mb-1 text-sm font-semibold">Track a page</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Add a valid page URL or path, then start tracking. The page is added to the top of the table.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Page URL</Label>
              <Input
                className="mt-1.5"
                value={trackForm.url}
                onChange={(e) => setTrackForm({ ...trackForm, url: e.target.value })}
                placeholder="/about or https://yoursite.com/about"
              />
            </div>
            <div>
              <Label>Meta title</Label>
              <Input
                className="mt-1.5"
                value={trackForm.title}
                onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Keywords</Label>
              <Input
                className="mt-1.5"
                value={trackForm.keywords}
                onChange={(e) => setTrackForm({ ...trackForm, keywords: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Meta description</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={trackForm.description}
                onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>OG image URL</Label>
              <Input
                className="mt-1.5"
                value={trackForm.ogImage}
                onChange={(e) => setTrackForm({ ...trackForm, ogImage: e.target.value })}
                placeholder="https://… or /media/seo/og/…"
              />
            </div>
            <div>
              <Label>Robots</Label>
              <Input
                className="mt-1.5"
                value={trackForm.robots}
                onChange={(e) => setTrackForm({ ...trackForm, robots: e.target.value })}
                placeholder="index,follow"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                className="btn-highlight"
                disabled={!trackDirty || savingTrack}
                onClick={() => void startTracking()}
              >
                {savingTrack ? "Saving…" : "Start tracking"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SEO — {editing?.path}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Title</Label>
                <Input
                  className="mt-1.5"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Keywords</Label>
                <Input
                  className="mt-1.5"
                  value={editing.keywords || ""}
                  onChange={(e) => setEditing({ ...editing, keywords: e.target.value })}
                />
              </div>
              <div>
                <Label>Canonical</Label>
                <Input
                  className="mt-1.5"
                  value={editing.canonical || editing.path}
                  onChange={(e) => setEditing({ ...editing, canonical: e.target.value })}
                />
              </div>
              <div>
                <Label>OG image URL</Label>
                <Input
                  className="mt-1.5"
                  value={editing.ogImage || ""}
                  onChange={(e) => setEditing({ ...editing, ogImage: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!seoEditDirty}
              onClick={() => {
                if (!editing) return;
                updateSeoPage(editing.path, editing);
                toast.success(`Updated SEO for ${editing.path}`);
                setEditing(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
