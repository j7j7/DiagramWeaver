"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { buildCustomImageStyles, DEFAULT_CUSTOM_IMAGE_OPTIONS, normalizeCustomImageOptions, normalizeHttpImageUrl, validateCustomImageUrl, getCachedImage, cacheImage } from "@/lib/custom-icon-utils";
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
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrlToUse, setImageUrlToUse] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => normalizeHttpImageUrl(imageUrl), [imageUrl]);
  const options = useMemo(() => normalizeCustomImageOptions(imageOptions || DEFAULT_CUSTOM_IMAGE_OPTIONS), [imageOptions]);
  const { wrapperStyle, imageStyle } = useMemo(() => buildCustomImageStyles(options), [options]);

  useEffect(() => {
    let mounted = true;
    setImgFailed(false);
    setIsLoading(true);

    if (!normalizedUrl) {
      setIsValid(false);
      setError("No valid image URL");
      setIsLoading(false);
      setImageUrlToUse(null);
      return;
    }

    // Check cache first
    const cachedUrl = getCachedImage(normalizedUrl);
    if (cachedUrl) {
      if (!mounted) return;
      setIsValid(true);
      setError(null);
      setIsLoading(false);
      setImageUrlToUse(cachedUrl);
      return;
    }

    validateCustomImageUrl(normalizedUrl)
      .then((result) => {
        if (!mounted) return;
        setIsValid(result.ok);
        setError(result.ok ? null : (result.error || "Image validation failed"));
        setIsLoading(false);
        if (result.ok) {
          setImageUrlToUse(normalizedUrl);
        } else {
          setImageUrlToUse(null);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setIsValid(false);
        setError(err instanceof Error ? err.message : "Image validation failed");
        setIsLoading(false);
        setImageUrlToUse(null);
      });

    return () => {
      mounted = false;
    };
  }, [normalizedUrl]);

  // Handle successful image load and cache it
  const handleImageLoad = () => {
    setIsLoading(false);
    if (normalizedUrl && imageUrlToUse) {
      // Cache the image for future use
      cacheImage(normalizedUrl, imageUrlToUse);
    }
  };

  const containerStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width || wrapperStyle.width,
    height: typeof height === "number" ? `${height}px` : height || wrapperStyle.height,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={className}
        style={containerStyle}
      >
        <Loader2 className="w-[50%] h-[50%] text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Show error or fallback state
  if (!isValid || !imageUrlToUse || imgFailed) {
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

  const suppressNativeImgTouchArtifacts: React.CSSProperties = {
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    touchAction: "none",
  };

  return (
    <div
      className={className}
      style={{
        ...wrapperStyle,
        ...containerStyle,
        ...suppressNativeImgTouchArtifacts,
      }}
    >
      <img
        src={imageUrlToUse}
        alt={alt}
        draggable={false}
        style={{ ...imageStyle, ...suppressNativeImgTouchArtifacts }}
        loading="lazy"
        onDragStart={(e) => {
          e.preventDefault();
        }}
        onError={() => {
          setImgFailed(true);
          setIsLoading(false);
        }}
        onLoad={handleImageLoad}
      />
    </div>
  );
}
