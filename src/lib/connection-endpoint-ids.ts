import type { DiagramConnectionData } from "@/lib/types";

/** All node/zone ids that appear as either end of at least one connection. */
export function getConnectionEndpointIdSet(connections: DiagramConnectionData[] | undefined): Set<string> {
  const s = new Set<string>();
  if (!connections) return s;
  for (const c of connections) {
    s.add(c.from);
    s.add(c.to);
  }
  return s;
}
