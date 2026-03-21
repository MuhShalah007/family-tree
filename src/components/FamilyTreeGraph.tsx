import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { Person, Relationship } from '@/types/family';
import { calculateAge } from '@/lib/utils';

interface FamilyTreeGraphProps {
  persons: Person[];
  relationships: Relationship[];
  layout?: 'hierarchical' | 'radial' | 'organic';
}

const nodeWidth = 200;
const nodeHeight = 80;

// Custom Node Component
const PersonNode = ({ data }: { data: Person }) => {
  const isMale = data.gender === 'L';
  const age = calculateAge(data.birth_date || undefined);
  
  return (
    <div className={`px-4 py-2 shadow-md rounded-xl bg-card border-l-4 ${isMale ? 'border-l-blue-500' : 'border-l-pink-500'} min-w-[180px]`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex flex-col">
        <div className="font-bold text-sm">{data.full_name}</div>
        {age !== null && (
          <div className="text-xs text-muted-foreground mt-1">
            <span>{age} thn</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
      {/* Handles for partners/siblings */}
      <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 top-1/2" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 top-1/2" />
    </div>
  );
};

const nodeTypes = {
  person: PersonNode,
};

const getLayoutedElements = (nodes: { id: string }[], edges: { source: string; target: string }[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

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
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export function FamilyTreeGraph({ persons, relationships, layout = 'hierarchical' }: FamilyTreeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const initialNodes = persons.map((p) => ({
      id: p.id,
      type: 'person',
      data: { ...p },
      position: { x: 0, y: 0 },
    }));

    const initialEdges = relationships.map((r) => {
      const edge: {
        id: string;
        source: string;
        target: string;
        type: string;
        animated?: boolean;
        style?: React.CSSProperties;
        sourceHandle?: string;
        targetHandle?: string;
        markerEnd?: {
          type: MarkerType;
          width: number;
          height: number;
          color: string;
        };
      } = {
        id: r.id,
        source: r.source_person_id,
        target: r.target_person_id,
        type: 'smoothstep',
      };

      if (r.type === 'partner' || r.type === 'spouse') {
        edge.animated = true;
        edge.style = { stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '5,5' };
        edge.sourceHandle = 'right';
        edge.targetHandle = 'left';
      } else if (r.type === 'sibling') {
        edge.style = { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' };
        edge.sourceHandle = 'right';
        edge.targetHandle = 'left';
      } else {
        // parent_child
        edge.markerEnd = {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#94a3b8',
        };
        edge.style = { stroke: '#94a3b8', strokeWidth: 2 };
      }

      return edge;
    });

    if (layout === 'hierarchical') {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        'TB'
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } else if (layout === 'radial' || layout === 'organic') {
      import('d3').then((d3) => {
        // Create a copy of nodes and edges for D3 to modify
        const d3Nodes = initialNodes.map(n => ({ ...n, x: Math.random() * 100, y: Math.random() * 100 }));
        const d3Links = initialEdges.map(e => ({ source: e.source, target: e.target, id: e.id }));

        const simulation = d3.forceSimulation(d3Nodes as d3.SimulationNodeDatum[])
          .force('charge', d3.forceManyBody().strength(layout === 'radial' ? -1000 : -2000))
          .force('link', d3.forceLink(d3Links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[]).id((d) => (d as { id: string }).id).distance(layout === 'radial' ? 150 : 250))
          .force('collide', d3.forceCollide().radius(120));

        if (layout === 'radial') {
          simulation.force('radial', d3.forceRadial(400, 0, 0).strength(0.8));
        } else {
          simulation.force('center', d3.forceCenter(0, 0));
        }

        // Run simulation for a fixed number of ticks to get a stable layout
        for (let i = 0; i < 300; ++i) simulation.tick();

        const positionedNodes = d3Nodes.map((node) => {
          const originalNode = initialNodes.find(n => n.id === (node as { id: string }).id);
          const d3Node = node as { x: number; y: number };
          return {
            ...originalNode!,
            position: { x: d3Node.x - nodeWidth / 2, y: d3Node.y - nodeHeight / 2 },
          };
        });

        setNodes(positionedNodes);
        setEdges([...initialEdges]);
      });
    }
  }, [persons, relationships, layout, setNodes, setEdges]);

  return (
    <div className="w-full h-[600px] border rounded-xl bg-muted/10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
