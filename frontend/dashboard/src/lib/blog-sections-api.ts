import { apiList, apiMutateDetailed } from "@/lib/dashboard-api";
import { contentEndpoints } from "@/lib/api-endpoints";
import type { CmsBlogSection } from "@/lib/cms-api";

export type BlogSectionPayload = {
  title?: string | null;
  description: string;
  order?: number;
};

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

  remove(sectionId: string | number) {
    return apiMutateDetailed<void>(contentEndpoints.blogSectionDetail(sectionId), "DELETE");
  },
};

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
