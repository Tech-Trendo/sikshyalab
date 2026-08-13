"use client";

import Image, { type ImageProps } from "next/image";
import { isDjangoMediaSrc, resolveMediaUrl } from "@/lib/env";

type MediaImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

/**
 * next/image wrapper for Django media.
 * - Resolves `/media/...` → `http://localhost:8000/media/...`
 * - Forces unoptimized for Django media (avoids /_next/image 400 and S3 redirect issues)
 */
export function MediaImage({ src, unoptimized, alt, ...rest }: MediaImageProps) {
  const resolved = resolveMediaUrl(src) || src;
  const skipOptimize =
    unoptimized ??
    (isDjangoMediaSrc(resolved) ||
      /[?&]X-Amz-(?:Algorithm|Signature)=/i.test(resolved) ||
      resolved.endsWith(".svg"));

  return <Image {...rest} alt={alt} src={resolved} unoptimized={skipOptimize} />;
}
