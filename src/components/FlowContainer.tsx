import { Box, useTheme } from '@mui/material';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  SelectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ChatBotNode } from '../types';
import CustomNode from './CustomNode';
import { useCallback } from 'react';

// Оборачиваем CustomNode для передачи onDelete
const CustomNodeWithDelete = (props: any) => <CustomNode {...props} onDelete={props.onNodeDelete} />;

const nodeTypes: NodeTypes = {
  custom: CustomNodeWithDelete,
};

interface FlowContainerProps {
  nodes: Node<ChatBotNode>[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  onNodeDelete?: (nodeId: string) => void;
}

const FlowContainer = ({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  onNodeDelete 
}: FlowContainerProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        selectionMode={SelectionMode.Full}
        fitView
        attributionPosition="bottom-left"
        // Передаём onNodeDelete как prop для кастомных нод
        onNodeDelete={onNodeDelete}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </Box>
  );
};

export default FlowContainer; 