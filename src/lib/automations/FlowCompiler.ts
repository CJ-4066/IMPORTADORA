import crypto from "crypto";

export interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, Record<string, N8nConnection[][]>>;
  active: boolean;
  settings: {
    executionOrder: "v1";
    saveExecutionProgress: boolean;
    saveManualExecutions: boolean;
    callerPolicy: "any";
  };
}

export interface N8nNode {
  parameters: Record<string, any>;
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
}

export interface N8nConnection {
  node: string;
  type: "main";
  index: number;
}

/**
 * Convierte el formato nativo del canvas de React Flow (UI) 
 * en el formato exacto que ejecuta el motor n8n de Importadora Super.
 */
export class FlowCompiler {
  static compile(name: string, reactFlowNodes: any[], reactFlowEdges: any[]): N8nWorkflow {
    // 1. Mapear nodos
    const nodes: N8nNode[] = reactFlowNodes.map((rn) => {
      // Dummy mapping. En producción leeremos el rn.type (SendMessageNode, etc.) 
      // y lo convertiremos a un nodo real de n8n (ej. n8n-nodes-base.httpRequest)
      
      return {
        id: rn.id,
        name: rn.data?.label || `Node ${rn.id}`,
        type: rn.type === "input" ? "n8n-nodes-base.webhook" : "n8n-nodes-base.noOp",
        typeVersion: 1,
        position: [Math.round(rn.position.x), Math.round(rn.position.y)],
        parameters: {
          path: `wh-${rn.id}`,
          responseMode: "lastNode",
          options: {},
        }
      };
    });

    // 2. Mapear conexiones
    const connections: N8nWorkflow["connections"] = {};
    
    reactFlowEdges.forEach((edge) => {
      const sourceName = nodes.find(n => n.id === edge.source)?.name;
      const targetName = nodes.find(n => n.id === edge.target)?.name;
      
      if (!sourceName || !targetName) return;

      if (!connections[sourceName]) {
        connections[sourceName] = { main: [[]] };
      }
      
      connections[sourceName].main[0].push({
        node: targetName,
        type: "main",
        index: 0
      });
    });

    return {
      name: `[MANAGED] ${name}`,
      nodes,
      connections,
      active: true,
      settings: {
        executionOrder: "v1",
        saveExecutionProgress: true,
        saveManualExecutions: false,
        callerPolicy: "any"
      }
    };
  }

  /**
   * Genera un hash criptográfico de la definición del workflow 
   * ignorando metadatos visuales como posiciones (x, y) 
   * para detectar un Drift (modificación manual en n8n).
   */
  static generateDriftHash(workflow: N8nWorkflow): string {
    // Para el hash, ordenamos los nodos alfabéticamente por nombre
    // y purgamos la propiedad "position" y campos volátiles.
    const nodesForHash = workflow.nodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parameters: n.parameters
    })).sort((a, b) => a.name.localeCompare(b.name));

    const connectionsForHash = workflow.connections; // El orden de keys en JS es impredecible, en prod usar stringify determinista

    const payloadString = JSON.stringify({ nodes: nodesForHash, connections: connectionsForHash });
    
    return crypto.createHash("sha256").update(payloadString).digest("hex");
  }
}
