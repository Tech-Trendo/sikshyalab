import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { AboutCardsEditor } from "@/components/dashboard/AboutCardsEditor";
import { useDirtyForm } from "@/hooks/useDirtyForm";
import { useBannersQuery, usePagesQuery, useSaveCmsPageMutation } from "@/hooks/useCmsQueries";
import { cmsApi, cmsKeys } from "@/lib/cms-api";
import {
  ABOUT_LIFE_BANNER_PLACEMENT,
  defaultAboutCms,
  parseAboutCms,
  serializeAboutCms,
  type AboutCmsPayload,
} from "@/lib/about-cms";

export function AboutPageEditor() {
  const qc = useQueryClient();
  const { data: aboutPages = [], isLoading: aboutLoading } = usePagesQuery("ABOUT");
  const { data: banners = [] } = useBannersQuery();
  const saveCmsPage = useSaveCmsPageMutation();
  const aboutPage = aboutPages[0];
  const lifeBanner = banners.find(
    (b) => (b.placement || "").toUpperCase() === ABOUT_LIFE_BANNER_PLACEMENT,
  );

  const [form, setForm] = useState<AboutCmsPayload>(defaultAboutCms());
  const [baseline, setBaseline] = useState<AboutCmsPayload | null>(null);
  const [lifePreview, setLifePreview] = useState("");
  const [lifeFile, setLifeFile] = useState<File | undefined>();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || aboutLoading) return;
    hydrated.current = true;
    const next = parseAboutCms(aboutPage?.content);
    if (aboutPage?.title) next.heroTitle = aboutPage.title;
    if (lifeBanner?.image && !next.lifeAt.image) next.lifeAt.image = lifeBanner.image;
    setForm(next);
    setBaseline(aboutPage ? next : null);
    if (lifeBanner?.image || next.lifeAt.image) {
      setLifePreview(lifeBanner?.image || next.lifeAt.image || "");
    }
  }, [aboutLoading, aboutPage, lifeBanner]);

  const dirty = useDirtyForm(
    { form, lifeFile: lifeFile || null },
    baseline ? { form: baseline, lifeFile: null } : null,
    Boolean(baseline) || Boolean(aboutPage),
  );

  const saveLifeBanner = async (imageUrl?: string) => {
    const formData = new FormData();
    formData.append("title", form.lifeAt.heading || "Life at ShikshaLab");
    formData.append("subtitle", form.lifeAt.description || "");
    formData.append("placement", ABOUT_LIFE_BANNER_PLACEMENT);
    formData.append("is_active", "true");
    formData.append("is_published", "true");
    if (lifeFile) formData.append("image", lifeFile);
    if (lifeBanner) {
      const result = await cmsApi.updateBannerForm(lifeBanner.id, formData);
      if (!result.ok) throw new Error(result.error);
      return result.data?.image || imageUrl || "";
    }
    const result = await cmsApi.createBannerForm(formData);
    if (!result.ok) throw new Error(result.error);
    return result.data?.image || imageUrl || "";
  };

  const onSave = async () => {
    try {
      let lifeImage = form.lifeAt.image;
      if (lifeFile || form.lifeAt.heading || form.lifeAt.description) {
        lifeImage = await saveLifeBanner(lifeImage);
      }
      const payload: AboutCmsPayload = {
        ...form,
        lifeAt: { ...form.lifeAt, image: lifeImage || form.lifeAt.image },
      };
      const res = await saveCmsPage.mutateAsync({
        slug: aboutPage?.slug || "about",
        title: payload.heroTitle.trim() || "About ShikshaLab",
        content: serializeAboutCms(payload),
        page_type: "ABOUT",
        is_published: true,
      });
      setForm(payload);
      setBaseline(payload);
      setLifeFile(undefined);
      if (lifeImage) setLifePreview(lifeImage);
      void qc.invalidateQueries({ queryKey: cmsKeys.banners });
      if (res) toast.success("About page saved");
      else toast.error("Could not save About page");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save About page");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6">
          <h3 className="text-sm font-semibold">Hero banner</h3>
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1.5"
              value={form.heroTitle}
              onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
              placeholder="About ShikshaLab"
            />
          </div>
          <div>
            <Label>Breadcrumb label</Label>
            <Input
              className="mt-1.5"
              value={form.heroBreadcrumb}
              onChange={(e) => setForm({ ...form, heroBreadcrumb: e.target.value })}
              placeholder="About Us"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Shown as Home &gt; this label.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6">
          <h3 className="text-sm font-semibold">Homepage intro</h3>
          <p className="text-[11px] text-muted-foreground">
            Used on the homepage About teaser. The public About page uses the sections below instead.
          </p>
          <Textarea
            rows={4}
            value={form.intro}
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
            placeholder="Short intro for the homepage About block"
          />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <AboutCardsEditor
            label="Mission / Vision / Core Values"
            hint="Three cards are typical. You can add more or fewer."
            items={form.pillars}
            onChange={(pillars) => setForm({ ...form, pillars })}
            disabled={saveCmsPage.isPending}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <AboutCardsEditor
            label="Why Choose ShikshaLab"
            hint="Same 3-card layout as the public About page. Optional icon URL."
            items={form.whyChoose}
            onChange={(whyChoose) => setForm({ ...form, whyChoose })}
            disabled={saveCmsPage.isPending}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6">
          <h3 className="text-sm font-semibold">Hiring Partners</h3>
          <div>
            <Label>Heading</Label>
            <Input
              className="mt-1.5"
              value={form.partnersHeading}
              onChange={(e) => setForm({ ...form, partnersHeading: e.target.value })}
              placeholder="Our Hiring Partners"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6">
          <h3 className="text-sm font-semibold">Life at ShikshaLab</h3>
          <div>
            <Label>Heading</Label>
            <Input
              className="mt-1.5"
              value={form.lifeAt.heading}
              onChange={(e) => setForm({ ...form, lifeAt: { ...form.lifeAt, heading: e.target.value } })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1.5"
              rows={4}
              value={form.lifeAt.description}
              onChange={(e) =>
                setForm({ ...form, lifeAt: { ...form.lifeAt, description: e.target.value } })
              }
            />
          </div>
          <MediaImagePicker
            label="Section image"
            hint="Shown on the left of this block. The button always links to /gallery."
            value={lifePreview}
            aspect="video"
            onChange={(url, file) => {
              setLifePreview(url);
              setLifeFile(file);
              if (!file) setForm({ ...form, lifeAt: { ...form.lifeAt, image: url } });
            }}
            onClear={() => {
              setLifePreview("");
              setLifeFile(undefined);
              setForm({ ...form, lifeAt: { ...form.lifeAt, image: "" } });
            }}
          />
        </CardContent>
      </Card>

      <Button
        className="btn-highlight"
        disabled={saveCmsPage.isPending || (Boolean(aboutPage) && !dirty)}
        onClick={() => void onSave()}
      >
        {saveCmsPage.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
