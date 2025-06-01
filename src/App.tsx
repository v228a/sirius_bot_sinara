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
  SelectionMode,
  BackgroundVariant,
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
import { buildHierarchy } from './utils/buildHierarchy';
import Logo from './components/Logo';

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
  token: string;
}

const Flow = ({ handleUndo, handleRedo, undoStack, redoStack, setUndoStack, setRedoStack, nodes, edges, setNodes, setEdges }: { handleUndo: () => void; handleRedo: () => void; undoStack: { nodes: ChatBotNode[]; edges: Edge[] }[]; redoStack: { nodes: ChatBotNode[]; edges: Edge[] }[]; setUndoStack: React.Dispatch<React.SetStateAction<{ nodes: ChatBotNode[]; edges: Edge[] }[]>>; setRedoStack: React.Dispatch<React.SetStateAction<{ nodes: ChatBotNode[]; edges: Edge[] }[]>>; nodes: ChatBotNode[]; edges: Edge[]; setNodes: React.Dispatch<React.SetStateAction<ChatBotNode[]>>; setEdges: React.Dispatch<React.SetStateAction<Edge[]>> }) => {
  const reactFlowInstance = useReactFlow();
  const muiTheme = useMuiTheme();
  const [hasErrors, setHasErrors] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const didFitView = useRef(false);
  const [copiedNodes, setCopiedNodes] = useState<ChatBotNode[]>([]);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

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

  const exportZip = async (nodes: ChatBotNode[], edges: Edge[]) => {
    const startNode = nodes.find(node => node.data.type === 'start');
    if (!startNode) return;
    const botStructure = {
      questions: buildHierarchy(startNode.id, nodes, edges)
    };
    // Файлы для архива
    const installScript = `#!/bin/bash\n\n# Установка зависимостей\napt-get update\napt-get install -y docker.io\n\n# Сборка и запуск контейнера\ndocker build -t chatbot .\ndocker run -d --name chatbot chatbot\n\necho \"Бот успешно установлен и запущен!\"\n`;
    const dockerfile = `FROM python:3.9-slim\n\nWORKDIR /app\n\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\n\nCOPY . .\n\nCMD [\"python\", \"bot.py\"]\n`;
    const requirements = `python-telegram-bot==13.7\npython-dotenv==0.19.0\n`;
    const botPy = `import os\nimport json\nfrom telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup\nfrom telegram.ext import Updater, CommandHandler, CallbackQueryHandler, CallbackContext\n\nwith open('bot_structure.json', 'r', encoding='utf-8') as f:\n    bot_structure = json.load(f)\n\ndef start(update: Update, context: CallbackContext) -> None:\n    user_id = update.effective_user.id\n    context.user_data['current_question'] = 0\n    show_question(update, context)\n\ndef show_question(update: Update, context: CallbackContext) -> None:\n    user_id = update.effective_user.id\n    current_question = context.user_data.get('current_question', 0)\n    if current_question >= len(bot_structure['questions']):\n        update.message.reply_text(\"Спасибо за прохождение опроса!\")\n        return\n    question = bot_structure['questions'][current_question]\n    keyboard = []\n    for i, child in enumerate(question['children']):\n        keyboard.append([InlineKeyboardButton(child['text'], callback_data=str(i))])\n    reply_markup = InlineKeyboardMarkup(keyboard)\n    message = question['text']\n    if question.get('answer'):\n        message += f"\\n\\n{question['answer']}"\n    if question.get('checklist'):\n        message += f"\\n\\n{question['checklist']['title']}:"\n        for item in question['checklist']['items']:\n            message += f"\\n- {item}"\n    update.message.reply_text(message, reply_markup=reply_markup)\n\ndef button_callback(update: Update, context: CallbackContext) -> None:\n    query = update.callback_query\n    query.answer()\n    user_id = update.effective_user.id\n    current_question = context.user_data.get('current_question', 0)\n    selected_option = int(query.data)\n    context.user_data['current_question'] = current_question + 1\n    show_question(update, context)\n\ndef main() -> None:\n    updater = Updater(os.getenv('BOT_TOKEN'))\n    dispatcher = updater.dispatcher\n    dispatcher.add_handler(CommandHandler(\"start\", start))\n    dispatcher.add_handler(CallbackQueryHandler(button_callback))\n    updater.start_polling()\n    updater.idle()\n\nif __name__ == '__main__':\n    main()\n`;
    const files = {
      'install.sh': installScript,
      'Dockerfile': dockerfile,
      'requirements.txt': requirements,
      'bot.py': botPy,
      'bot_structure.json': JSON.stringify(botStructure, null, 2),
    };
    const zipBlob = await createZipFile(JSON.stringify(botStructure, null, 2), files);
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chatbot-bot.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyC') {
        // Копировать все выделенные ноды
        const selectedNodes = nodes.filter((n: any) => n.selected);
        if (selectedNodes.length > 0) {
          setCopiedNodes(selectedNodes);
        }
      }
      if (e.ctrlKey && e.code === 'KeyV') {
        // Вставить все скопированные ноды
        if (copiedNodes.length > 0) {
          const now = Date.now();
          const newNodes = copiedNodes.map((node, idx) => ({
            ...node,
            id: `${node.type}_${now}_${idx}`,
            position: {
              x: node.position.x + 40,
              y: node.position.y + 40,
            },
            selected: true,
          }));
          setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, copiedNodes, setNodes]);

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
          selectionMode={SelectionMode.Partial}
          selectNodesOnDrag={true}
          panOnDrag={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#999" />
          <Controls />
          <GraphControls 
            onDragStart={onDragStart} 
            onExport={() => exportZip(nodes, edges)} 
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

  return (
    <ThemeProvider>
      <AppContainer>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Logo />
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
