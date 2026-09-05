import { requireThat } from './result.js';
export type Edge = Readonly<{ from: string; to: string }>;
/** Stable Kahn sort for explicitly bounded release/lineage graphs; sorted frontier favors auditability over large-graph throughput. */
export function topological(nodes: readonly string[], edges: readonly Edge[], limit = 10_000): readonly string[] {
  requireThat(nodes.length <= limit && edges.length <= limit * 4, 'GRAPH_LIMIT'); const all = new Set(nodes);
  requireThat(all.size === nodes.length, 'GRAPH_DUPLICATE_NODE');
  const incoming = new Map(nodes.map(n => [n, 0])); const outgoing = new Map<string, Set<string>>(nodes.map(n => [n, new Set<string>()]));
  for (const edge of edges) {
    requireThat(all.has(edge.from) && all.has(edge.to), 'GRAPH_MISSING_NODE');
    const target = outgoing.get(edge.from)!;
    if (!target.has(edge.to)) { target.add(edge.to); incoming.set(edge.to, incoming.get(edge.to)! + 1); }
  }
  const ready = nodes.filter(n => incoming.get(n) === 0).sort(); const result: string[] = [];
  while (ready.length > 0) {
    const node = ready.shift()!; result.push(node);
    for (const target of outgoing.get(node)!) {
      incoming.set(target, incoming.get(target)! - 1);
      if (incoming.get(target) === 0) { ready.push(target); ready.sort(); }
    }
  }
  requireThat(result.length === nodes.length, 'GRAPH_CYCLE'); return Object.freeze(result);
}
export function descendants(nodes: readonly string[], edges: readonly Edge[], roots: readonly string[]): readonly string[] {
  topological(nodes, edges); const all = new Set(nodes); requireThat(roots.every(r => all.has(r)), 'GRAPH_MISSING_ROOT');
  const outgoing = new Map(nodes.map(n => [n, [] as string[]])); for (const edge of edges) outgoing.get(edge.from)!.push(edge.to);
  const seen = new Set(roots); const queue = [...roots];
  for (let index = 0; index < queue.length; index++) for (const child of outgoing.get(queue[index]!)!) if (!seen.has(child)) { seen.add(child); queue.push(child); }
  return Object.freeze([...seen].sort());
}
