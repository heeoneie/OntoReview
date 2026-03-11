import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { X } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

/* ── Dagre layout (top-to-bottom) ── */
const NODE_W = 200;
const NODE_H = 60;

function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: (pos?.x ?? 0) - NODE_W / 2, y: (pos?.y ?? 0) - NODE_H / 2 } };
    }),
    edges,
  };
}

/* ── Node colors ── */
const TYPE_COLORS = {
  review:     { bg: '#18181b', border: '#52525b', text: '#a1a1aa', badge: '#52525b' },
  risk:       { bg: '#1c1306', border: '#b45309', text: '#fbbf24', badge: '#92400e' },
  regulation: { bg: '#0f0a2e', border: '#7c3aed', text: '#c4b5fd', badge: '#5b21b6' },
  department: { bg: '#05192d', border: '#0284c7', text: '#7dd3fc', badge: '#075985' },
  exposure:   { bg: '#1c1306', border: '#f59e0b', text: '#fbbf24', badge: '#b45309' },
  // Full graph fallback types
  signal:     { bg: '#1c1306', border: '#b45309', text: '#fbbf24', badge: '#92400e' },
  event:      { bg: '#1c1306', border: '#d97706', text: '#fcd34d', badge: '#92400e' },
  impact:     { bg: '#1c0a0a', border: '#dc2626', text: '#fca5a5', badge: '#991b1b' },
  response:   { bg: '#052e16', border: '#16a34a', text: '#86efac', badge: '#166534' },
  category:   { bg: '#1c1306', border: '#b45309', text: '#fbbf24', badge: '#92400e' },
  root_cause: { bg: '#1c0a0a', border: '#dc2626', text: '#fca5a5', badge: '#991b1b' },
  risk_type:  { bg: '#0f0a2e', border: '#7c3aed', text: '#c4b5fd', badge: '#5b21b6' },
};

function getColors(data) {
  return TYPE_COLORS[data.nodeType] || TYPE_COLORS[data.type] || TYPE_COLORS.review;
}

/* ── Custom Node for Modal (larger) ── */
function ModalNode({ data }) {
  const colors = getColors(data);
  const severity = data.severity_score ?? data.severity;
  const isOwl = data.is_owl || data.owl_class;

  return (
    <div style={{
      background: colors.bg, border: `2px solid ${colors.border}`,
      borderRadius: 10, padding: '8px 14px', minWidth: 120, maxWidth: 220,
      boxShadow: `0 0 12px ${colors.border}33`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 8, height: 8, border: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 8, height: 8, border: 0 }} />

      {/* Type badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: colors.text, opacity: 0.6,
        }}>
          {data.nodeType || data.type}
        </span>
        {isOwl && (
          <span style={{
            fontSize: 8, padding: '1px 5px', borderRadius: 9999,
            background: '#0ea5e933', color: '#7dd3fc', fontWeight: 600,
          }}>OWL</span>
        )}
        {severity != null && (
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 9999, marginLeft: 'auto',
            background: `${colors.badge}44`, color: colors.text, fontWeight: 700,
          }}>{typeof severity === 'number' ? severity.toFixed(1) : severity}</span>
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: colors.text, lineHeight: 1.3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }} title={data.label}>
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { reasoning: ModalNode, custom: ModalNode, default: ModalNode };

/* ── Process full ontology for modal display ── */
function processOntologyForModal(ontology) {
  if (!ontology?.nodes?.length) return { nodes: [], edges: [] };

  const processedNodes = ontology.nodes.map((n) => ({
    id: String(n.id),
    type: 'custom',
    data: {
      label: n.data?.label ?? n.label ?? n.id,
      type: n.data?.type ?? n.type ?? 'signal',
      nodeType: n.data?.type ?? n.type ?? 'signal',
      severity_score: n.data?.severity_score ?? n.severity_score ?? 0,
      is_owl: n.data?.is_owl ?? false,
      owl_class: n.data?.owl_class ?? null,
    },
    position: n.position ?? { x: 0, y: 0 },
  }));

  const rawEdges = ontology.edges ?? ontology.links ?? [];
  const nodeSet = new Set(processedNodes.map((n) => n.id));

  const processedEdges = rawEdges
    .filter((e) => nodeSet.has(String(e.source)) && nodeSet.has(String(e.target)))
    .map((e, i) => ({
      id: String(e.id ?? `e-${e.source}-${e.target}-${i}`),
      source: String(e.source),
      target: String(e.target),
      label: e.label ?? e.relation ?? '',
      type: 'default',
      style: { stroke: '#52525b', strokeWidth: 1.5 },
      labelStyle: { fill: '#d4d4d8', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#27272a', fillOpacity: 0.9 },
      labelBgPadding: [4, 6],
      labelBgBorderRadius: 4,
    }));

  return layoutGraph(processedNodes, processedEdges);
}

/* ── Main Modal ── */
export default function GraphModal({ ontology, subgraph, onClose, onNavigatePlaybook }) {
  const { t } = useLang();
  const backdropRef = useRef(null);

  // Process full ontology graph
  const fullGraph = useMemo(() => processOntologyForModal(ontology), [ontology]);

  // Use subgraph if full graph is empty
  const graphToShow = fullGraph.nodes.length > 0 ? fullGraph : (subgraph ? layoutGraph(subgraph.nodes, subgraph.edges) : { nodes: [], edges: [] });

  const [nodes, setNodes, onNodesChange] = useNodesState(graphToShow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphToShow.edges);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click backdrop to close
  const handleBackdropClick = useCallback((e) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  const handleNodeClick = useCallback((_e, node) => {
    if (onNavigatePlaybook && (node.data?.nodeType === 'risk' || node.data?.type === 'category')) {
      onNavigatePlaybook(node.data.label);
    }
  }, [onNavigatePlaybook]);

  // Stable layout for dagre
  const stableLayout = useMemo(() => {
    const g = layoutGraph(graphToShow.nodes, graphToShow.edges);
    return g;
  }, [graphToShow]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div className="w-full max-w-6xl h-[85vh] bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white">{t('graph.modalTitle')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {nodes.length} nodes · {edges.length} edges
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Graph */}
        <div className="flex-1 relative">
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              No graph data
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={3}
              defaultEdgeOptions={{
                type: 'default',
                style: { stroke: '#52525b', strokeWidth: 1.5 },
                labelStyle: { fill: '#d4d4d8', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#27272a', fillOpacity: 0.9 },
      labelBgPadding: [4, 6],
      labelBgBorderRadius: 4,
              }}
            >
              <Background color="#27272a" gap={20} />
              <Controls
                className="!bg-zinc-800 !border-zinc-700 !rounded-lg
                  [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700
                  [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700"
              />
              <MiniMap
                nodeColor={(n) => {
                  const c = getColors(n.data || {});
                  return c.border;
                }}
                maskColor="rgba(0,0,0,0.7)"
                className="!bg-zinc-900 !border-zinc-700"
              />
            </ReactFlow>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-t border-zinc-800">
          {[
            { color: '#b45309', label: 'Risk' },
            { color: '#7c3aed', label: 'Regulation' },
            { color: '#0284c7', label: 'Department' },
            { color: '#f59e0b', label: 'Exposure' },
            { color: '#52525b', label: 'Review' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
