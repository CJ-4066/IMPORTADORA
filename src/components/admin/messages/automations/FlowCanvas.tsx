"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TriggerNode } from "./nodes/TriggerNode";
import { SendMessageNode } from "./nodes/SendMessageNode";

const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
};

const initialNodes: Node[] = [
  { id: "1", position: { x: 250, y: 100 }, data: { label: "Recibir Mensaje WhatsApp", description: "Cualquier mensaje entrante" }, type: "trigger" },
  { id: "2", position: { x: 250, y: 250 }, data: { messageContent: "¡Hola! Gracias por contactarnos." }, type: "sendMessage" },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" }
];

interface FlowCanvasProps {
  initialData?: { nodes?: Node[]; edges?: Edge[] };
  onChange: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function FlowCanvas({ initialData, onChange }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.nodes?.length ? initialData.nodes : initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.edges?.length ? initialData.edges : initialEdges);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      setEdges((eds) => {
        const newEdges = addEdge(params, eds);
        onChange({ nodes, edges: newEdges });
        return newEdges;
      });
    },
    [setEdges, nodes, onChange]
  );

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    // Necesitamos pasar la referencia actualizada
    setTimeout(() => onChange({ nodes, edges }), 0);
  }, [onNodesChange, nodes, edges, onChange]);

  const handleAddNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { messageContent: "Nuevo mensaje" },
      type: "sendMessage"
    };
    setNodes((nds) => {
      const next = nds.concat(newNode);
      onChange({ nodes: next, edges });
      return next;
    });
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={16} size={1} color="#e5e7eb" />
        
        <Panel position="top-right">
          <button 
            className="button"
            onClick={handleAddNode}
            style={{ background: "#fff", border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: 500 }}
          >
            + Añadir Nodo Mensaje
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
