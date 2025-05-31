import { Box, Card, CardContent, Typography, styled, useTheme, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import ChatIcon from '@mui/icons-material/Chat';
import ChecklistIcon from '@mui/icons-material/CheckBox';
import HandymanIcon from '@mui/icons-material/Handyman';
import SaveIcon from '@mui/icons-material/Save';
import CodeIcon from '@mui/icons-material/Code';
import { useState } from 'react';
import { ModalTelegramExport } from './ModalTelegramExport';
import { ChatBotNode, Edge } from '../types';
// import { useReactFlow } from 'reactflow';

const ControlsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  zIndex: 1000,
  background: 'transparent',
}));

const NodeCard = styled(Card)(({ theme }) => ({
  minWidth: 80,
  maxWidth: 120,
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const CardInner = styled(CardContent)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '8px !important',
  '&:last-child': {
    paddingBottom: '8px !important',
  },
});

interface IconWrapperProps {
  color: string;
}

const IconWrapper = styled(Box)<IconWrapperProps>(({ theme, color }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.common.white,
  '& svg': {
    fontSize: '1.2rem',
  },
}));

const StyledTypography = styled(Typography)({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  width: '100%',
  textAlign: 'center',
  fontSize: '0.7rem',
  lineHeight: 1.2,
});

interface GraphControlsProps {
  onDragStart: (event: React.DragEvent, nodeType: 'question' | 'answer') => void;
  onExport: () => void;
  hasErrors: boolean;
  nodes: ChatBotNode[];
  edges: Edge[];
}

function generateTelegramBotCode(nodes: ChatBotNode[], edges: Edge[]): string {
  // Находим стартовый узел
  const startNode = nodes.find(n => n.data.type === 'start');
  if (!startNode) return '# Ошибка: нет стартового узла';

  // Собираем все вопросы и ответы
  const questions = nodes.filter(n => n.data.type === 'question');
  const answers = nodes.filter(n => n.data.type === 'answer');

  // Строим карту переходов: sourceId -> targetId[]
  const edgeMap: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!edgeMap[e.source]) edgeMap[e.source] = [];
    edgeMap[e.source].push(e.target);
  });

  // Для быстрого поиска ноды по id
  const nodeById: Record<string, ChatBotNode> = {};
  nodes.forEach(n => { nodeById[n.id] = n; });

  // Генерируем хендлеры для вопросов
  let handlers = '';
  
  // Создаем клавиатуру со всеми вопросами
  const questionButtons = questions.map(q => `[KeyboardButton(text='${q.data.label.replace(/'/g, "\'")}')]`).join(',\n        ');
  
  // Handler для старта и возврата к списку вопросов
  handlers += `\n@router.message(Command("start"))\n`;
  handlers += `async def show_questions(message: Message):\n`;
  handlers += `    keyboard = [\n        ${questionButtons}\n    ]\n`;
  handlers += `    markup = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)\n`;
  handlers += `    await message.answer('Выберите интересующий вас вопрос:', reply_markup=markup)\n\n`;

  // Для каждого вопроса создаем handler
  for (const q of questions) {
    const nextIds = edgeMap[q.id] || [];
    // Ответы для этого вопроса
    const answerNodes = nextIds.map(id => nodeById[id]).filter(n => n && n.data.type === 'answer');
    
    handlers += `@router.message(lambda message: message.text == '${q.data.label.replace(/'/g, "\'")}')\n`;
    handlers += `async def answer_${q.id}(message: Message):\n`;
    
    if (answerNodes.length > 0) {
      // Если есть ответы, показываем их
      const answerText = answerNodes.map(a => a.data.label).join('\n');
      handlers += `    await message.answer('${answerText.replace(/'/g, "\'")}')\n`;
    } else {
      handlers += `    await message.answer('К сожалению, ответ на этот вопрос пока не готов.')\n`;
    }
    
    // Добавляем кнопку возврата к списку вопросов
    handlers += `    keyboard = [\n        ${questionButtons}\n    ]\n`;
    handlers += `    markup = ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)\n`;
    handlers += `    await message.answer('Выберите другой вопрос:', reply_markup=markup)\n\n`;
  }

  // Генерируем основной код
  return `import asyncio
import logging
from aiogram import Bot, Dispatcher, Router
from aiogram.filters import Command
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.exceptions import TelegramBadRequest

# Включаем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Замените на свой токен
API_TOKEN = 'YOUR_TOKEN_HERE'

# Инициализируем бота и диспетчер
bot = Bot(token=API_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

${handlers}

async def main():
    try:
        # Запускаем бота
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Error occurred: {e}")
    finally:
        await bot.session.close()

if __name__ == '__main__':
    asyncio.run(main())
`;
}

const GraphControls = ({ onDragStart, onExport, hasErrors, nodes, edges }: GraphControlsProps) => {
  // const reactFlowInstance = useReactFlow();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tgCode, setTgCode] = useState('');

  const handleDragStart = (event: React.DragEvent, nodeType: 'question' | 'answer') => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';

    // Создаем превью для перетаскивания
    const preview = document.createElement('div');
    preview.className = 'dnd-preview';
    preview.style.position = 'absolute';
    preview.style.left = '-1000px';
    document.body.appendChild(preview);
    event.dataTransfer.setDragImage(preview, 0, 0);

    onDragStart(event, nodeType);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleMenuClose = () => {
    setMenuOpen(false);
  };

  const handleExportTelegram = () => {
    const code = generateTelegramBotCode(nodes, edges);
    setTgCode(code);
    setModalOpen(true);
    handleMenuClose();
  };

  return (
    <>
      <ControlsContainer>
        <NodeCard
          draggable
          onDragStart={(event) => handleDragStart(event, 'question')}
        >
          <CardInner>
            <IconWrapper color={theme.palette.primary.main}>
              <QuestionMarkIcon />
            </IconWrapper>
            <StyledTypography variant="body2" color="text.secondary">
              Добавить вопрос
            </StyledTypography>
          </CardInner>
        </NodeCard>

        <NodeCard
          draggable
          onDragStart={(event) => handleDragStart(event, 'answer')}
        >
          <CardInner>
            <IconWrapper color={theme.palette.secondary.main}>
              <ChatIcon />
            </IconWrapper>
            <StyledTypography variant="body2" color="text.secondary">
              Добавить ответ
            </StyledTypography>
          </CardInner>
        </NodeCard>

        <NodeCard
          draggable
          aria-controls={menuOpen ? 'basic-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? 'true' : undefined}
          onMouseEnter={handleMenuOpen}
        >
          <CardInner>
            <IconWrapper color="#757575">
              <SaveIcon />
            </IconWrapper>
            <StyledTypography variant="body2" color="text.secondary">
              Экспортировать
            </StyledTypography>
          </CardInner>
        </NodeCard>
        
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          MenuListProps={{ onMouseLeave: handleMenuClose }}
          sx={{ pointerEvents: 'none', '& .MuiPaper-root': { pointerEvents: 'auto' } }}
        >
          <MenuItem onClick={() => { onExport(); handleMenuClose(); }} disabled={hasErrors}>
            <ListItemIcon>
              <SaveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Экспортировать как JSON</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportTelegram} disabled={hasErrors}>
            <ListItemIcon>
              <CodeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Экспортировать как Telegram-бот (Python, aiogram)</ListItemText>
          </MenuItem>
        </Menu>
      </ControlsContainer>
      <ModalTelegramExport open={modalOpen} onClose={() => setModalOpen(false)} code={tgCode} />
    </>
  );
};

export default GraphControls;