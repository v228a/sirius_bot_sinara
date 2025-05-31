import { useState, useCallback, DragEvent, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  getIncomers,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, styled, AppBar, Toolbar, IconButton } from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { ThemeToggle } from './components/ThemeToggle';
import { ChatBotNode } from './types';
import { nodeTypes } from './components/nodes';
import { getFileExtension, createZipFile } from './utils/files';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { ThemeProvider } from './theme/ThemeContext';
import ValidationAlert from './components/ValidationAlert';
import GraphControls from './components/GraphControls';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

const STORAGE_KEY = 'chatbot-flow-state';

const AppContainer = styled(Box)({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
});

const MainContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  width: '100%',
  height: '100%',
  background: theme.palette.background.default,
}));

const FlowContainer = styled(Box)({
  flex: 1,
  position: 'relative',
  display: 'flex',
  width: '100vw',
  height: 'calc(100vh - 64px)',
  minWidth: 0,
  minHeight: 0,
});

const ControlsBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  zIndex: 1000,
  background: 'transparent',
}));

const initialNodes: ChatBotNode[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 350, y: 50 },
    data: {
      label: '/start',
      type: 'start',
      content: '/start',
    },
    draggable: false,
  },
];

function normalizeNode(node: any): ChatBotNode {
  const allowedTypes = ['start', 'question', 'answer', 'checklist'] as const;
  const nodeType = allowedTypes.includes(node.type) ? node.type : 'question';
  return {
    ...node,
    type: nodeType,
    data: {
      ...node.data,
      type: allowedTypes.includes(node.data?.type) ? node.data.type : nodeType,
      label: node.data?.label || node.label || '',
    },
  };
}

const loadState = (): { nodes: ChatBotNode[]; edges: Edge[] } => {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      let savedNodes = parsedState.nodes as any[];
      const savedEdges = parsedState.edges as Edge[];
      const hasStartNode = savedNodes.some((node: any) => node.id === 'start');
      if (!hasStartNode) {
        savedNodes.push(initialNodes[0]);
      } else {
        savedNodes = savedNodes.map((node: any) => node.id === 'start' ? { ...node, draggable: false } : node);
      }
      savedNodes = savedNodes.map(normalizeNode);
      return { nodes: savedNodes as ChatBotNode[], edges: savedEdges };
    } catch (e) {
      console.error('Failed to parse saved state:', e);
    }
  }
  return { nodes: initialNodes as ChatBotNode[], edges: [] };
};

interface BotNode {
  id: string;
  text: string;
  answer?: string;
  attachments?: Array<{
    id: string;
    name: string;
  }>;
  checklist?: {
    title: string;
    items: string[];
  };
  children: BotNode[];
}

interface BotStructure {
  questions: BotNode[];
}

const Flow = ({ handleUndo, handleRedo, undoStack, redoStack, setUndoStack, setRedoStack, nodes, edges, setNodes, setEdges }: { handleUndo: () => void; handleRedo: () => void; undoStack: { nodes: ChatBotNode[]; edges: Edge[] }[]; redoStack: { nodes: ChatBotNode[]; edges: Edge[] }[]; setUndoStack: React.Dispatch<React.SetStateAction<{ nodes: ChatBotNode[]; edges: Edge[] }[]>>; setRedoStack: React.Dispatch<React.SetStateAction<{ nodes: ChatBotNode[]; edges: Edge[] }[]>>; nodes: ChatBotNode[]; edges: Edge[]; setNodes: React.Dispatch<React.SetStateAction<ChatBotNode[]>>; setEdges: React.Dispatch<React.SetStateAction<Edge[]>> }) => {
  const reactFlowInstance = useReactFlow();
  const muiTheme = useMuiTheme();
  const [hasErrors, setHasErrors] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const didFitView = useRef(false);

  const onNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Добавляем обработчик события удаления ноды
  useEffect(() => {
    const handleDeleteNode = (event: CustomEvent) => {
      const { id } = event.detail;
      onNodeDelete(id);
    };

    window.addEventListener('delete-node', handleDeleteNode as EventListener);

    return () => {
      window.removeEventListener('delete-node', handleDeleteNode as EventListener);
    };
  }, [onNodeDelete]);

  // Добавляем обработчик события ошибки файла
  useEffect(() => {
    const handleFileError = (event: CustomEvent) => {
      setFileError(event.detail);
    };

    window.addEventListener('file-error', handleFileError as EventListener);

    return () => {
      window.removeEventListener('file-error', handleFileError as EventListener);
    };
  }, []);

  // fitView при первой загрузке
  useEffect(() => {
    if (!didFitView.current && nodes.length > 0) {
      if (nodes.length === 1) {
        // Если только один узел — центрируем вручную
        reactFlowInstance.setViewport({ x: window.innerWidth / 2 - nodes[0].position.x, y: window.innerHeight / 2 - nodes[0].position.y, zoom: 1 });
      } else {
        reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
      }
      didFitView.current = true;
    }
  }, [nodes, reactFlowInstance]);

  // Сохраняем состояние при изменении nodes или edges
  useEffect(() => {
    try {
      const stateString = JSON.stringify({ nodes, edges });
      localStorage.setItem(STORAGE_KEY, stateString);
    } catch (e: unknown) {
      console.error('Failed to save state:', e);
      
      // Проверяем, является ли ошибка DOMException
      if (e instanceof DOMException) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          setStorageError('Не удалось сохранить состояние: слишком большой размер прикрепленных файлов');
        } else {
          setStorageError('Не удалось сохранить состояние: неизвестная ошибка');
        }
      } else {
        setStorageError('Не удалось сохранить состояние: неизвестная ошибка');
      }
    }
  }, [nodes, edges]);

  useEffect(() => {
    const handleNodeLabelChange = (event: CustomEvent) => {
      const { id, value } = event.detail.target;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: value };
          }
          return node;
        })
      );
    };

    window.addEventListener('node-label-change', handleNodeLabelChange as EventListener);

    return () => {
      window.removeEventListener('node-label-change', handleNodeLabelChange as EventListener);
    };
  }, [setNodes]);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const sourceType = sourceNode.data.type as string;
      const targetType = targetNode.data.type as string;

      // Запрещаем соединение ответа или чеклиста со стартовым узлом
      if (
        (sourceType === 'start' && (targetType === 'answer' || targetType === 'checklist')) ||
        (targetType === 'start' && (sourceType === 'answer' || sourceType === 'checklist'))
      ) {
        return false;
      }

      // Если одна из нод — answer или checklist, а другая — question
      // и у answer/checklist нет других входящих связей
      if (
        (sourceType === 'question' && (targetType === 'answer' || targetType === 'checklist')) ||
        (targetType === 'question' && (sourceType === 'answer' || sourceType === 'checklist'))
      ) {
        const answerOrChecklistNode =
          sourceType === 'answer' || sourceType === 'checklist' ? sourceNode : targetNode;
        const incomers = getIncomers(answerOrChecklistNode, nodes, edges);
        return incomers.length === 0;
      }

      // Старое поведение для остальных случаев
      if (targetType === 'answer' || targetType === 'checklist') {
        const incomers = getIncomers(targetNode, nodes, edges);
        return incomers.length === 0;
      }
      if (sourceType === 'question') {
        const outgoingConnections = edges.filter(edge => edge.source === sourceNode.id);
        const answerConnections = outgoingConnections.filter(edge =>
          nodes.find(n => n.id === edge.target)?.data.type === 'answer'
        );
        const checklistConnections = outgoingConnections.filter(edge =>
          nodes.find(n => n.id === edge.target)?.data.type === 'checklist'
        );
        if (targetType === 'answer' && answerConnections.length > 0) {
          return false;
        }
        if (targetType === 'checklist' && checklistConnections.length > 0) {
          return false;
        }
      }
      return true;
    },
    [nodes, edges]
  );

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  const onDragStart = (event: DragEvent, nodeType: 'question' | 'answer' | 'checklist') => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as 'question' | 'answer' | 'checklist';
      if (!type) return;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: ChatBotNode = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: type === 'question' ? 'Новый вопрос' : type === 'answer' ? 'Новый ответ' : 'Новый чек-лист',
          type,
          content: type === 'question' ? 'Новый вопрос' : type === 'answer' ? 'Новый ответ' : 'Новый чек-лист',
          checklistItems: type === 'checklist' ? [] : undefined,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleValidationChange = useCallback((errors: { severity: 'error' | 'warning' }[]) => {
    setHasErrors(errors.some(error => error.severity === 'error'));
  }, []); 

  // Сохраняем историю при изменениях
  useEffect(() => {
    setUndoStack((stack) => [...stack, { nodes, edges }]);
    setRedoStack([]);
  }, [nodes, edges, setUndoStack, setRedoStack]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      return updatedNodes.map(node => ({
        ...node,
        type: node.type as 'start' | 'question' | 'answer' | 'checklist',
      }));
    });
  }, [setNodes]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const handleExport = async () => {
    const startNode = nodes.find(node => node.data.type === 'start');
    if (!startNode) return;

    const files: { [key: string]: string } = {};
    
    // Собираем все файлы из нод
    nodes.forEach(node => {
      node.data.attachments?.forEach(attachment => {
        const extension = getFileExtension(attachment.name);
        const filename = `${attachment.id}.${extension}`;
        files[filename] = attachment.data;
      });
    });

    const botStructure: BotStructure = {
      questions: buildHierarchy(startNode.id)
    };

    const jsonString = JSON.stringify(botStructure, null, 2);
    const zipBlob = await createZipFile(jsonString, files);

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chatbot-flow.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildHierarchy = (startNodeId: string): BotNode[] => {
    const result: BotNode[] = [];
    
    // Находим все исходящие связи из текущего узла
    const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
    
    // Сначала собираем все вопросы
    const questionEdges = outgoingEdges.filter(edge => {
      const targetNode = nodes.find(node => node.id === edge.target);
      return targetNode?.data.type === 'question';
    });

    // Затем для каждого вопроса собираем его ответ, чеклист и дочерние вопросы
    for (const edge of questionEdges) {
      const questionNode = nodes.find(node => node.id === edge.target);
      if (questionNode) {
        // Находим ответ для текущего вопроса
        const answerNode = edges
          .filter(e => e.source === questionNode.id)
          .map(e => nodes.find(n => n.id === e.target))
          .find(n => n?.data.type === 'answer');

        // Находим чеклист для текущего вопроса (если есть)
        const checklistNode = edges
          .filter(e => e.source === questionNode.id)
          .map(e => nodes.find(n => n.id === e.target))
          .find(n => n?.data.type === 'checklist');

        const checklist = checklistNode ? {
          title: checklistNode.data.label,
          items: checklistNode.data.checklistItems?.map(item => item.text) || []
        } : undefined;

        const node: BotNode = {
          id: questionNode.id,
          text: questionNode.data.label,
          children: buildHierarchy(questionNode.id)
        };

        // Добавляем ответ только если он есть
        if (answerNode) {
          node.answer = answerNode.data.label;
        }

        // Добавляем чеклист только если он есть
        if (checklist && checklist.items.length > 0) {
          node.checklist = checklist;
        }

        // Добавляем вложения только если они есть
        if (questionNode.data.attachments && questionNode.data.attachments.length > 0) {
          node.attachments = questionNode.data.attachments.map(attachment => ({
            id: attachment.id,
            name: attachment.name
          }));
        }

        result.push(node);
      }
    }
    
    return result;
  };

  return (
    <>
      <ValidationAlert 
        nodes={nodes} 
        edges={edges} 
        onValidationChange={handleValidationChange}
      />
      <FlowContainer>
        <ReactFlow
          style={{ width: '100vw', height: 'calc(100vh - 64px)' }}
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          isValidConnection={isValidConnection}
        >
          <Background color={muiTheme.palette.background.default} />
          <Controls />
          <GraphControls 
            onDragStart={onDragStart} 
            onExport={handleExport} 
            hasErrors={hasErrors}
            nodes={nodes}
            edges={edges}
          />
        </ReactFlow>
      </FlowContainer>
      <Snackbar 
        open={!!storageError || !!fileError} 
        autoHideDuration={6000} 
        onClose={() => {
          setStorageError(null);
          setFileError(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ position: 'fixed', bottom: 16 }}
      >
        <Alert 
          onClose={() => {
            setStorageError(null);
            setFileError(null);
          }} 
          severity="error" 
          variant="filled"
        >
          {storageError || fileError}
        </Alert>
      </Snackbar>
    </>
  );
};

function App() {
  const [nodes, setNodes] = useState<ChatBotNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hasErrors, setHasErrors] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<{ nodes: ChatBotNode[]; edges: Edge[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: ChatBotNode[]; edges: Edge[] }[]>([]);

  // Загружаем начальное состояние при монтировании
  useEffect(() => {
    const { nodes: savedNodes, edges: savedEdges } = loadState();
    setNodes(savedNodes);
    setEdges(savedEdges);
  }, []);

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack([...redoStack, { nodes, edges }]);
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      setUndoStack(undoStack.slice(0, -1));
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      setUndoStack([...undoStack, { nodes, edges }]);
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setRedoStack(redoStack.slice(0, -1));
    }
  };

  const handleValidationChange = (hasErrors: boolean) => {
    setHasErrors(hasErrors);
  };

  const handleExport = async () => {
    const startNode = nodes.find(node => node.data.type === 'start');
    if (!startNode) return;

    const files: { [key: string]: string } = {};
    
    // Собираем все файлы из нод
    nodes.forEach(node => {
      node.data.attachments?.forEach(attachment => {
        const extension = getFileExtension(attachment.name);
        const filename = `${attachment.id}.${extension}`;
        files[filename] = attachment.data;
      });
    });

    const botStructure: BotStructure = {
      questions: buildHierarchy(startNode.id)
    };

    const jsonString = JSON.stringify(botStructure, null, 2);
    const zipBlob = await createZipFile(jsonString, files);

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chatbot-flow.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildHierarchy = (startNodeId: string): BotNode[] => {
    const result: BotNode[] = [];
    
    // Находим все исходящие связи из текущего узла
    const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
    
    // Сначала собираем все вопросы
    const questionEdges = outgoingEdges.filter(edge => {
      const targetNode = nodes.find(node => node.id === edge.target);
      return targetNode?.data.type === 'question';
    });

    // Затем для каждого вопроса собираем его ответ, чеклист и дочерние вопросы
    for (const edge of questionEdges) {
      const questionNode = nodes.find(node => node.id === edge.target);
      if (questionNode) {
        // Находим ответ для текущего вопроса
        const answerNode = edges
          .filter(e => e.source === questionNode.id)
          .map(e => nodes.find(n => n.id === e.target))
          .find(n => n?.data.type === 'answer');

        // Находим чеклист для текущего вопроса (если есть)
        const checklistNode = edges
          .filter(e => e.source === questionNode.id)
          .map(e => nodes.find(n => n.id === e.target))
          .find(n => n?.data.type === 'checklist');

        const checklist = checklistNode ? {
          title: checklistNode.data.label,
          items: checklistNode.data.checklistItems?.map(item => item.text) || []
        } : undefined;

        const node: BotNode = {
          id: questionNode.id,
          text: questionNode.data.label,
          children: buildHierarchy(questionNode.id)
        };

        // Добавляем ответ только если он есть
        if (answerNode) {
          node.answer = answerNode.data.label;
        }

        // Добавляем чеклист только если он есть
        if (checklist && checklist.items.length > 0) {
          node.checklist = checklist;
        }

        // Добавляем вложения только если они есть
        if (questionNode.data.attachments && questionNode.data.attachments.length > 0) {
          node.attachments = questionNode.data.attachments.map(attachment => ({
            id: attachment.id,
            name: attachment.name
          }));
        }

        result.push(node);
      }
    }
    
    return result;
  };

  return (
    <ThemeProvider>
      <AppContainer>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton onClick={handleUndo} disabled={undoStack.length === 0} sx={{ color: 'text.primary', backgroundColor: 'rgba(0, 0, 0, 0.04)', marginRight: 1 }}>
              <UndoIcon fontSize="medium" />
            </IconButton>
            <IconButton onClick={handleRedo} disabled={redoStack.length === 0} sx={{ color: 'text.primary', backgroundColor: 'rgba(0, 0, 0, 0.04)', marginRight: 1 }}>
              <RedoIcon fontSize="medium" />
            </IconButton>
            <ThemeToggle />
          </Toolbar>
        </AppBar>
        <MainContainer>
          <ReactFlowProvider>
            <Flow 
              handleUndo={handleUndo} 
              handleRedo={handleRedo} 
              undoStack={undoStack} 
              redoStack={redoStack} 
              setUndoStack={setUndoStack} 
              setRedoStack={setRedoStack} 
              nodes={nodes} 
              edges={edges} 
              setNodes={setNodes} 
              setEdges={setEdges} 
            />
          </ReactFlowProvider>
        </MainContainer>
      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
