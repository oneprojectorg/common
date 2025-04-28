'use client';

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { PgTable } from 'drizzle-orm/pg-core';
import type { ForeignKey, PgColumn } from 'drizzle-orm/pg-core';
import React, { useEffect } from 'react';

import * as schema from '../schema/publicTables';
import { TableNode } from './components/TableNode';

const nodeTypes = {
  tableNode: TableNode,
};

const positions: Record<string, { x: number; y: number }> = {
  bookmarks: { x: 400, y: 320 },
  categories: { x: -300, y: 2060 },
  financialTransactions: { x: 400, y: 1300 },
  listOrganizations: { x: 400, y: -480 },
  lists: { x: -40, y: -480 },
  orgCategories: { x: 400, y: 2040 },
  orgTags: { x: 400, y: 2200 },
  organizationFinances: { x: 400, y: 1060 },
  organizationGoals: { x: 400, y: 1680 },
  organizationOwners: { x: 400, y: 80 },
  organizationUpdates: { x: 940, y: 160 },
  organizations: { x: -660, y: 220 },
  projectUpdates: { x: 940, y: -200 },
  projects: { x: 400, y: -280 },
  resources: { x: 400, y: 780 },
  reviews: { x: 400, y: 500 },
  tags: { x: -300, y: 2220 },
  users: { x: -1360, y: -40 },
};

// Helper function to generate nodes and edges from schema
const generateSchemaFlow = () => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Get all exports from schema that are PgTable instances
  const tables: Record<string, PgTable> = Object.entries(schema)
    .filter(([, value]) => value instanceof PgTable)
    .reduce(
      (acc, [name, table]) => ({
        ...acc,
        [name.replace('Table', '')]: table,
      }),
      {},
    );

  Object.entries(tables).forEach(([tableName, table]) => {
    const columnsWithForeignKeys = Object.entries(table).map(
      ([name, column]: [string, PgColumn]) => {
        const constraints: string[] = [];
        const foreignKeys: Array<{
          sourceColumn: string;
          targetTable: string;
          targetColumn: string;
        }> = [];

        if (column.primary) constraints.push('PK');
        if (!column.notNull) constraints.push('NULL');
        if (column.isUnique) constraints.push('UNIQUE');
        if (column.dataType === 'array') constraints.push('ARRAY');

        // Check for foreign keys
        // eslint-disable-next-line ts/no-unsafe-member-access
        const fks: ForeignKey[] =
          (table as any)[Symbol.for('drizzle:PgInlineForeignKeys')] ?? [];

        fks.forEach((fk: ForeignKey) => {
          const ref = fk.reference();
          // eslint-disable-next-line ts/no-unsafe-member-access
          const ftname = (ref.foreignTable as any)[Symbol.for('drizzle:Name')];

          if (
            ref.columns.map((col) => col.name).includes(name) &&
            ref.foreignColumns[0]
          ) {
            foreignKeys.push({
              sourceColumn: name,
              targetTable: ftname,
              targetColumn: ref.foreignColumns[0].name,
            });

            edges.push({
              id: `e${tableName}-${name}-${ftname}-${ref.foreignColumns[0].name}`,
              target: ftname,
              source: tableName,
              sourceHandle: `${tableName}-${name}-out`,
              targetHandle: `${ftname}-${ref.foreignColumns[0].name}-in`,
              animated: true,
              style: { stroke: '#666', strokeWidth: 1 },
            });

            constraints.push('FK');
          }
        });

        return {
          name,
          type:
            // eslint-disable-next-line ts/no-unsafe-member-access
            (column as any).baseColumn?.dataType ||
            column.dataType ||
            'unknown',
          constraints: constraints || [],
          foreignKeys,
        };
      },
    );

    nodes.push({
      id: tableName,
      type: 'tableNode',
      position: positions[tableName] || { x: 0, y: 0 },
      data: {
        label: tableName,
        columns: columnsWithForeignKeys,
      },
    });
  });

  return { nodes, edges };
};

const { nodes: initialNodes, edges: initialEdges } = generateSchemaFlow();

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  useEffect(() => {
    // eslint-disable-next-line ts/no-unsafe-member-access
    (window as any).nodes = nodes;
  }, [nodes]);

  return (
    <div style={{ width: '100vw', height: '100vh' }} className="bg-neutral-200">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          deleteKeyCode=""
          nodeTypes={nodeTypes}
          connectOnClick={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
          snapToGrid
          snapGrid={[20, 20]}
          fitView
          minZoom={0.1}
          maxZoom={10}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={12}
            size={1}
            style={{ opacity: 0.2 }}
            color="#444"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
