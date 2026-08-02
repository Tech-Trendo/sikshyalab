import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useBlogQuery, useCreateBlogMutation, useUpdateBlogMutation } from "@/hooks/useCmsQueries";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, FileText, ImagePlus, Loader2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { renderBlogContent } from "@/lib/markdown";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/blog")({
  component: BlogPage,
});

type BlogFormState = {
  title: string;
  excerpt: string;
  content: string;
};

type EditBlogState = BlogFormState & {
  slug: string;
  cover?: string;
  author?: string;
  date?: string;
};

const emptyForm: BlogFormState = { title: "", excerpt: "", content: "" };

function ContentField({
  value,
  onChange,
  preview,
  onTogglePreview,
}: {
  value: string;
  onChange: (next: string) => void;
  preview: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label>Content</Label>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={onTogglePreview}>
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      {preview ? (
        <div
          className="min-h-[220px] rounded-md border border-border/60 bg-muted/20 p-3 text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderBlogContent(value) || "<p class='text-muted-foreground'>Nothing to preview yet.</p>" }}
        />
      ) : (
        <Textarea
          className="mt-0 min-h-[220px] font-mono text-sm"
          rows={10}
          value={value}
          placeholder={"## Heading\n\nWrite your article in Markdown.\n\n**Bold text**, lists, and links work."}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Supports Markdown (`##`, **bold**, lists) or HTML. Saved as the full article body.
      </p>
    </div>
  );
}

function BlogPage() {
  const { data: apiBlog, isLoading } = useBlogQuery();
  const createBlog = useCreateBlogMutation();
  const updateBlogApi = useUpdateBlogMutation();

  const blog = useMemo(() => {
    if (!apiBlog?.length) return [];
    return apiBlog.map((b) => ({
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt,
      content: b.content || "",
      author: b.author_name || "Admin",
      date: b.published_at
        ? new Date(b.published_at).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })
        : "",
      cover:
        b.cover_image ||
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200",
    }));
  }, [apiBlog]);

  const [blogPage, setBlogPage] = useState(1);
  const [editBlog, setEditBlog] = useState<EditBlogState | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>();
  const [editPreview, setEditPreview] = useState(false);
  const [newBlogOpen, setNewBlogOpen] = useState(false);
  const [blogForm, setBlogForm] = useState<BlogFormState>(emptyForm);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [newPreview, setNewPreview] = useState(false);
  const blogPaged = paginate(blog, blogPage);

  return (
    <>
      <PageHeader title="Blog" subtitle="Create and publish articles for the public website." />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Blog posts" value={blog.length} icon={FileText} tone="primary" />
      </div>

      {isLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing blog posts…
        </p>
      )}

      <div className="mt-6 space-y-3">
        {blogPaged.items.map((b) => (
          <Card key={b.slug} className="border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <img src={b.cover} className="h-16 w-24 rounded-md object-cover" alt={b.title} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">
                  {b.date} • {b.author}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditCoverFile(undefined);
                  setEditPreview(false);
                  setEditBlog({
                    slug: b.slug,
                    title: b.title,
                    excerpt: b.excerpt,
                    content: b.content,
                    cover: b.cover,
                    author: b.author,
                    date: b.date,
                  });
                }}
              >
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
        <DataPagination
          page={blogPaged.page}
          totalPages={blogPaged.totalPages}
          total={blogPaged.total}
          from={blogPaged.from}
          to={blogPaged.to}
          onPageChange={setBlogPage}
        />
        <Button
          className="btn-highlight"
          onClick={() => {
            setBlogForm(emptyForm);
            setCoverPreview("");
            setCoverFile(undefined);
            setNewPreview(false);
            setNewBlogOpen(true);
          }}
        >
          <ImagePlus className="mr-1 h-4 w-4" /> New post
        </Button>
      </div>

      <Dialog open={!!editBlog} onOpenChange={(o) => !o && setEditBlog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit blog post</DialogTitle></DialogHeader>
          {editBlog && (
            <div className="grid gap-3">
              <div>
                <Label>Title</Label>
                <Input
                  className="mt-1.5"
                  value={editBlog.title}
                  onChange={(e) => setEditBlog({ ...editBlog, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Describe</Label>
                <Textarea
                  className="mt-1.5 min-h-[140px]"
                  rows={5}
                  value={editBlog.excerpt}
                  onChange={(e) => setEditBlog({ ...editBlog, excerpt: e.target.value })}
                />
              </div>
              <MediaImagePicker
                label="Cover image (16:9)"
                value={editBlog.cover}
                onChange={(url, file) => {
                  setEditBlog({ ...editBlog, cover: url });
                  setEditCoverFile(file);
                }}
                onClear={() => setEditCoverFile(undefined)}
              />
              <ContentField
                value={editBlog.content}
                onChange={(content) => setEditBlog({ ...editBlog, content })}
                preview={editPreview}
                onTogglePreview={() => setEditPreview((v) => !v)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlog(null)}>Cancel</Button>
            <Button
              disabled={updateBlogApi.isPending}
              onClick={() => {
                if (!editBlog) return;
                if (!editBlog.content.trim()) {
                  toast.error("Content is required");
                  return;
                }
                void (async () => {
                  try {
                    const res = await updateBlogApi.mutateAsync({
                      slug: editBlog.slug,
                      patch: {
                        title: editBlog.title,
                        excerpt: editBlog.excerpt,
                        content: editBlog.content,
                        is_published: true,
                      },
                      coverFile: editCoverFile,
                    });
                    if (res) {
                      toast.success("Post updated");
                      setEditBlog(null);
                    } else toast.error("Could not update post");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not update post");
                  }
                })();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newBlogOpen} onOpenChange={setNewBlogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>New blog post</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={blogForm.title}
                onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Describe</Label>
              <Textarea
                className="mt-1.5 min-h-[140px]"
                rows={5}
                value={blogForm.excerpt}
                onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
              />
            </div>
            <MediaImagePicker
              label="Cover image (16:9)"
              value={coverPreview}
              onChange={(url, file) => {
                setCoverPreview(url);
                setCoverFile(file);
              }}
              onClear={() => {
                setCoverPreview("");
                setCoverFile(undefined);
              }}
            />
            <ContentField
              value={blogForm.content}
              onChange={(content) => setBlogForm({ ...blogForm, content })}
              preview={newPreview}
              onTogglePreview={() => setNewPreview((v) => !v)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBlogOpen(false)}>Cancel</Button>
            <Button
              disabled={createBlog.isPending}
              onClick={() => {
                if (!blogForm.title.trim()) {
                  toast.error("Title is required");
                  return;
                }
                if (!blogForm.content.trim()) {
                  toast.error("Content is required");
                  return;
                }
                const slug = blogForm.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
                void (async () => {
                  try {
                    const res = await createBlog.mutateAsync({
                      payload: {
                        slug,
                        title: blogForm.title,
                        excerpt: blogForm.excerpt,
                        content: blogForm.content,
                        is_published: true,
                      },
                      coverFile,
                    });
                    if (res) {
                      toast.success("Post created");
                      setNewBlogOpen(false);
                      setBlogForm(emptyForm);
                      setCoverPreview("");
                      setCoverFile(undefined);
                      setNewPreview(false);
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not create post");
                  }
                })();
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
