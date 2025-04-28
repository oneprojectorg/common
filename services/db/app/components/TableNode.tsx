import { Handle, Position, useHandleConnections } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import FaFingerprint from '~icons/fa6-solid/fingerprint.jsx';
import FaTable from '~icons/fa6-solid/table.jsx';
import IoKey from '~icons/fluent/key-16-filled.jsx';
import IoCalendarNumberOutline from '~icons/ion/calendar-number-outline.jsx';
import IoIosLink from '~icons/ion/link.jsx';
import IoIosList from '~icons/ion/list.jsx';
import PiTextT from '~icons/ph/text-aa-bold.jsx';
import RxComponentBoolean from '~icons/radix-icons/component-boolean.jsx';
import VscJson from '~icons/si/json-alt-2-fill.jsx';
import MdNumbers from '~icons/stash/data-numbers-duotone.jsx';
import TbNorthStar from '~icons/tabler/north-star.jsx';

interface ColumnData {
  name: string;
  type: string;
  constraints: string[];
  foreignKeys: Array<{
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }>;
}

type TableNodeData = Node<{
  label: string;
  columns: ColumnData[];
}>;

const getColumnTypeIcon = (type: string) => {
  switch (type) {
    case 'string':
      return <PiTextT className="cursor-help" />;

    case 'jsonb':
      return <VscJson className="cursor-help" />;

    case 'json':
      return <VscJson className="cursor-help" />;

    case 'number':
      return <MdNumbers className="cursor-help" />;

    case 'boolean':
      return <RxComponentBoolean className="cursor-help" />;

    case 'date':
      return <IoCalendarNumberOutline className="cursor-help" />;

    default:
      return null;
  }
};

const getConstraintIcon = (constraint: string) => {
  switch (constraint) {
    case 'PK':
      return <IoKey className="cursor-help" />;

    case 'FK':
      return <IoIosLink className="cursor-help" />;

    case 'UNIQUE':
      return <FaFingerprint className="cursor-help" />;

    case 'ARRAY':
      return <IoIosList className="cursor-help" />;

    default:
      return null;
  }
};

const TableColumn = ({
  col,
  tableName,
}: {
  col: ColumnData;
  tableName: string;
}) => {
  const connectionsOut = useHandleConnections({
    type: 'source',
    id: `${tableName}-${col.name}-out`,
    nodeId: tableName,
  });

  const connectionsIn = useHandleConnections({
    type: 'target',
    id: `${tableName}-${col.name}-in`,
    nodeId: tableName,
  });

  return (
    <div className="relative flex items-center gap-2 px-4">
      <Handle
        key={`${tableName}-${col.name}`}
        type="target"
        position={Position.Right}
        id={`${tableName}-${col.name}-in`}
        className={`!-right-0.5 size-4 rounded-full border-4 border-neutral-300 !bg-neutral-500 opacity-0 ${
          connectionsIn.length > 0 ? 'opacity-100' : ''
        }`}
      />

      <span className="flex flex-1 items-center gap-2">
        {getColumnTypeIcon(col.type)}
        <span className="flex items-center gap-2">
          {col.name}
          <span className="text-neutral-500">{col.type}</span>
        </span>
      </span>
      <span className="flex items-center gap-1 text-neutral-900">
        {col.constraints.map((c) => (
          <span key={c}>{getConstraintIcon(c)}</span>
        ))}
        {col.constraints.includes('NULL') ? null : (
          <TbNorthStar className="cursor-help" />
        )}
      </span>

      <Handle
        type="source"
        position={Position.Left}
        id={`${tableName}-${col.name}-out`}
        className={`!-left-0.5 size-4 rounded-full border-4 border-neutral-300 !bg-neutral-500 opacity-0 ${
          connectionsOut.length > 0 ? 'opacity-100' : ''
        }`}
      />
    </div>
  );
};

export function TableNode({ data }: NodeProps<TableNodeData>) {
  return (
    <div
      className="min-w-[250px] rounded-lg border-4 border-neutral-300 bg-neutral-300 text-neutral-900 shadow-lg"
      style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.2))' }}
    >
      <div className="flex items-center gap-2 px-4 py-2 font-bold">
        <FaTable className="size-4 text-neutral-500" />
        {data.label}
      </div>
      <div className="space-y-1 rounded-lg bg-gradient-to-br from-neutral-50 to-neutral-50 py-3 text-sm">
        {data.columns
          .filter((col) => col.type !== 'unknown')
          .map((col) => (
            <TableColumn key={col.name} col={col} tableName={data.label} />
          ))}
      </div>
    </div>
  );
}
