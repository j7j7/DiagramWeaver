"use client";

import { Images } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresentationThumbnailGeneratingIndicatorProps {
  active: boolean;
  className?: string;
}

export function PresentationThumbnailGeneratingIndicator({
  active,
  className,
}: PresentationThumbnailGeneratingIndicatorProps) {
  if (!active) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex shrink-0 items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5",
            className,
          )}
          data-presentation-thumbnail-generating
          aria-live="polite"
          aria-label="Generating presentation slide thumbnail"
        >
          <Images className="h-3.5 w-3.5 animate-pulse text-amber-600 dark:text-amber-400" aria-hidden />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Generating presentation slide thumbnail…
      </TooltipContent>
    </Tooltip>
  );
}
