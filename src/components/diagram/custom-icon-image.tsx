"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { buildCustomImageStyles, DEFAULT_CUSTOM_IMAGE_OPTIONS, normalizeCustomImageOptions, normalizeHttpImageUrl, validateCustomImageUrl } from "@/lib/custom-icon-utils";
import type { CustomImageOptions } from "@/lib/types";

interface CustomIconImageProps {
  imageUrl?: string;
  imageOptions?: Partial<CustomImageOptions>;
  width?: number | string;
  height?: number | string;
  alt?: string;
  className?: string;
}

export function CustomIconImage({ imageUrl, imageOptions, width, height, alt = "Custom icon", className }: CustomIconImageProps) {
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const normalizedUrl = useMemo(() => normalizeHttpImageUrl(imageUrl), [imageUrl]);
  const options = useMemo(() => normalizeCustomImageOptions(imageOptions || DEFAULT_CUSTOM_IMAGE_OPTIONS), [imageOptions]);
  const { wrapperStyle, imageStyle } = useMemo(() => buildCustomImageStyles(options), [options]);

  useEffect(() => {
    let mounted = true;
    setImgFailed(false);

    if (!normalizedUrl) {
      setIsValid(false);
      setError("No valid image URL");
      return;
    }

    validateCustomImageUrl(normalizedUrl)
      .then((result) => {
        if (!mounted) return;
        setIsValid(result.ok);
        setError(result.ok ? null : (result.error || "Image validation failed"));
      })
      .catch((err) => {
        if (!mounted) return;
        setIsValid(false);
        setError(err instanceof Error ? err.message : "Image validation failed");
      });

    return () => {
      mounted = false;
    };
  }, [normalizedUrl]);

  const containerStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width || wrapperStyle.width,
    height: typeof height === "number" ? `${height}px` : height || wrapperStyle.height,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!isValid || !normalizedUrl || imgFailed) {
    return (
      <div
        className={className}
        title={error || "Using fallback icon"}
        style={containerStyle}
      >
        <ImageIcon className="w-[70%] h-[70%] text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className} style={{ ...containerStyle, ...wrapperStyle }}>
      <img
        src={normalizedUrl}
        alt={alt}
        style={imageStyle}
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}
