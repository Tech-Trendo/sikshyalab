import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export { isEmptyRichText } from "@/lib/rich-text";

type ToolbarBtnProps = {
  pressed?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarBtn({ pressed, disabled, label, onClick, children }: ToolbarBtnProps) {
  return (
    <Toggle
      size="sm"
      pressed={Boolean(pressed)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-8 w-8 p-0"
      onPressedChange={() => onClick()}
    >
      {children}
    </Toggle>
  );
}

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClass?: string;
  id?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here…",
  disabled,
  className,
  minHeightClass = "min-h-[140px]",
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full rounded-md",
        },
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: cn(
          "px-3 py-2 text-sm outline-none",
          minHeightClass,
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold",
          "[&_a]:text-primary [&_a]:underline",
          "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md",
        ),
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const setLink = () => {
    if (!editor) return;
    const previous = String(editor.getAttributes("link").href || "");
    const url = window.prompt("Link URL", previous);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const insertImage = (file?: File) => {
    if (!editor || !file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1 py-1">
        <ToolbarBtn
          label="Bold"
          disabled={disabled}
          pressed={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Italic"
          disabled={disabled}
          pressed={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Underline"
          disabled={disabled}
          pressed={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Insert image"
          disabled={disabled}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            insertImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarBtn
          label="Heading"
          disabled={disabled}
          pressed={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Subheading"
          disabled={disabled}
          pressed={editor?.isActive("heading", { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarBtn
          label="Bullet list"
          disabled={disabled}
          pressed={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Numbered list"
          disabled={disabled}
          pressed={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Link"
          disabled={disabled}
          pressed={editor?.isActive("link")}
          onClick={setLink}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
