import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cmsApi, cmsKeys, type CmsCourseReview, type CmsTestimonial } from "@/lib/cms-api";

export function useTestimonialsQuery() {
  return useQuery({
    queryKey: cmsKeys.testimonials,
    queryFn: () => cmsApi.listTestimonials(),
  });
}

export function useReviewsQuery() {
  return useQuery({
    queryKey: cmsKeys.reviews,
    queryFn: () => cmsApi.listReviews(),
  });
}

export function useExportReviewsToTestimonialsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { review_ids?: Array<string | number>; only_approved?: boolean }) =>
      cmsApi.exportReviewsToTestimonials(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cmsKeys.reviews });
      void qc.invalidateQueries({ queryKey: cmsKeys.testimonials });
    },
  });
}

export function usePromoteReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.promoteReview(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cmsKeys.reviews });
      void qc.invalidateQueries({ queryKey: cmsKeys.testimonials });
    },
  });
}

export function useSubmitReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      student_name: string;
      student_email?: string;
      course_name: string;
      rating: number;
      content: string;
    }) => cmsApi.createReview(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.reviews }),
  });
}

export function useUpdateReviewStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: CmsCourseReview["status"] }) =>
      cmsApi.updateReview(id, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.reviews }),
  });
}

export function useUpdateTestimonialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string | number; patch: Partial<CmsTestimonial> }) =>
      cmsApi.updateTestimonial(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.testimonials }),
  });
}

export function useCreateTestimonialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CmsTestimonial>) => cmsApi.createTestimonial(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.testimonials }),
  });
}

export function useFaqsQuery() {
  return useQuery({
    queryKey: cmsKeys.faqs,
    queryFn: () => cmsApi.listFaqs(),
  });
}

export function useBlogQuery() {
  return useQuery({
    queryKey: cmsKeys.blog,
    queryFn: () => cmsApi.listBlogPosts(),
  });
}

export function useEventsQuery() {
  return useQuery({
    queryKey: cmsKeys.events,
    queryFn: () => cmsApi.listEvents(),
  });
}

export function useSiteSettingsQuery() {
  return useQuery({
    queryKey: cmsKeys.settings,
    queryFn: async () => {
      const current = await cmsApi.getSiteSettings();
      if (current) return current;
      const list = await cmsApi.listSiteSettings();
      return list[0] ?? null;
    },
  });
}

export function useBannersQuery() {
  return useQuery({
    queryKey: cmsKeys.banners,
    queryFn: () => cmsApi.listBanners(),
  });
}

export function useCreateBlogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      payload: Parameters<typeof cmsApi.createBlogPost>[0];
      coverFile?: File;
    }) => {
      if (input.coverFile) {
        const form = new FormData();
        Object.entries(input.payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        form.append("cover_image", input.coverFile);
        const result = await cmsApi.createBlogPostForm(form);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
      const result = await cmsApi.createBlogPost(input.payload);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.blog }),
  });
}

export function useUpdateBlogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slug,
      patch,
      coverFile,
    }: {
      slug: string;
      patch: Parameters<typeof cmsApi.updateBlogPost>[1];
      coverFile?: File;
    }) => {
      if (coverFile) {
        const form = new FormData();
        Object.entries(patch).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        form.append("cover_image", coverFile);
        const result = await cmsApi.updateBlogPostForm(slug, form);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
      return cmsApi.updateBlogPost(slug, patch);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.blog }),
  });
}

export function useCreateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      payload: Parameters<typeof cmsApi.createEvent>[0];
      coverFile?: File;
    }) => {
      if (input.coverFile) {
        const form = new FormData();
        Object.entries(input.payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        form.append("cover_image", input.coverFile);
        const result = await cmsApi.createEventForm(form);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
      return cmsApi.createEvent(input.payload);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.events }),
  });
}

export function useUpdateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slug,
      patch,
      coverFile,
    }: {
      slug: string;
      patch: Parameters<typeof cmsApi.updateEvent>[1];
      coverFile?: File;
    }) => {
      if (coverFile) {
        const form = new FormData();
        Object.entries(patch).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        form.append("cover_image", coverFile);
        const result = await cmsApi.updateEventForm(slug, form);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
      return cmsApi.updateEvent(slug, patch);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.events }),
  });
}

export function useCreateFaqMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof cmsApi.createFaq>[0]) => cmsApi.createFaq(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.faqs }),
  });
}

export function useUpdateFaqMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string | number; patch: Parameters<typeof cmsApi.updateFaq>[1] }) =>
      cmsApi.updateFaq(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.faqs }),
  });
}

export function useSaveHomepageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      heroTitle: string;
      heroSubtitle: string;
      heroCta: string;
      settingId?: string | number | null;
      bannerId?: string | number | null;
      heroImageFile?: File | null;
    }) => {
      const socialPatch = {
        hero_title: payload.heroTitle,
        hero_cta: payload.heroCta,
        hero_cta_url: "/courses",
      };
      let setting = null;
      if (payload.settingId) {
        const current = await cmsApi.getSiteSettings();
        setting = await cmsApi.updateSiteSetting(payload.settingId, {
          tagline: payload.heroSubtitle,
          social_links: { ...(current?.social_links || {}), ...socialPatch },
        });
      }
      if (!setting) {
        const current = await cmsApi.getSiteSettings();
        if (current?.id) {
          setting = await cmsApi.updateSiteSetting(current.id, {
            tagline: payload.heroSubtitle,
            social_links: { ...(current.social_links || {}), ...socialPatch },
          });
        } else {
          setting = await cmsApi.createSiteSetting({
            site_name: "shikshalab",
            tagline: payload.heroSubtitle,
            social_links: socialPatch,
            is_published: true,
          });
        }
      }

      const bannerFields = {
        title: payload.heroTitle,
        subtitle: payload.heroSubtitle,
        cta_text: payload.heroCta,
        cta_url: "/courses",
        placement: "HOME",
        is_active: true,
        is_published: true,
      };

      let bannerId = payload.bannerId;
      if (!bannerId) {
        const banners = await cmsApi.listBanners();
        bannerId = banners.find((b) => (b.placement || "HOME") === "HOME")?.id;
      }

      if (payload.heroImageFile) {
        const form = new FormData();
        Object.entries(bannerFields).forEach(([k, v]) => form.append(k, String(v)));
        form.append("image", payload.heroImageFile);
        const result = bannerId
          ? await cmsApi.updateBannerForm(bannerId, form)
          : await cmsApi.createBannerForm(form);
        if (!result.ok) throw new Error(result.error);
      } else if (bannerId) {
        await cmsApi.updateBanner(bannerId, bannerFields);
      } else if (!payload.heroImageFile) {
        // Text-only update without an existing banner — skip image-required create
        const banners = await cmsApi.listBanners();
        const home = banners.find((b) => (b.placement || "HOME") === "HOME");
        if (home) {
          await cmsApi.updateBanner(home.id, bannerFields);
        }
      }

      return setting;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cmsKeys.settings });
      void qc.invalidateQueries({ queryKey: cmsKeys.banners });
    },
  });
}

export function usePagesQuery(pageType?: string) {
  return useQuery({
    queryKey: [...cmsKeys.pages, pageType || "all"] as const,
    queryFn: () => cmsApi.listPages(pageType ? { page_type: pageType } : undefined),
  });
}

export function useSaveCmsPageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      slug: string;
      title: string;
      content: string;
      page_type: "ABOUT" | "CONTACT";
      is_published?: boolean;
      featuredImageFile?: File | null;
      createIfMissing?: boolean;
    }) => {
      const existing = (await cmsApi.listPages({ page_type: payload.page_type })).find(
        (p) => p.slug === payload.slug || p.page_type === payload.page_type,
      );
      const slug = existing?.slug || payload.slug;
      if (payload.featuredImageFile) {
        const form = new FormData();
        form.append("title", payload.title);
        form.append("content", payload.content);
        form.append("page_type", payload.page_type);
        form.append("is_published", String(payload.is_published ?? true));
        form.append("featured_image", payload.featuredImageFile);
        if (existing) {
          const result = await cmsApi.updatePageForm(slug, form);
          if (!result.ok) throw new Error(result.error);
          return result.data;
        }
        form.append("slug", payload.slug);
        const result = await cmsApi.createPageForm(form);
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }
      if (existing) {
        return cmsApi.updatePage(slug, {
          title: payload.title,
          content: payload.content,
          page_type: payload.page_type,
          is_published: payload.is_published ?? true,
        });
      }
      return cmsApi.createPage({
        title: payload.title,
        slug: payload.slug,
        content: payload.content,
        page_type: payload.page_type,
        is_published: payload.is_published ?? true,
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.pages }),
  });
}

export function useEventRegistrationsQuery() {
  return useQuery({
    queryKey: cmsKeys.eventRegistrations,
    queryFn: () => cmsApi.listEventRegistrations(),
  });
}

export function useApproveEventRegistrationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.approveEventRegistration(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.eventRegistrations }),
  });
}

export function useRejectEventRegistrationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.rejectEventRegistration(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.eventRegistrations }),
  });
}

export function useContactMessagesQuery() {
  return useQuery({
    queryKey: cmsKeys.contactMessages,
    queryFn: () => cmsApi.listContactMessages(),
  });
}

export function useMarkContactMessageReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.markContactMessageRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.contactMessages }),
  });
}

export function useSetContactMessageStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string | number;
      status: "PENDING" | "CONTACTED" | "CONVERTED" | "LOST";
    }) => cmsApi.setContactMessageStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.contactMessages }),
  });
}

export function useMarkContactMessageRepliedMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.markContactMessageReplied(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.contactMessages }),
  });
}

export function useDeleteContactMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => cmsApi.deleteContactMessage(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: cmsKeys.contactMessages }),
  });
}
