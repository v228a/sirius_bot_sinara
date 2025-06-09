import { useState, useCallback, DragEvent, useEffect } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, styled, ThemeProvider, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

import ValidationAlert from './components/ValidationAlert';
import GraphControls from './components/GraphControls';
import { ChatBotNode } from './types';
import { theme } from './theme/theme';
import { nodeTypes } from './components/nodes';
import { getFileExtension, createZipFile } from './utils/files';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const STORAGE_KEY = 'chatbot-flow-state';

const AppContainer = styled(Box)({
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
});

const MainContainer = styled(Box)({
  flex: 1,
  display: 'flex',
});

const FlowContainer = styled(Box)({
  width: '100vw',
  height: '100vh',
});

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

// Функция для загрузки состояния из localStorage
const loadState = (): { nodes: ChatBotNode[]; edges: Edge[] } => {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      let savedNodes = parsedState.nodes as ChatBotNode[];
      const savedEdges = parsedState.edges as Edge[];
      
      // Убедимся, что стартовый узел всегда присутствует и не перемещаем
      const hasStartNode = savedNodes.some((node: ChatBotNode) => node.id === 'start');
      if (!hasStartNode) {
        savedNodes.push(initialNodes[0]);
      } else {
        savedNodes = savedNodes.map((node: ChatBotNode) => 
          node.id === 'start' ? { ...node, draggable: false } : node
        );
      }

      return { nodes: savedNodes, edges: savedEdges };
    } catch (e) {
      console.error('Failed to parse saved state:', e);
    }
  }
  return { nodes: initialNodes, edges: [] };
};

interface BotNode {
  id: string;
  text: string;
  answer?: string;
  attachments?: Array<{
    id: string;
    name: string;
  }>;
  children: BotNode[];
}

interface BotStructure {
  questions: BotNode[];
}

interface TemplateData {
  [key: string]: {
    [key: string]: string[] | {
      [key: string]: string[];
    };
  };
}

type CategoryContent = string[] | {
  [key: string]: string[];
};

const Flow = () => {
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(loadState().nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(loadState().edges);
  const [hasErrors, setHasErrors] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

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

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const targetNode = nodes.find((node) => node.id === connection.target);
      const sourceNode = nodes.find((node) => node.id === connection.source);
      if (!targetNode || !sourceNode) return false;

      const sourceType = sourceNode.data.type as string;
      const targetType = targetNode.data.type as string;

      // Запрещаем соединение ответа со стартовым узлом
      if (sourceType === 'start' && targetType === 'answer') {
        return false;
      }

      // Если целевой узел - ответ, проверяем количество входящих соединений
      if (targetType === 'answer') {
        const incomers = getIncomers(targetNode, nodes, edges);
        return incomers.length === 0; // Разрешаем соединение только если нет входящих связей
      }

      // Если исходный узел - вопрос, проверяем количество исходящих ответов
      if (sourceType === 'question') {
        // Получаем все исходящие соединения для данного вопроса
        const outgoingConnections = edges.filter(edge => edge.source === sourceNode.id);
        
        // Проверяем количество ответов
        const answerConnections = outgoingConnections.filter(edge => 
          nodes.find(n => n.id === edge.target)?.data.type === 'answer'
        );

        // Если пытаемся добавить ответ, но уже есть ответ
        if (targetType === 'answer' && answerConnections.length > 0) {
          return false;
        }
      }

      return true;
    },
    [nodes, edges]
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      if (isValidConnection(params as Connection)) {
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [setEdges, isValidConnection]
  );

  const onDragStart = (event: DragEvent, nodeType: 'question' | 'answer') => {
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

      const type = event.dataTransfer.getData('application/reactflow') as 'question' | 'answer';
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
          label: type === 'question' ? 'Новый вопрос' : 'Новый ответ',
          type,
          content: type === 'question' ? 'Новый вопрос' : 'Новый ответ',
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance]
  );

  const buildHierarchy = (startNodeId: string): BotNode[] => {
    const result: BotNode[] = [];
    
    // Находим все исходящие связи из текущего узла
    const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
    
    // Сначала собираем все вопросы
    const questionEdges = outgoingEdges.filter(edge => {
      const targetNode = nodes.find(node => node.id === edge.target);
      return targetNode?.data.type === 'question';
    });

    // Затем для каждого вопроса собираем его ответ и дочерние вопросы
    for (const edge of questionEdges) {
      const questionNode = nodes.find(node => node.id === edge.target);
      if (questionNode) {
        // Находим ответ для текущего вопроса
        const answerNode = edges
          .filter(e => e.source === questionNode.id)
          .map(e => nodes.find(n => n.id === e.target))
          .find(n => n?.data.type === 'answer');

        const node: BotNode = {
          id: questionNode.id,
          text: questionNode.data.label,
          attachments: questionNode.data.attachments?.map(attachment => ({
            id: attachment.id,
            name: attachment.name
          })),
          children: buildHierarchy(questionNode.id)
        };

        // Добавляем ответ только если он есть
        if (answerNode) {
          node.answer = answerNode.data.label;
          // Добавляем вложения из ответа, если они есть
          if (answerNode.data.attachments) {
            node.attachments = [
              ...(node.attachments || []),
              ...answerNode.data.attachments.map(attachment => ({
                id: attachment.id,
                name: attachment.name
              }))
            ];
          }
        }

        result.push(node);
      }
    }

    return result;
  };

  const validateBotToken = (token: string): boolean => {
    // Telegram bot token format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
    const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(token);
  };

  const handleTokenChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const token = event.target.value;
    setBotToken(token);
    if (token && !validateBotToken(token)) {
      setTokenError('Неверный формат токена. Токен должен быть в формате: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    } else {
      setTokenError(null);
    }
  };

  const handleExportClick = () => {
    setIsTokenDialogOpen(true);
  };

  const handleSortClick = () => {
    arrangeNodes();
  };

  const handleExportConfirm = async () => {
    if (!validateBotToken(botToken)) {
      setTokenError('Пожалуйста, введите корректный токен бота');
      return;
    }

    setIsTokenDialogOpen(false);
    await handleExport(botToken);
  };

  const handleExport = async (token: string) => {
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

    // Добавляем необходимые файлы для работы бота
    files['install.sh'] = `#!/bin/bash\n\n# Установка зависимостей\napt-get update\napt-get install -y docker.io\n\n# Сборка и запуск контейнера\ndocker build -t chatbot .\ndocker run -d --name chatbot chatbot\n\necho \"Бот успешно установлен и запущен!\"\n`;
    files['Dockerfile'] = `FROM python:3.9-slim\n\nWORKDIR /app\n\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\n\nCOPY . .\n\nCMD ["python", "bot.py"]\n`;
    files['requirements.txt'] = `aiogram==2.25.1`;
    files['bot.py'] = `import json
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, InputFile
from aiogram.utils import executor

JSON_FILE = "main.json"  # JSON-файл с вопросами

bot = Bot(token="${token}")
dp = Dispatcher(bot)
logging.basicConfig(level=logging.INFO)

# Загружаем JSON-данные
with open(JSON_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Храним путь пользователя в формате списка id
user_paths = {}

def get_node_by_path(path):
    """Находит узел по списку id."""
    node_list = data["questions"]
    node = None

    for node_id in path:
        node = next((item for item in node_list if item["id"] == node_id), None)
        if node and "children" in node:
            node_list = node["children"]
        else:
            break

    return node

def get_keyboard(node, is_root=False):
    """Создаёт клавиатуру с дочерними элементами и чеклистами."""
    keyboard = InlineKeyboardMarkup()

    if "children" in node:
        for child in node["children"]:
            keyboard.add(InlineKeyboardButton(text=child["text"], callback_data=child["id"]))

    if "checklist" in node:
        for item in node["checklist"]["items"]:
            keyboard.add(InlineKeyboardButton(text=f"✅ {item}", callback_data="CHECKLIST_ITEM"))

    if not is_root:
        keyboard.add(InlineKeyboardButton(text="⬅️ Назад", callback_data="BACK"))

    return keyboard if keyboard.inline_keyboard else None

async def send_attachments(user_id, attachments):
    """Отправляет все вложения из узла."""
    if not attachments:
        return
        
    for attachment in attachments:
        file_path = attachment["id"]  # Используем id как путь к файлу
        try:
            if attachment["name"].lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                # Отправляем изображение
                with open(file_path, 'rb') as photo:
                    await bot.send_photo(user_id, photo)
            else:
                # Отправляем файл
                with open(file_path, 'rb') as file:
                    await bot.send_document(user_id, InputFile(file))
        except Exception as e:
            logging.error(f"Ошибка при отправке файла {file_path}: {e}")
            await bot.send_message(user_id, f"Не удалось отправить файл: {attachment['name']}")

async def show_main_menu(user_id):
    """Показывает корневое меню."""
    user_paths[user_id] = []
    keyboard = get_keyboard({"children": data["questions"]}, is_root=True)
    await bot.send_message(user_id, "Выберите категорию:", reply_markup=keyboard)

@dp.message_handler(commands=["start"])
async def start_command(message: types.Message):
    """Запуск бота, вывод главного меню."""
    await show_main_menu(message.chat.id)

@dp.callback_query_handler(lambda c: True)
async def navigate(callback_query: types.CallbackQuery):
    """Обрабатывает нажатия на кнопки."""
    user_id = callback_query.message.chat.id
    path = user_paths.get(user_id, [])

    if callback_query.data == "BACK":
        if path:
            path.pop()  # Удаляем последний элемент (шаг назад)
    else:
        path.append(callback_query.data)  # Добавляем новый узел в путь

    user_paths[user_id] = path
    node = get_node_by_path(path)

    if node:
        keyboard = get_keyboard(node, is_root=(not path))

        if "answer" in node:
            # Удаляем старое сообщение с кнопками
            await bot.delete_message(user_id, callback_query.message.message_id)
            
            # Отправляем текст ответа
            await bot.send_message(user_id, node["answer"])
            
            # Отправляем вложения, если они есть
            if "attachments" in node:
                await send_attachments(user_id, node["attachments"])

            # Показываем корневое меню
            await show_main_menu(user_id)
        else:
            await bot.edit_message_text(
                text=node["text"], chat_id=user_id, message_id=callback_query.message.message_id, reply_markup=keyboard
            )
    else:
        # Если после нажатия "Назад" узел не найден, принудительно показываем корневое меню
        await show_main_menu(user_id)

if __name__ == "__main__":
    executor.start_polling(dp, skip_updates=True)`;//мама мия...
    files['bot_structure.json'] = JSON.stringify(botStructure, null, 2);

    const zipBlob = await createZipFile(JSON.stringify(botStructure, null, 2), files);

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chatbot.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleValidationChange = useCallback((errors: { severity: 'error' | 'warning' }[]) => {
    setHasErrors(errors.some(error => error.severity === 'error'));
  }, []);

  const arrangeNodes = useCallback(() => {
    const startNode = nodes.find(node => node.data.type === 'start');
    if (!startNode) return;

    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 100;
    const LEVEL_HEIGHT = 200;
    const ANSWER_OFFSET = 150;
    const ANSWER_VERTICAL_OFFSET = 150; // Вертикальное смещение для ответов

    const arrangeNode = (nodeId: string, level: number, index: number, parentX: number) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      // Calculate new position
      const x = parentX + (index * HORIZONTAL_SPACING);
      const y = level * LEVEL_HEIGHT;

      // Update node position
      setNodes(nds => 
        nds.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              position: { x, y }
            };
          }
          return n;
        })
      );

      // Get all outgoing edges
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      
      // First arrange answer nodes
      const answerEdges = outgoingEdges.filter(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode?.data.type === 'answer';
      });

      // Располагаем ответы с учетом их количества
      answerEdges.forEach((edge, idx) => {
        const answerNode = nodes.find(n => n.id === edge.target);
        if (answerNode) {
          // Вычисляем смещение для ответа в зависимости от его индекса
          const answerX = x + ANSWER_OFFSET;
          const answerY = y + ANSWER_VERTICAL_OFFSET + (idx * VERTICAL_SPACING);
          
          setNodes(nds =>
            nds.map(n => {
              if (n.id === answerNode.id) {
                return {
                  ...n,
                  position: { x: answerX, y: answerY }
                };
              }
              return n;
            })
          );
        }
      });

      // Then arrange question nodes
      const questionEdges = outgoingEdges.filter(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode?.data.type === 'question';
      });

      // Увеличиваем горизонтальное расстояние между вопросами, если есть ответы

      // Вычисляем смещение для следующего уровня вопросов
      const nextLevelOffset = answerEdges.length > 0 ? ANSWER_OFFSET : 0;

      questionEdges.forEach((edge, idx) => {
        arrangeNode(edge.target, level + 1, idx, x + nextLevelOffset);
      });
    };

    // Start arrangement from the start node
    arrangeNode(startNode.id, 0, 0, 0);

    // Fit view after arrangement
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
  }, [nodes, edges, setNodes, reactFlowInstance]);

  const loadTemplateQuestions = useCallback(async () => {
    try {
      const response = await fetch('/questions.json');
      const data = await response.json() as TemplateData;
      
      const newNodes: ChatBotNode[] = [];
      const newEdges: Edge[] = [];
      let nodeId = 1;
      
      // Функция для рекурсивного создания узлов
      const createNodesFromCategory = (
        category: CategoryContent,
        parentId: string | null = null,
        x: number = 0,
        y: number = 0
      ) => {
        if (Array.isArray(category)) {
          // Если это массив вопросов
          category.forEach((question, index) => {
            const questionNodeId = `question_${nodeId++}`;
            const answerNodeId = `answer_${nodeId++}`;
            
            // Создаем узел вопроса
            newNodes.push({
              id: questionNodeId,
              type: 'question',
              position: { x: x + index * 200, y: y },
              data: {
                label: question,
                type: 'question',
                content: question,
              },
            });
            
            // Создаем пустой узел ответа
            newNodes.push({
              id: answerNodeId,
              type: 'answer',
              position: { x: x + index * 200, y: y + 100 },
              data: {
                label: 'Новый ответ',
                type: 'answer',
                content: 'Новый ответ',
              },
            });
            
            // Создаем связь между вопросом и ответом
            newEdges.push({
              id: `edge_${questionNodeId}_${answerNodeId}`,
              source: questionNodeId,
              target: answerNodeId,
            });
            
            // Если есть родительский узел, создаем связь с ним
            if (parentId) {
              newEdges.push({
                id: `edge_${parentId}_${questionNodeId}`,
                source: parentId,
                target: questionNodeId,
              });
            }
          });
        } else if (typeof category === 'object') {
          // Если это объект с подкатегориями
          Object.entries(category).forEach(([subCategory, questions], index) => {
            const categoryNodeId = `question_${nodeId++}`;
            
            // Создаем узел категории
            newNodes.push({
              id: categoryNodeId,
              type: 'question',
              position: { x: x + index * 300, y: y },
              data: {
                label: subCategory,
                type: 'question',
                content: subCategory,
              },
            });
            
            // Если есть родительский узел, создаем связь с ним
            if (parentId) {
              newEdges.push({
                id: `edge_${parentId}_${categoryNodeId}`,
                source: parentId,
                target: categoryNodeId,
              });
            }
            
            // Рекурсивно создаем узлы для подкатегории
            createNodesFromCategory(questions, categoryNodeId, x + index * 300, y + 150);
          });
        }
      };
      
      // Начинаем с корневых категорий
      Object.entries(data).forEach(([content], index) => {
        createNodesFromCategory(content as unknown as CategoryContent, 'start', index * 300, 100);
      });
      
      // Добавляем новые узлы и связи
      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      
    } catch (error) {
      console.error('Failed to load template questions:', error);
      setFileError('Не удалось загрузить шаблонные вопросы');
    }
  }, [setNodes, setEdges]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <GraphControls
        onDragStart={onDragStart}
        onExport={handleExportClick}
        onSort={handleSortClick}
        onLoadTemplates={loadTemplateQuestions}
        hasErrors={hasErrors}
      />
      <ValidationAlert 
        nodes={nodes} 
        edges={edges} 
        onValidationChange={handleValidationChange}
      />
      <FlowContainer>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color='F6F6F6'/>
          <Controls />
        </ReactFlow>
      </FlowContainer>
      <Dialog open={isTokenDialogOpen} onClose={() => setIsTokenDialogOpen(false)}>
        <DialogTitle>Введите токен бота</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Токен бота"
            type="text"
            fullWidth
            variant="outlined"
            value={botToken}
            onChange={handleTokenChange}
            error={!!tokenError}
            helperText={tokenError || 'Формат: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsTokenDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleExportConfirm} disabled={!!tokenError || !botToken}>
            Экспорт
          </Button>
        </DialogActions>
      </Dialog>
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
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <AppContainer>
        <MainContainer>
          <ReactFlowProvider>
            <Flow />
          </ReactFlowProvider>
        </MainContainer>
      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
