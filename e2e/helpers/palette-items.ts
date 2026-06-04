/** Palette drag payloads — same shape as sidebar `DraggableResourceItem` / `DraggableItem`. */

export type PaletteDropItem = {
  type: string;
  label: string;
  provider: string;
  category: string;
  file?: string;
};

export const PALETTE = {
  roundedRectangle: {
    type: "generic.object.rounded-rectangle",
    label: "Rounded Rectangle",
    provider: "generic",
    category: "object",
    file: "rounded-rectangle.png",
  },
  ec2: {
    type: "aws.compute.ec2",
    label: "EC2",
    provider: "aws",
    category: "compute",
    file: "aws/Architecture-Service-Icons_01302026/Arch_Compute/64/Arch_Amazon-EC2_64.svg",
  },
  gridChart: {
    type: "generic.chart.grid",
    label: "Grid chart",
    provider: "generic",
    category: "object",
    file: "grid-chart.svg",
  },
  segmentedRectangle: {
    type: "generic.object.segmented-rectangle",
    label: "Segmented rectangle",
    provider: "generic",
    category: "object",
    file: "segmented-rectangle.svg",
  },
  agenda: {
    type: "generic.card.agenda",
    label: "Agenda",
    provider: "generic",
    category: "cards",
    file: "agenda.svg",
  },
  elementFeature: {
    type: "generic.card.element-feature",
    label: "Element Feature",
    provider: "generic",
    category: "cards",
    file: "element-feature.svg",
  },
} as const satisfies Record<string, PaletteDropItem>;
