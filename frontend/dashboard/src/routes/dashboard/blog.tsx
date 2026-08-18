import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useBlogQuery, useCreateBlogMutation, useUpdateBlogMutation } from "@/hooks/useCmsQueries";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ImagePlus, Loader2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cmsApi, type CmsBlogPost } from "@/lib/cms-api";
import {
  BlogSectionsEditor,
  emptyBlogSection,
  type BlogSectionDraft,
} from "@/components/dashboard/BlogSectionsEditor";
import { FormTabNav } from "@/components/dashboard/FormTabNav";
import { SeoFieldsPanel } from "@/components/dashboard/SeoFieldsPanel";
import { useDirtyForm } from "@/hooks/useDirtyForm";

export const Route = createFileRoute("/dashboard/blog")({
  component: BlogPage,
});

type BlogFormState = {
  title: string;
  excerpt: string;
  sections: BlogSectionDraft[];
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
};

type EditBlogState = BlogFormState & {
  slug: string;
  id: string;
  cover?: string;
  author?: string;
  date?: string;
};

const emptyForm: BlogFormState = {
  title: "",
  excerpt: "",
  sections: [emptyBlogSection()],
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
};

function mapSections(post: Pick<CmsBlogPost, "sections" | "content">): BlogSectionDraft[] {
  const nested = Array.isArray(post.sections) ? post.sections : [];
  if (nested.length) {
    return nested.map((s) => ({
      id: s.id != null ? String(s.id) : undefined,
      title: String(s.title || ""),
      description: String(s.description || ""),
    }));
  }
  if (post.content?.trim()) {
    return [{ title: "", description: post.content }];
  }
  return [emptyBlogSection()];
}

function sectionsValid(sections: BlogSectionDraft[]) {
  if (!sections.some((s) => s.description.trim())) return false;
  return sections.every((s) => !s.title.trim() || Boolean(s.description.trim()));
}

function nestedSections(sections: BlogSectionDraft[]) {
  return sections
    .filter((s) => s.description.trim())
    .map((s, order) => ({
      title: s.title.trim() ? s.title.trim() : null,
      description: s.description.trim(),
      order,
    }));
}

function optionalSeo(metaTitle: string, metaDescription: string) {
  const body: { meta_title?: string; meta_description?: string } = {};
  if (metaTitle.trim()) body.meta_title = metaTitle.trim();
  if (metaDescription.trim()) body.meta_description = metaDescription.trim();
  return body;
}

function BlogPage() {
  const { data: apiBlog, isLoading } = useBlogQuery();
  const createBlog = useCreateBlogMutation();
  const updateBlogApi = useUpdateBlogMutation();

  const blog = useMemo(() => {
    if (!apiBlog?.length) return [];
    return apiBlog.map((b) => ({
      id: String(b.id),
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt,
      content: b.content || "",
      sections: mapSections(b),
      metaTitle: b.meta_title || "",
      metaDescription: b.meta_description || "",
      ogImage: b.og_image || "",
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
  const [editBaseline, setEditBaseline] = useState<EditBlogState | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>();
  const [editOgFile, setEditOgFile] = useState<File | undefined>();
  const [editTab, setEditTab] = useState("blog");
  const [newBlogOpen, setNewBlogOpen] = useState(false);
  const [newTab, setNewTab] = useState("blog");
  const [blogForm, setBlogForm] = useState<BlogFormState>(emptyForm);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [ogFile, setOgFile] = useState<File | undefined>();
  const blogPaged = paginate(blog, blogPage);
  const editDirty = useDirtyForm(
    { form: editBlog, coverFile: editCoverFile, ogFile: editOgFile },
    editBaseline ? { form: editBaseline, coverFile: undefined, ogFile: undefined } : null,
    Boolean(editBlog),
  );

  const openEdit = async (b: (typeof blog)[number]) => {
    setEditCoverFile(undefined);
    setEditOgFile(undefined);
    setEditTab("blog");
    let sections = b.sections;
    const detail = await cmsApi.getBlogPost(b.slug);
    if (detail) sections = mapSections(detail);
    const next: EditBlogState = {
      id: detail ? String(detail.id) : b.id,
      slug: b.slug,
      title: detail?.title || b.title,
      excerpt: detail?.excerpt || b.excerpt,
      sections,
      metaTitle: detail?.meta_title || b.metaTitle,
      metaDescription: detail?.meta_description || b.metaDescription,
      ogImage: detail?.og_image || b.ogImage,
      cover: detail?.cover_image || b.cover,
      author: b.author,
      date: b.date,
    };
    setEditBlog(next);
    setEditBaseline(next);
  };

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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Published Blogs</h3>
          <Button
            size="sm"
            className="btn-highlight"
            onClick={() => {
              setBlogForm(emptyForm);
              setCoverPreview("");
              setCoverFile(undefined);
              setOgFile(undefined);
              setNewTab("blog");
              setNewBlogOpen(true);
            }}
          >
            <ImagePlus className="mr-1 h-4 w-4" /> New post
          </Button>
        </div>
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
              <Button variant="outline" size="sm" onClick={() => void openEdit(b)}>
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
      </div>

      <Dialog open={!!editBlog} onOpenChange={(o) => !o && setEditBlog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit blog post</DialogTitle></DialogHeader>
          {editBlog && (
            <div className="grid gap-3">
              <FormTabNav
                value={editTab}
                onChange={setEditTab}
                tabs={[
                  { id: "blog", label: "Blog", error: !editBlog.title.trim() || !sectionsValid(editBlog.sections) },
                  { id: "seo", label: "SEO" },
                ]}
              />
              {editTab === "blog" ? (
                <div className="grid gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      className="mt-1.5"
                      value={editBlog.title}
                      onChange={(e) => setEditBlog({ ...editBlog, title: e.target.value })}
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
                  <BlogSectionsEditor
                    sections={editBlog.sections}
                    onChange={(sections) => setEditBlog({ ...editBlog, sections })}
                    disabled={updateBlogApi.isPending}
                  />
                </div>
              ) : (
                <SeoFieldsPanel
                  value={{
                    metaTitle: editBlog.metaTitle,
                    metaDescription: editBlog.metaDescription,
                    ogImage: editBlog.ogImage,
                  }}
                  titleFallback={editBlog.title}
                  onOgFile={setEditOgFile}
                  onChange={(seo) =>
                    setEditBlog({
                      ...editBlog,
                      metaTitle: seo.metaTitle,
                      metaDescription: seo.metaDescription,
                      ogImage: seo.ogImage || "",
                    })
                  }
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlog(null)}>Cancel</Button>
            <Button
              disabled={updateBlogApi.isPending || !editDirty}
              onClick={() => {
                if (!editBlog) return;
                if (!editBlog.title.trim()) {
                  setEditTab("blog");
                  toast.error("Title is required");
                  return;
                }
                if (!sectionsValid(editBlog.sections)) {
                  setEditTab("blog");
                  toast.error("Each section needs a description");
                  return;
                }
                void (async () => {
                  try {
                    const res = await updateBlogApi.mutateAsync({
                      slug: editBlog.slug,
                      patch: {
                        title: editBlog.title,
                        excerpt: "",
                        is_published: true,
                        sections: nestedSections(editBlog.sections),
                        ...optionalSeo(editBlog.metaTitle, editBlog.metaDescription),
                      },
                      coverFile: editCoverFile,
                      ogFile: editOgFile,
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
            <FormTabNav
              value={newTab}
              onChange={setNewTab}
              tabs={[
                { id: "blog", label: "Blog", error: !blogForm.title.trim() || !sectionsValid(blogForm.sections) },
                { id: "seo", label: "SEO" },
              ]}
            />
            {newTab === "blog" ? (
              <div className="grid gap-3">
                <div>
                  <Label>Title</Label>
                  <Input
                    className="mt-1.5"
                    value={blogForm.title}
                    onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
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
                <BlogSectionsEditor
                  sections={blogForm.sections}
                  onChange={(sections) => setBlogForm({ ...blogForm, sections })}
                  disabled={createBlog.isPending}
                />
              </div>
            ) : (
              <SeoFieldsPanel
                value={{
                  metaTitle: blogForm.metaTitle,
                  metaDescription: blogForm.metaDescription,
                  ogImage: blogForm.ogImage,
                }}
                titleFallback={blogForm.title}
                onOgFile={setOgFile}
                onChange={(seo) =>
                  setBlogForm({
                    ...blogForm,
                    metaTitle: seo.metaTitle,
                    metaDescription: seo.metaDescription,
                    ogImage: seo.ogImage || "",
                  })
                }
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBlogOpen(false)}>Cancel</Button>
            <Button
              disabled={createBlog.isPending}
              onClick={() => {
                if (!blogForm.title.trim()) {
                  setNewTab("blog");
                  toast.error("Title is required");
                  return;
                }
                if (!sectionsValid(blogForm.sections)) {
                  setNewTab("blog");
                  toast.error("Each section needs a description");
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
                        excerpt: "",
                        is_published: true,
                        sections: nestedSections(blogForm.sections),
                        ...optionalSeo(blogForm.metaTitle, blogForm.metaDescription),
                      },
                      coverFile,
                      ogFile,
                    });
                    if (res) {
                      toast.success("Post created");
                      setNewBlogOpen(false);
                      setBlogForm(emptyForm);
                      setCoverPreview("");
                      setCoverFile(undefined);
                      setOgFile(undefined);
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
