import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type SeoPage } from "@/components/dashboard/DashboardDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Globe, Search, Share2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paginate } from "@/lib/dashboard-utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDirtyForm } from "@/hooks/useDirtyForm";

export const Route = createFileRoute("/dashboard/seo")({
  component: SeoPageView,
});

function SeoPageView() {
  const { seoPages, updateSeoPage } = useDashboardData();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SeoPage | null>(null);
  const home = seoPages.find((p) => p.path === "/") || seoPages[0];
  const [homeForm, setHomeForm] = useState({
    title: "",
    description: "",
    keywords: "",
    canonical: "/",
    ogImage: "",
    robots: "index,follow",
  });
  const [homeBaseline, setHomeBaseline] = useState<typeof homeForm | null>(null);
  const [editingBaseline, setEditingBaseline] = useState<SeoPage | null>(null);
  const homeDirty = useDirtyForm(homeForm, homeBaseline, Boolean(homeBaseline));
  const seoEditDirty = useDirtyForm(editing, editingBaseline, Boolean(editing));

  const homeHydrated = useRef(false);

  useEffect(() => {
    if (homeHydrated.current || !home) return;
    homeHydrated.current = true;
    const next = {
      title: home.title || "",
      description: home.description || "",
      keywords: home.keywords || "",
      canonical: home.canonical || home.path || "/",
      ogImage: home.ogImage || "",
      robots: home.robots || "index,follow",
    };
    setHomeForm(next);
    setHomeBaseline(next);
  }, [home]);

  const paged = paginate(seoPages, page);
  const avgScore = useMemo(
    () => Math.round(seoPages.reduce((n, p) => n + p.score, 0) / Math.max(1, seoPages.length)),
    [seoPages],
  );

  const saveHome = () => {
    if (!home) {
      toast.error("No SEO row for homepage yet — create one in Django admin or seed metadata.");
      return;
    }
    updateSeoPage(home.path, {
      title: homeForm.title,
      description: homeForm.description,
      keywords: homeForm.keywords,
      canonical: homeForm.canonical,
      ogImage: homeForm.ogImage,
      robots: homeForm.robots,
      score: Math.min(
        100,
        Math.max(60, homeForm.title.length > 20 && homeForm.description.length > 50 ? 95 : 80),
      ),
    });
    toast.success("SEO settings saved");
    setHomeBaseline(homeForm);
  };

  return (
    <>
      <PageHeader
        title="SEO Management"
        subtitle="Titles, descriptions, canonical URLs, and social previews power the public site metadata, sitemap, and robots."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pages tracked" value={seoPages.length} icon={FileText} tone="primary" />
        <StatCard label="Avg score" value={String(avgScore)} icon={Search} tone="success" />
        <StatCard label="Social ready" value={seoPages.filter((p) => p.ogImage || p.description).length} icon={Share2} tone="highlight" />
        <StatCard label="Sitemap" value="Live" icon={Globe} tone="info" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-5">
          <p className="mb-1 text-sm font-semibold">Pages</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Course SEO is also editable under Courses → Edit → SEO section. Paths like{" "}
            <span className="font-mono">/courses/…</span> sync to the public site.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Score</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.items.map((p) => (
                <TableRow key={p.path}>
                  <TableCell className="font-mono text-xs">{p.path}</TableCell>
                  <TableCell className="text-sm">{p.title}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.score >= 85
                          ? "bg-success/15 text-success hover:bg-success/20"
                          : "bg-highlight/20 text-[color:var(--highlight-foreground)]"
                      }
                    >
                      {p.score}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => { setEditing({ ...p }); setEditingBaseline({ ...p }); }}>
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
          <p className="mb-3 text-sm font-semibold">Homepage SEO</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Meta title</Label>
              <Input
                className="mt-1.5"
                value={homeForm.title}
                onChange={(e) => setHomeForm({ ...homeForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Canonical URL</Label>
              <Input
                className="mt-1.5"
                value={homeForm.canonical}
                onChange={(e) => setHomeForm({ ...homeForm, canonical: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Meta description</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={homeForm.description}
                onChange={(e) => setHomeForm({ ...homeForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Keywords</Label>
              <Input
                className="mt-1.5"
                value={homeForm.keywords}
                onChange={(e) => setHomeForm({ ...homeForm, keywords: e.target.value })}
              />
            </div>
            <div>
              <Label>OG image URL</Label>
              <Input
                className="mt-1.5"
                value={homeForm.ogImage}
                onChange={(e) => setHomeForm({ ...homeForm, ogImage: e.target.value })}
                placeholder="https://… or /media/seo/og/…"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Robots</Label>
              <Input
                className="mt-1.5"
                value={homeForm.robots}
                onChange={(e) => setHomeForm({ ...homeForm, robots: e.target.value })}
                placeholder="index,follow"
              />
            </div>
            <div className="md:col-span-2">
              <Button className="btn-highlight" disabled={!homeDirty} onClick={saveHome}>
                Save SEO settings
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
