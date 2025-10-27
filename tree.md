# Project Directory Tree

Note: All resource JSON and icons are under `public/resources/`. No resource assets live under `src/`.

```
DiagramWeaver/
├── docs/
│   └── blueprint.md
├── public/
│   └── resources/
│       ├── alibabacloud/
│       ├── aws/
│       ├── azure/
│       ├── digitalocean/
│       ├── elastic/
│       ├── firebase/
│       ├── gcp/
│       ├── generic/
│       ├── gis/
│       ├── ibm/
│       ├── k8s/
│       ├── oci/
│       ├── onprem/
│       ├── openstack/
│       ├── outscale/
│       ├── programming/
│       └── saas/
├── resources/
├── src/
│   ├── ai/
│   │   ├── flows/
│   │   │   └── generate-diagram-code-from-description.ts
│   │   ├── dev.ts
│   │   └── genkit.ts
│   ├── app/
│   │   ├── actions.ts
│   │   ├── globals.css
│   │   ├── icon.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── diagram/
│   │   │   ├── aws-icon.tsx
│   │   │   ├── diagram-edge.tsx
│   │   │   ├── diagram-group.tsx
│   │   │   └── diagram-node.tsx
│   │   ├── editor/
│   │   │   ├── component-sidebar.tsx
│   │   │   ├── draggable-item.tsx
│   │   │   ├── draggable-resource-item.tsx
│   │   │   ├── editor-canvas.tsx
│   │   │   └── resource-browser.tsx
│   │   ├── ui/
│   │   │   ├── accordion.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── carousel.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   └── tooltip.tsx
│   │   └── diagram-editor.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   └── lib/
│       ├── pathfinding.ts
│       ├── placeholder-images.json
│       ├── placeholder-images.ts
│       ├── sample-diagram.json
│       ├── types.ts
│       └── utils.ts
├── .eslintrrc.json
├── .gitattributes
├── .gitignore
├── apphosting.yaml
├── components.json
├── launch.sh
├── MEMORY.MD
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
└── WARP.md
```
