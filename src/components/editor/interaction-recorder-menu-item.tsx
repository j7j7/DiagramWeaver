"use client";

import React from "react";
import { CircleDot } from "lucide-react";
import { MenubarItem, MenubarShortcut } from "@/components/ui/menubar";
import { useInteractionRecorder } from "./interaction-recorder-context";

export function InteractionRecorderHelpMenuItem() {
  const { setDialogOpen, setArmed, status } = useInteractionRecorder();

  return (
    <MenubarItem
      onClick={() => {
        setArmed(true);
        setDialogOpen(true);
      }}
    >
      <CircleDot className="mr-2 h-4 w-4" />
      Interaction recorder…
      {status === "recording" && <MenubarShortcut>REC</MenubarShortcut>}
    </MenubarItem>
  );
}
