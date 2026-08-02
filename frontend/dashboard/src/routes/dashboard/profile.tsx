import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/components/dashboard/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Mail, MapPin, Phone, Save, User } from "lucide-react";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    title: user.title || "",
    bio: user.bio || "",
    location: user.location || "",
    avatar: user.avatar || "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      title: user.title || "",
      bio: user.bio || "",
      location: user.location || "",
      avatar: user.avatar || "",
    });
    setDirty(false);
  }, [user]);

  const initials = (form.name || user.email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadAvatar(file);
      setForm((prev) => ({ ...prev, avatar: updated.avatar || prev.avatar }));
      toast.success("Profile picture uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Enter a valid email");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
      });
      setDirty(false);
      toast.success("Profile saved to server");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Update your details and profile picture. Changes are saved to the backend."
        action={
          <Button className="btn-highlight" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="border-border/60 h-fit">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-background shadow-elegant">
                {form.avatar ? <AvatarImage src={form.avatar} alt={form.name} /> : null}
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-60"
                aria-label="Upload profile picture"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void onPickAvatar(e.target.files?.[0])}
              />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{form.name || "Your name"}</h2>
            <p className="text-sm text-muted-foreground">{form.title || "Role title"}</p>
            <Badge className="mt-3 capitalize" variant="secondary">
              {user.role}
            </Badge>
            <p className="mt-3 text-xs text-muted-foreground">
              Click the camera to upload a photo (saved under media/avatars).
            </p>
            <div className="mt-5 w-full space-y-2 text-left text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" /> {form.email || "—"}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" /> {form.phone || "—"}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" /> {form.location || "—"}
              </p>
              {user.studentId && (
                <p className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" /> ID {user.studentId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <p className="text-xs text-muted-foreground">
              Saved to your account via the API — not only on this device.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Full name</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1.5"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setDirty(true);
                }}
                placeholder="+977 98XXXXXXXX"
              />
            </div>
            <div>
              <Label>Title / headline</Label>
              <Input
                className="mt-1.5"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  setDirty(true);
                }}
                placeholder="Instructor, Student, Admin…"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                className="mt-1.5"
                value={form.location}
                onChange={(e) => {
                  setForm({ ...form, location: e.target.value });
                  setDirty(true);
                }}
                placeholder="City, Country"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bio</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={form.bio}
                onChange={(e) => {
                  setForm({ ...form, bio: e.target.value });
                  setDirty(true);
                }}
                placeholder="A short introduction…"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setForm({
                    name: user.name,
                    email: user.email,
                    phone: user.phone || "",
                    title: user.title || "",
                    bio: user.bio || "",
                    location: user.location || "",
                    avatar: user.avatar || "",
                  });
                  setDirty(false);
                }}
              >
                Discard
              </Button>
              <Button className="btn-highlight" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                Save profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
