import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";

type CourseImagePickerProps = {
  value?: string;
  onChange: (previewUrl: string, file?: File) => void;
  onClear?: () => void;
};

/** Course cover picker (16:9) — thin wrapper around MediaImagePicker. */
export function CourseImagePicker(props: CourseImagePickerProps) {
  return (
    <MediaImagePicker
      label="Course cover (16:9)"
      hint="One image per course. Cropped to 16:9 before upload."
      aspect="video"
      {...props}
    />
  );
}
