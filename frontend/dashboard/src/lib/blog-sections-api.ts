import { apiList, apiMutateDetailed } from "@/lib/dashboard-api";
import { authedFetch } from "@/lib/api";
import { contentEndpoints } from "@/lib/api-endpoints";
import { cmsApi, type CmsBlogPost, type CmsBlogSection } from "@/lib/cms-api";
import { isEmptyRichText } from "@/lib/rich-text";
import type { BlogSectionDraft } from "@/components/dashboard/BlogSectionsEditor";

export type BlogSectionPayload = {
  title?: string | null;
  description: string;
  order?: number;
  image?: File | string | null;
};

function parseSectionBody<T>(raw: unknown): T | null {
  if (raw && typeof raw === "object" && "data" in raw && ("success" in raw || "message" in raw)) {
    return (raw as { data: T }).data;
  }
  return (raw as T) ?? null;
}

async function mutateSectionForm<T>(
  path: string,
  method: string,
  form: FormData,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await authedFetch(path, {
      method,
      body: form,
      headers: { Accept: "application/json" },
    });
    if (!res) return { data: null, error: "Network error" };
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        raw && typeof raw === "object" && "message" in raw
          ? String((raw as { message?: unknown }).message)
          : `Request failed (${res.status})`;
      return { data: null, error: message };
    }
    return { data: parseSectionBody<T>(raw), error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export const blogSectionsApi = {
  list(postId: string | number) {
    return apiList<CmsBlogSection>(contentEndpoints.blogPostSections(postId));
  },

  create(postId: string | number, payload: BlogSectionPayload) {
    return apiMutateDetailed<CmsBlogSection>(contentEndpoints.blogPostSections(postId), "POST", payload);
  },

  update(sectionId: string | number, payload: Partial<BlogSectionPayload>) {
    return apiMutateDetailed<CmsBlogSection>(contentEndpoints.blogSectionDetail(sectionId), "PATCH", payload);
  },

  updateForm(sectionId: string | number, form: FormData) {
    return mutateSectionForm<CmsBlogSection>(contentEndpoints.blogSectionDetail(sectionId), "PATCH", form);
  },

  createForm(postId: string | number, form: FormData) {
    return mutateSectionForm<CmsBlogSection>(contentEndpoints.blogPostSections(postId), "POST", form);
  },

  remove(sectionId: string | number) {
    return apiMutateDetailed<void>(contentEndpoints.blogSectionDetail(sectionId), "DELETE");
  },
};

export function nestedBlogSections(sections: BlogSectionDraft[]) {
  return sections
    .filter((s) => !isEmptyRichText(s.description))
    .map((s, order) => ({
      ...(s.id ? { id: s.id } : {}),
      title: s.title.trim() ? s.title.trim() : null,
      description: s.description.trim(),
      order,
      ...(s.clearImage ? { image: null } : {}),
    }));
}

export function blogSectionImageFiles(sections: BlogSectionDraft[]) {
  return sections.filter((s) => !isEmptyRichText(s.description)).map((s) => s.imageFile);
}

function appendSectionImages(form: FormData, files: Array<File | undefined>) {
  files.forEach((file, i) => {
    if (file) form.append(`sections[${i}]image`, file);
  });
}

export function appendBlogSectionImages(form: FormData, sections: BlogSectionDraft[]) {
  appendSectionImages(form, blogSectionImageFiles(sections));
}

export async function uploadBlogSectionImages(
  post: Pick<CmsBlogPost, "id" | "slug" | "sections">,
  drafts: BlogSectionDraft[],
): Promise<{ error: string | null }> {
  const current = drafts.filter((s) => !isEmptyRichText(s.description));
  const needsUpload = current.some((s) => s.imageFile || s.clearImage);
  if (!needsUpload) return { error: null };

  let saved = Array.isArray(post.sections) ? [...post.sections] : [];
  if (!saved.length && post.slug) {
    const detail = await cmsApi.getBlogPost(post.slug);
    if (detail?.sections?.length) saved = [...detail.sections];
  }
  if (!saved.length && post.id != null) {
    saved = await blogSectionsApi.list(post.id);
  }
  saved.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (let i = 0; i < current.length; i += 1) {
    const draft = current[i];
    if (!draft.imageFile && !draft.clearImage) continue;
    const match =
      (draft.id && saved.find((s) => String(s.id) === String(draft.id))) || saved[i];
    const sectionId = match?.id;
    if (sectionId == null) {
      return { error: "Post saved, but a section image could not be attached" };
    }
    const form = new FormData();
    form.append("description", draft.description);
    if (draft.title !== undefined) form.append("title", draft.title.trim());
    form.append("order", String(i));
    if (draft.imageFile) form.append("image", draft.imageFile);
    else form.append("image", "");

    const cms = await cmsApi.patchBlogSectionForm(sectionId, form);
    if ("ok" in cms && cms.ok) continue;
    const fallback = await blogSectionsApi.updateForm(sectionId, form);
    if (fallback.error) return { error: fallback.error };
  }

  return { error: null };
}

export async function syncBlogSections(
  postId: string | number,
  original: Array<{ id?: string; title: string; description: string }>,
  current: Array<{ id?: string; title: string; description: string }>,
): Promise<{ error: string | null }> {
  const currentIds = new Set(current.map((s) => s.id).filter(Boolean).map(String));

  for (const row of original) {
    if (row.id && !currentIds.has(String(row.id))) {
      const res = await blogSectionsApi.remove(row.id);
      if (res.error) return { error: res.error };
    }
  }

  for (let i = 0; i < current.length; i += 1) {
    const row = current[i];
    const payload: BlogSectionPayload = {
      title: row.title.trim() || null,
      description: row.description.trim(),
      order: i,
    };
    if (row.id) {
      const res = await blogSectionsApi.update(row.id, payload);
      if (res.error) return { error: res.error };
    } else {
      const res = await blogSectionsApi.create(postId, payload);
      if (res.error) return { error: res.error };
    }
  }

  return { error: null };
}
