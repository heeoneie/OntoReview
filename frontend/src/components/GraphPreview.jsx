import { useMemo, useState, useCallback } from 'react';
import { ReactFlow, Handle, Position } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { Maximize2, Network, Loader2 } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import GraphModal from './GraphModal';

/* ── Reasoning subgraph extraction ── */
const REGULATION_MAP = {
  ProductLiability: 'FDA Cosmetic Act',
  ClassAction: 'Consumer Product Safety Act',
  ConsumerFraud: 'FTC Act Section 5',
  FoodSafety: 'FDA Food Safety',
  RegulatoryRisk: 'Federal Regulation',
};

function classifyByCase(caseId) {
  if (!caseId) return null;
  if (caseId.startsWith('PL-')) return 'ProductLiability';
  if (caseId.startsWith('CA-')) return 'ClassAction';
  if (caseId.startsWith('FA-')) return 'ConsumerFraud';
  return null;
}

function buildReasoningSubgraph(ontology, timeline, kpi) {
  if (!timeline || timeline.length === 0) return null;

  const topRisk = timeline.reduce((best, cur) => (cur.severity > best.severity ? cur : best), timeline[0]);
  if (!topRisk) return null;

  const riskClass = classifyByCase(topRisk.case_id);
  const regulation = riskClass ? REGULATION_MAP[riskClass] : 'US Federal Regulation';
  const exposure = kpi?.total_legal_exposure_usd || 0;

  const nodes = [];
  const edges = [];
  let id = 1;

  const reviewId = `n${id++}`;
  nodes.push({ id: reviewId, type: 'reasoning', data: { label: 'Customer Review', nodeType: 'review' }, position: { x: 0, y: 0 } });

  const signalId = `n${id++}`;
  const signalLabel = topRisk.name.length > 30 ? topRisk.name.slice(0, 28) + '…' : topRisk.name;
  nodes.push({ id: signalId, type: 'reasoning', data: { label: signalLabel, nodeType: 'risk', severity: topRisk.severity }, position: { x: 0, y: 0 } });
  edges.push({ id: `e${reviewId}-${signalId}`, source: reviewId, target: signalId, label: 'detected' });

  if (riskClass) {
    const catId = `n${id++}`;
    nodes.push({ id: catId, type: 'reasoning', data: { label: riskClass, nodeType: 'risk' }, position: { x: 0, y: 0 } });
    edges.push({ id: `e${signalId}-${catId}`, source: signalId, target: catId, label: 'classified' });

    const regId = `n${id++}`;
    nodes.push({ id: regId, type: 'reasoning', data: { label: regulation, nodeType: 'regulation' }, position: { x: 0, y: 0 } });
    edges.push({ id: `e${catId}-${regId}`, source: catId, target: regId, label: 'triggers' });

    if (riskClass !== 'ClassAction' && topRisk.severity >= 8) {
      const escId = `n${id++}`;
      nodes.push({ id: escId, type: 'reasoning', data: { label: 'Potential Class Action', nodeType: 'risk' }, position: { x: 0, y: 0 } });
      edges.push({ id: `e${regId}-${escId}`, source: regId, target: escId, label: 'may escalate' });

      const expId = `n${id++}`;
      nodes.push({ id: expId, type: 'reasoning', data: { label: `$${exposure.toLocaleString()}`, nodeType: 'exposure' }, position: { x: 0, y: 0 } });
      edges.push({ id: `e${escId}-${expId}`, source: escId, target: expId, label: 'exposure' });
    } else {
      const expId = `n${id++}`;
      nodes.push({ id: expId, type: 'reasoning', data: { label: `$${exposure.toLocaleString()}`, nodeType: 'exposure' }, position: { x: 0, y: 0 } });
      edges.push({ id: `e${regId}-${expId}`, source: regId, target: expId, label: 'exposure' });
    }
  } else {
    const expId = `n${id++}`;
    nodes.push({ id: expId, type: 'reasoning', data: { label: `$${exposure.toLocaleString()}`, nodeType: 'exposure' }, position: { x: 0, y: 0 } });
    edges.push({ id: `e${signalId}-${expId}`, source: signalId, target: expId, label: 'exposure' });
  }

  const additionalRisks = timeline.filter((i) => i.id !== topRisk.id && i.severity >= 7).slice(0, 2);
  for (const risk of additionalRisks) {
    const rId = `n${id++}`;
    const rLabel = risk.name.length > 25 ? risk.name.slice(0, 23) + '…' : risk.name;
    nodes.push({ id: rId, type: 'reasoning', data: { label: rLabel, nodeType: 'risk', severity: risk.severity }, position: { x: 0, y: 0 } });
    edges.push({ id: `e${reviewId}-${rId}`, source: reviewId, target: rId, label: 'detected' });
  }

  return { nodes, edges };
}

/* ── Dagre layout ── */
const NODE_W = 160;
const NODE_H = 44;

function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 50 });

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

/* ── Node colors by type (monochrome) ── */
const TYPE_COLORS = {
  review:     { bg: '#27272a', border: '#52525b', text: '#a1a1aa' },
  risk:       { bg: '#3f3f46', border: '#71717a', text: '#ffffff' },
  regulation: { bg: '#27272a', border: '#a1a1aa', text: '#e4e4e7' },
  department: { bg: '#27272a', border: '#71717a', text: '#a1a1aa' },
  exposure:   { bg: '#3f3f46', border: '#ffffff', text: '#ffffff' },
};

function ReasoningNode({ data }) {
  const colors = TYPE_COLORS[data.nodeType] || TYPE_COLORS.review;
  return (
    <div style={{
      background: colors.bg, border: `1.5px solid ${colors.border}`,
      borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 600,
      color: colors.text, textAlign: 'center', minWidth: 80, maxWidth: 160,
      lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 6, height: 6, border: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 6, height: 6, border: 0 }} />
      {data.label}
    </div>
  );
}

const nodeTypes = { reasoning: ReasoningNode };

/* ── Edge styling ── */
const defaultEdgeOptions = {
  type: 'default',
  style: { stroke: '#52525b', strokeWidth: 1.5 },
  labelStyle: { fill: '#fafafa', fontSize: 9, fontWeight: 600 },
  labelBgStyle: { fill: '#3f3f46' },
  labelBgPadding: [4, 6],
  labelBgBorderRadius: 4,
};

/* ── Main Component ── */
export default function GraphPreview({ ontology, timeline, kpi, loading, onNavigatePlaybook }) {
  const { t } = useLang();
  const [modalOpen, setModalOpen] = useState(false);

  const subgraph = useMemo(
    () => buildReasoningSubgraph(ontology, timeline, kpi),
    [ontology, timeline, kpi],
  );

  const layouted = useMemo(() => {
    if (!subgraph) return null;
    return layoutGraph(subgraph.nodes, subgraph.edges);
  }, [subgraph]);

  const totalNodes = ontology?.nodes?.length || 0;
  const totalEdges = (ontology?.edges?.length || ontology?.links?.length || 0);

  const handleNodeClick = useCallback((_e, node) => {
    if (onNavigatePlaybook && node.data?.nodeType === 'risk') {
      onNavigatePlaybook(node.data.label);
    }
  }, [onNavigatePlaybook]);

  return (
    <>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="text-zinc-500" size={13} />
            <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              {t('graph.title')}
            </span>
          </div>
          {totalNodes > 0 && (
            <span className="text-sm text-zinc-600 tabular-nums">
              {totalNodes} nodes · {totalEdges} edges
            </span>
          )}
        </div>

        {/* Graph area */}
        <div className="h-[260px] w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
          {loading ? (
            <div className="flex items-center justify-center h-full text-zinc-500 gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Analyzing…</span>
            </div>
          ) : !layouted ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
              <Network size={24} />
              <span className="text-sm">{t('graph.empty')}</span>
            </div>
          ) : (
            <ReactFlow
              nodes={layouted.nodes}
              edges={layouted.edges}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.5}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              proOptions={{ hideAttribution: true }}
            />
          )}
        </div>

        {/* Expand button */}
        {(ontology || layouted) && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 transition-colors text-sm font-medium"
          >
            <Maximize2 size={13} />
            {t('graph.expand')}
          </button>
        )}
      </div>

      {/* Full-screen modal */}
      {modalOpen && (
        <GraphModal
          ontology={ontology}
          subgraph={subgraph}
          onClose={() => setModalOpen(false)}
          onNavigatePlaybook={onNavigatePlaybook}
        />
      )}
    </>
  );
}
