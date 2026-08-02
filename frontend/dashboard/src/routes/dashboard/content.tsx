import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import {
  useBannersQuery,
  useCreateFaqMutation,
  useFaqsQuery,
  usePagesQuery,
  useSaveCmsPageMutation,
  useSaveHomepageMutation,
  useSiteSettingsQuery,
  useUpdateFaqMutation,
} from "@/hooks/useCmsQueries";
import { FAQ_SECTIONS, type CmsHomepageFeature } from "@/lib/cms-api";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Sparkles, Upload, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cmsApi, cmsKeys } from "@/lib/cms-api";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard/content")({
  component: ContentPage,
});

type FaqRow = { id: string | number; q: string; a: string; category: string };

function ContentPage() {
  const qc = useQueryClient();
  const { homepage, updateHomepage } = useDashboardData();
  const { data: apiFaqs, isLoading: faqsLoading } = useFaqsQuery();
  const { data: settings } = useSiteSettingsQuery();
  const { data: banners = [] } = useBannersQuery();
  const { data: aboutPages = [] } = usePagesQuery("ABOUT");
  const { data: contactPages = [] } = usePagesQuery("CONTACT");
  const saveHomepage = useSaveHomepageMutation();
  const saveCmsPage = useSaveCmsPageMutation();
  const createFaqApi = useCreateFaqMutation();
  const updateFaqApi = useUpdateFaqMutation();

  const homeBanner = useMemo(
    () => banners.find((b) => (b.placement || "HOME") === "HOME") ?? banners[0],
    [banners],
  );
  const aboutPage = aboutPages[0];
  const contactPage = contactPages[0];

  const faqs = useMemo<FaqRow[]>(() => {
    if (apiFaqs?.length) {
      return apiFaqs.map((f) => ({
        id: f.id,
        q: f.question,
        a: f.answer,
        category: f.category || "General Questions",
      }));
    }
    return [];
  }, [apiFaqs]);

  /** FAQs grouped under each category/topic for the Content → FAQ tab */
  const faqsByCategory = useMemo(() => {
    const map = new Map<string, FaqRow[]>();
    for (const f of faqs) {
      const key = f.category.trim() || "General Questions";
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    const known = FAQ_SECTIONS as readonly string[];
    return [...map.entries()].sort(([a], [b]) => {
      const ai = known.indexOf(a);
      const bi = known.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [faqs]);

  const [homeForm, setHomeForm] = useState(homepage);
  const [heroImagePreview, setHeroImagePreview] = useState<string>("");
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [featuresEyebrow, setFeaturesEyebrow] = useState("");
  const [featuresHeading, setFeaturesHeading] = useState("");
  const [features, setFeatures] = useState<CmsHomepageFeature[]>([]);
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [testimonialsEyebrow, setTestimonialsEyebrow] = useState("");
  const [testimonialsHeading, setTestimonialsHeading] = useState("");
  const [testimonialsSaving, setTestimonialsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [aboutForm, setAboutForm] = useState({ title: "", content: "" });
  const [aboutImagePreview, setAboutImagePreview] = useState("");
  const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
  const [contactForm, setContactForm] = useState({
    title: "",
    content: "",
    email: "",
    phone: "",
    address: "",
    facebook: "",
    twitter: "",
    linkedin: "",
    youtube: "",
    instagram: "",
  });
  const [contactSaving, setContactSaving] = useState(false);
  const [editFaq, setEditFaq] = useState<FaqRow | null>(null);
  const [newFaqOpen, setNewFaqOpen] = useState(false);
  const [faqForm, setFaqForm] = useState({
    q: "",
    a: "",
    category: FAQ_SECTIONS[0] as string,
  });

  useEffect(() => {
    if (!settings && !homeBanner) return;
    const social = settings?.social_links || {};
    setHomeForm((prev) => ({
      ...prev,
      heroTitle:
        homeBanner?.title ||
        social.hero_title ||
        prev.heroTitle ||
        "Build Your Programming Skill with ShikshaLab",
      heroSubtitle: homeBanner?.subtitle || settings?.tagline || prev.heroSubtitle,
      heroCta: homeBanner?.cta_text || social.hero_cta || prev.heroCta || "Find courses",
      logoUrl: settings?.logo || prev.logoUrl,
    }));
    if (!heroImageFile && homeBanner?.image) {
      setHeroImagePreview(homeBanner.image);
    }
    if (settings?.features_eyebrow) setFeaturesEyebrow(settings.features_eyebrow);
    if (settings?.features_heading) setFeaturesHeading(settings.features_heading);
    if (settings?.homepage_features?.length) setFeatures(settings.homepage_features);
    if (settings?.testimonials_eyebrow) setTestimonialsEyebrow(settings.testimonials_eyebrow);
    if (settings?.testimonials_heading) setTestimonialsHeading(settings.testimonials_heading);
  }, [settings, homeBanner, heroImageFile]);

  useEffect(() => {
    if (!aboutPage) return;
    setAboutForm({
      title: aboutPage.title || "About ShikshaLab",
      content: aboutPage.content || "",
    });
    if (!aboutImageFile && aboutPage.featured_image) {
      setAboutImagePreview(aboutPage.featured_image);
    }
  }, [aboutPage, aboutImageFile]);

  useEffect(() => {
    const social = settings?.social_links || {};
    setContactForm((prev) => ({
      title: contactPage?.title || prev.title || "Get In Touch",
      content:
        contactPage?.content ||
        prev.content ||
        "Reach out and we'll respond within 24 hours.",
      email: settings?.contact_email || prev.email,
      phone: settings?.contact_phone || prev.phone,
      address: settings?.address || prev.address,
      facebook: social.facebook || prev.facebook,
      twitter: social.twitter || prev.twitter,
      linkedin: social.linkedin || prev.linkedin,
      youtube: social.youtube || prev.youtube,
      instagram: social.instagram || prev.instagram,
    }));
  }, [contactPage, settings]);

  const onSaveHomepage = async () => {
    const res = await saveHomepage.mutateAsync({
      heroTitle: homeForm.heroTitle,
      heroSubtitle: homeForm.heroSubtitle,
      heroCta: homeForm.heroCta,
      settingId: settings?.id,
      bannerId: homeBanner?.id,
      heroImageFile,
    });
    updateHomepage(homeForm);
    setHeroImageFile(null);
    if (res || homeBanner || heroImageFile) toast.success("Homepage saved to CMS");
    else toast.error("Could not save homepage");
  };

  const onSaveAbout = async () => {
    const res = await saveCmsPage.mutateAsync({
      slug: aboutPage?.slug || "about",
      title: aboutForm.title,
      content: aboutForm.content,
      page_type: "ABOUT",
      is_published: true,
      featuredImageFile: aboutImageFile,
    });
    setAboutImageFile(null);
    if (res) toast.success("About page saved");
    else toast.error("Could not save About page");
  };

  const onSaveContact = async () => {
    if (!settings?.id) {
      toast.error("Site settings not loaded yet");
      return;
    }
    setContactSaving(true);
    try {
      const [pageRes, settingRes] = await Promise.all([
        saveCmsPage.mutateAsync({
          slug: contactPage?.slug || "contact",
          title: contactForm.title,
          content: contactForm.content,
          page_type: "CONTACT",
          is_published: true,
        }),
        cmsApi.updateSiteSetting(settings.id, {
          contact_email: contactForm.email,
          contact_phone: contactForm.phone,
          address: contactForm.address,
          social_links: {
            ...(settings.social_links || {}),
            facebook: contactForm.facebook.trim(),
            twitter: contactForm.twitter.trim(),
            linkedin: contactForm.linkedin.trim(),
            youtube: contactForm.youtube.trim(),
            instagram: contactForm.instagram.trim(),
          },
        }),
      ]);
      if (pageRes || settingRes) {
        toast.success("Contact content saved");
        void qc.invalidateQueries({ queryKey: cmsKeys.settings });
      } else toast.error("Could not save Contact content");
    } finally {
      setContactSaving(false);
    }
  };

  const onSaveFeatures = async () => {
    if (!settings?.id) {
      toast.error("Site settings not loaded yet");
      return;
    }
    setFeaturesSaving(true);
    try {
      const res = await cmsApi.updateSiteSetting(settings.id, {
        features_eyebrow: featuresEyebrow,
        features_heading: featuresHeading,
        homepage_features: features,
      });
      if (res) {
        toast.success("Features saved");
        void qc.invalidateQueries({ queryKey: cmsKeys.settings });
      } else toast.error("Could not save features");
    } finally {
      setFeaturesSaving(false);
    }
  };

  const onSaveTestimonials = async () => {
    if (!settings?.id) {
      toast.error("Site settings not loaded yet");
      return;
    }
    setTestimonialsSaving(true);
    try {
      const res = await cmsApi.updateSiteSetting(settings.id, {
        testimonials_eyebrow: testimonialsEyebrow,
        testimonials_heading: testimonialsHeading,
      });
      if (res) {
        toast.success("Testimonials header saved");
        void qc.invalidateQueries({ queryKey: cmsKeys.settings });
      } else toast.error("Could not save testimonials header");
    } finally {
      setTestimonialsSaving(false);
    }
  };

  const onSaveLogo = async () => {
    if (!logoFile) {
      toast.error("Choose a logo image first");
      return;
    }
    setLogoSaving(true);
    try {
      const form = new FormData();
      form.append("logo", logoFile);
      form.append("is_published", "true");
      let saved;
      if (settings?.id) {
        saved = await cmsApi.updateSiteSettingForm(settings.id, form);
      } else {
        form.append("site_name", "shikshalab");
        saved = await cmsApi.createSiteSettingForm(form);
      }
      if (saved.ok) {
        toast.success("Logo published to the public site");
        setLogoFile(null);
        void qc.invalidateQueries({ queryKey: cmsKeys.settings });
      } else {
        toast.error(saved.error || "Could not upload logo");
      }
    } finally {
      setLogoSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Website Content"
        subtitle="Manage homepage hero, About, Contact, feature cards, logo, and FAQs."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="FAQs" value={faqs.length} icon={FileText} tone="highlight" />
        <StatCard label="Feature cards" value={features.length} icon={Sparkles} tone="info" />
      </div>

      {faqsLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing content from backend…
        </p>
      )}

      <Tabs defaultValue="home" className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 sm:flex-nowrap sm:overflow-x-auto">
          <TabsTrigger value="home">Homepage</TabsTrigger>
          <TabsTrigger value="about">About Us</TabsTrigger>
          <TabsTrigger value="contact">Contact Us</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <Label>Hero title</Label>
                <Input
                  className="mt-1.5"
                  value={homeForm.heroTitle}
                  onChange={(e) => setHomeForm({ ...homeForm, heroTitle: e.target.value })}
                />
              </div>
              <div>
                <Label>Hero CTA</Label>
                <Input
                  className="mt-1.5"
                  value={homeForm.heroCta}
                  onChange={(e) => setHomeForm({ ...homeForm, heroCta: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Hero subtitle</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={homeForm.heroSubtitle}
                  onChange={(e) => setHomeForm({ ...homeForm, heroSubtitle: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <MediaImagePicker
                  label="Hero image"
                  hint="Shown on the public homepage hero. Cropped to 16:9 before upload."
                  value={heroImagePreview}
                  aspect="video"
                  onChange={(preview, file) => {
                    setHeroImagePreview(preview);
                    setHeroImageFile(file || null);
                  }}
                  onClear={() => {
                    setHeroImagePreview("");
                    setHeroImageFile(null);
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  className="btn-highlight"
                  disabled={saveHomepage.isPending}
                  onClick={() => void onSaveHomepage()}
                >
                  {saveHomepage.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="grid gap-4 p-6">
              <div>
                <Label>Page title</Label>
                <Input
                  className="mt-1.5"
                  value={aboutForm.title}
                  onChange={(e) => setAboutForm({ ...aboutForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>About content</Label>
                <Textarea
                  className="mt-1.5"
                  rows={8}
                  value={aboutForm.content}
                  onChange={(e) => setAboutForm({ ...aboutForm, content: e.target.value })}
                />
              </div>
              <MediaImagePicker
                label="Featured image"
                hint="Used on the public About page header."
                value={aboutImagePreview}
                aspect="video"
                onChange={(preview, file) => {
                  setAboutImagePreview(preview);
                  setAboutImageFile(file || null);
                }}
                onClear={() => {
                  setAboutImagePreview("");
                  setAboutImageFile(null);
                }}
              />
              <div>
                <Button
                  className="btn-highlight"
                  disabled={saveCmsPage.isPending}
                  onClick={() => void onSaveAbout()}
                >
                  {saveCmsPage.isPending ? "Saving…" : "Save About page"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Page title</Label>
                <Input
                  className="mt-1.5"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Intro / subtitle</Label>
                <Textarea
                  className="mt-1.5"
                  rows={4}
                  value={contactForm.content}
                  onChange={(e) => setContactForm({ ...contactForm, content: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact email</Label>
                <Input
                  className="mt-1.5"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact phone</Label>
                <Input
                  className="mt-1.5"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Campus address</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-foreground">Social media links</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Shown in the public site header and footer. Leave blank to hide an icon.
                </p>
              </div>
              {(
                [
                  ["facebook", "Facebook"],
                  ["twitter", "Twitter / X"],
                  ["linkedin", "LinkedIn"],
                  ["youtube", "YouTube"],
                  ["instagram", "Instagram"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    className="mt-1.5"
                    type="url"
                    placeholder="https://"
                    value={contactForm[key]}
                    onChange={(e) => setContactForm({ ...contactForm, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <Button
                  className="btn-highlight"
                  disabled={contactSaving || saveCmsPage.isPending}
                  onClick={() => void onSaveContact()}
                >
                  {contactSaving ? "Saving…" : "Save Contact content"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-4 space-y-4">
          <Card className="border-border/60">
            <CardContent className="grid gap-4 p-6">
              <div>
                <Label>Section eyebrow</Label>
                <Input className="mt-1.5" value={featuresEyebrow} onChange={(e) => setFeaturesEyebrow(e.target.value)} />
              </div>
              <div>
                <Label>Section heading</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={featuresHeading}
                  onChange={(e) => setFeaturesHeading(e.target.value)}
                  placeholder="Emerging Technologies and Trends in|Software Development"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">|</code> or a new line to break the title across lines on desktop.
                </p>
              </div>
            </CardContent>
          </Card>
          {features.map((f, idx) => (
            <Card key={idx} className="border-border/60">
              <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_140px]">
                <div className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      className="mt-1.5"
                      value={f.title}
                      onChange={(e) => {
                        const next = [...features];
                        next[idx] = { ...f, title: e.target.value };
                        setFeatures(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      className="mt-1.5"
                      rows={3}
                      value={f.description}
                      onChange={(e) => {
                        const next = [...features];
                        next[idx] = { ...f, description: e.target.value };
                        setFeatures(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Image URL</Label>
                    <Input
                      className="mt-1.5"
                      value={f.image}
                      onChange={(e) => {
                        const next = [...features];
                        next[idx] = { ...f, image: e.target.value };
                        setFeatures(next);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-2">
                  {f.image ? (
                    <img src={f.image} alt="" className="max-h-28 w-auto object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button className="btn-highlight" disabled={featuresSaving} onClick={() => void onSaveFeatures()}>
            {featuresSaving ? "Saving…" : "Save features"}
          </Button>

          <Card className="border-border/60">
            <CardContent className="grid gap-4 p-6">
              <p className="text-sm font-semibold text-foreground">Testimonials section</p>
              <div>
                <Label>Section eyebrow</Label>
                <Input
                  className="mt-1.5"
                  value={testimonialsEyebrow}
                  onChange={(e) => setTestimonialsEyebrow(e.target.value)}
                  placeholder="Testimonials"
                />
              </div>
              <div>
                <Label>Section heading</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={testimonialsHeading}
                  onChange={(e) => setTestimonialsHeading(e.target.value)}
                  placeholder="What Our Students|Have To Say"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">|</code> or a new line to break the title across lines on desktop.
                </p>
              </div>
              <div>
                <Button
                  className="btn-highlight"
                  disabled={testimonialsSaving}
                  onClick={() => void onSaveTestimonials()}
                >
                  {testimonialsSaving ? "Saving…" : "Save Testimonials header"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logo" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-6">
              <div>
                <Label>Brand logo</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploads to site settings and appears on the public Header and Footer.
                </p>
              </div>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="grid h-24 w-48 place-items-center rounded-lg border border-dashed border-border bg-muted/40">
                  {homeForm.logoUrl ? (
                    <img
                      src={homeForm.logoUrl}
                      alt="Logo preview"
                      className="max-h-20 max-w-44 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No logo uploaded</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoFile(file);
                      const url = URL.createObjectURL(file);
                      setHomeForm((prev) => ({ ...prev, logoUrl: url }));
                    }}
                  />
                  <Button
                    className="btn-highlight"
                    type="button"
                    disabled={logoSaving || !logoFile}
                    onClick={() => void onSaveLogo()}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {logoSaving ? "Publishing…" : "Publish logo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Questions are grouped by category. Each question can still be edited on its own.
            </p>
            <Button
              size="sm"
              className="btn-highlight"
              onClick={() => {
                setFaqForm({ q: "", a: "", category: FAQ_SECTIONS[0] });
                setNewFaqOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add FAQ
            </Button>
          </div>

          {faqs.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No FAQs yet. Add a question and choose a category/topic.
              </CardContent>
            </Card>
          ) : (
            faqsByCategory.map(([category, items]) => (
              <Card key={category} className="border-border/60">
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{category}</h3>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFaqForm({ q: "", a: "", category });
                        setNewFaqOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add under {category}
                    </Button>
                  </div>

                  <ul className="divide-y divide-border/60">
                    {items.map((f) => (
                      <li
                        key={String(f.id)}
                        className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{f.q}</p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{f.a}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setEditFaq(f)}
                        >
                          Edit
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editFaq} onOpenChange={(o) => !o && setEditFaq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit FAQ</DialogTitle>
          </DialogHeader>
          {editFaq && (
            <div className="grid gap-3">
              <div>
                <Label>Category / topic</Label>
                <Select
                  value={editFaq.category}
                  onValueChange={(v) => setEditFaq({ ...editFaq, category: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    {!FAQ_SECTIONS.includes(editFaq.category as (typeof FAQ_SECTIONS)[number]) &&
                      editFaq.category && (
                        <SelectItem value={editFaq.category}>{editFaq.category}</SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Question</Label>
                <Input
                  className="mt-1.5"
                  value={editFaq.q}
                  onChange={(e) => setEditFaq({ ...editFaq, q: e.target.value })}
                />
              </div>
              <div>
                <Label>Answer</Label>
                <Textarea
                  className="mt-1.5"
                  rows={4}
                  value={editFaq.a}
                  onChange={(e) => setEditFaq({ ...editFaq, a: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFaq(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateFaqApi.isPending}
              onClick={() => {
                if (!editFaq) return;
                void (async () => {
                  const res = await updateFaqApi.mutateAsync({
                    id: editFaq.id,
                    patch: {
                      question: editFaq.q,
                      answer: editFaq.a,
                      category: editFaq.category,
                      is_published: true,
                    },
                  });
                  if (res) {
                    toast.success("FAQ updated");
                    setEditFaq(null);
                  } else toast.error("Could not update FAQ");
                })();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFaqOpen} onOpenChange={setNewFaqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add FAQ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Category / topic</Label>
              <Select
                value={faqForm.category}
                onValueChange={(v) => setFaqForm({ ...faqForm, category: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {FAQ_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Question</Label>
              <Input
                className="mt-1.5"
                value={faqForm.q}
                onChange={(e) => setFaqForm({ ...faqForm, q: e.target.value })}
              />
            </div>
            <div>
              <Label>Answer</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={faqForm.a}
                onChange={(e) => setFaqForm({ ...faqForm, a: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFaqOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createFaqApi.isPending}
              onClick={() => {
                if (!faqForm.q.trim() || !faqForm.a.trim()) {
                  toast.error("Question and answer are required");
                  return;
                }
                void (async () => {
                  const res = await createFaqApi.mutateAsync({
                    question: faqForm.q,
                    answer: faqForm.a,
                    category: faqForm.category,
                    is_published: true,
                    order: faqs.length,
                  });
                  if (res) {
                    toast.success("FAQ created");
                    setNewFaqOpen(false);
                  } else toast.error("Could not create FAQ");
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
