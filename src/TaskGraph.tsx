import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Background,
  BackgroundVariant,
  Controls,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { X, Loader2, RefreshCw } from 'lucide-react';

interface Task {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  title: string;
  depends_on?: string[];
}

interface TaskPlan {
  tasks: Task[];
}

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'LR' ? 'left' : 'top',
      sourcePosition: direction === 'LR' ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const TaskNode = ({ data }: any) => {
  const statusColors = {
    pending: 'bg-slate-800 border-slate-700 text-slate-400',
    in_progress: 'bg-blue-900/30 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    completed: 'bg-emerald-900/20 border-emerald-500 text-emerald-200',
    failed: 'bg-rose-900/20 border-rose-500 text-rose-200',
    blocked: 'bg-amber-900/20 border-amber-500 text-amber-200',
  };

  const statusDot = {
    pending: 'bg-slate-600',
    in_progress: 'bg-blue-400 animate-pulse',
    completed: 'bg-emerald-500',
    failed: 'bg-rose-500',
    blocked: 'bg-amber-500',
  };

  return (
    <div className={`px-4 py-3 rounded-lg border-2 w-[220px] transition-all duration-300 ${statusColors[data.status as keyof typeof statusColors]}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${statusDot[data.status as keyof typeof statusDot]}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{data.status.replace('_', ' ')}</span>
      </div>
      <div className="text-sm font-semibold leading-tight line-clamp-2">{data.title}</div>
    </div>
  );
};

const nodeTypes = {
  task: TaskNode,
};

export default function TaskGraph({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/plan`);
      if (!res.ok) throw new Error('Failed to fetch plan');
      const data: TaskPlan = await res.json();

      const initialNodes = data.tasks.map((task) => ({
        id: task.id,
        type: 'task',
        data: { title: task.title, status: task.status },
        position: { x: 0, y: 0 },
      }));

      const initialEdges = data.tasks.flatMap((task) =>
        (task.depends_on || []).map((depId) => ({
          id: `e-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          animated: data.tasks.find(t => t.id === depId)?.status === 'in_progress',
          style: { stroke: '#475569', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#475569',
          },
        }))
      );

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setError(null);
    } catch (err) {
      setError('No task plan available for this session.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, setNodes, setEdges]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full h-full max-w-6xl bg-[#0a0c10] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">System Orchestration Graph</h2>
              <p className="text-xs text-slate-500">Visualizing agentic task dependencies and execution flow</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {loading && <Loader2 size={20} className="animate-spin text-slate-500" />}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 relative">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-16 h-16 rounded-full border border-slate-800 flex items-center justify-center mb-4">
                <RefreshCw size={32} className="opacity-20" />
              </div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Plan Not Found</h3>
              <p className="max-w-xs">{error}</p>
              <button 
                onClick={fetchPlan}
                className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Retry Fetch
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
              colorMode="dark"
            >
              <Background color="#1e293b" variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls className="bg-slate-900 border-slate-800 fill-white" />
              <Panel position="top-right">
                <div className="bg-black/60 backdrop-blur-md border border-slate-800 p-3 rounded-xl text-[10px] space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-300">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-slate-300">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                    <span className="text-slate-300">Pending</span>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
}
