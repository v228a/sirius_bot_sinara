import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import ChatIcon from '@mui/icons-material/Chat';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ChatBotNode } from '../types';

interface CustomNodeProps extends NodeProps<ChatBotNode> {
  onDelete?: (nodeId: string) => void;
}

const getNodeVisual = (type: string, theme: any) => {
  switch (type) {
    case 'question':
      return {
        icon: <QuestionMarkIcon sx={{ color: '#fff', fontSize: 20 }} />,
        circleColor: theme.palette.primary.main,
        borderColor: theme.palette.primary.main,
        label: 'Вопрос',
      };
    case 'answer':
      return {
        icon: <ChatIcon sx={{ color: '#fff', fontSize: 20 }} />,
        circleColor: theme.palette.secondary.main,
        borderColor: theme.palette.secondary.main,
        label: 'Ответ',
      };
    case 'start':
      return {
        icon: <PlayArrowIcon sx={{ color: '#fff', fontSize: 20 }} />,
        circleColor: '#757575',
        borderColor: '#757575',
        label: 'Старт',
      };
    default:
      return {
        icon: null,
        circleColor: theme.palette.divider,
        borderColor: theme.palette.divider,
        label: '',
      };
  }
};

const CustomNode = ({ data, selected, id, onDelete }: CustomNodeProps) => {
  const theme = useTheme();
  // Поддержка обеих структур: data.label/data.type или data.data.label/data.data.type
  const nodeType = (data as any).data?.type || (data as any).type;
  const label = (data as any).data?.label || (data as any).label;
  const visual = getNodeVisual(nodeType, theme);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        backgroundColor: theme.palette.background.paper,
        border: `2px solid ${selected ? visual.borderColor : theme.palette.divider}`,
        minWidth: 180,
        minHeight: 60,
        position: 'relative',
        boxShadow: selected ? 4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'box-shadow 0.2s, border 0.2s',
        '&:hover .delete-button': {
          opacity: 1,
        },
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* Цветной круг с иконкой */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: visual.circleColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 1,
        }}
      >
        {visual.icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" sx={{ wordBreak: 'break-word', fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {visual.label}
        </Typography>
      </Box>

      {/* Крестик только для question и answer */}
      {(nodeType === 'question' || nodeType === 'answer') && (
        <IconButton
          className="delete-button"
          size="small"
          onClick={handleDelete}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: theme.palette.error.main,
            color: theme.palette.error.contrastText,
            opacity: 0.7,
            transition: 'opacity 0.2s',
            zIndex: 2,
            '&:hover': {
              backgroundColor: theme.palette.error.dark,
              opacity: 1,
            },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
};

export default memo(CustomNode); 