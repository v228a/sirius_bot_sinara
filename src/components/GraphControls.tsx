import { Box, Card, CardContent, Typography, styled, useTheme, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import ChatIcon from '@mui/icons-material/Chat';
import ChecklistIcon from '@mui/icons-material/CheckBox';
import HandymanIcon from '@mui/icons-material/Handyman';

import SaveIcon from '@mui/icons-material/Save';
import { useState } from 'react';
// import { useReactFlow } from 'reactflow';

const ControlsContainer = styled(Box)({
  position: 'absolute',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  zIndex: 1000,
});

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
  onDragStart: (event: React.DragEvent, nodeType: 'question' | 'answer' | 'checklist') => void;
  onExport: () => void;
  hasErrors: boolean;
}

const GraphControls = ({ onDragStart, onExport, hasErrors }: GraphControlsProps) => {
  // const reactFlowInstance = useReactFlow();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDragStart = (event: React.DragEvent, nodeType: 'question' | 'answer' | 'checklist') => {
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

  return (
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
        onDragStart={(event) => handleDragStart(event, 'checklist')}
      >
        <CardInner>
          <IconWrapper color="#6002ee">
            <ChecklistIcon />
          </IconWrapper>
          <StyledTypography variant="body2" color="text.secondary">
            Добавить чек-лист
          </StyledTypography>
        </CardInner>
      </NodeCard>

      <NodeCard
        draggable
        aria-controls={menuOpen ? 'basic-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onMouseEnter={handleMenuOpen}
        // onClick={}
      >
        <CardInner>
          <IconWrapper color="#757575">
            <HandymanIcon/>
          </IconWrapper>
          <StyledTypography variant="body2" color="text.secondary">
            Инструменты
          </StyledTypography>
        </CardInner>
      </NodeCard>
      
      

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        MenuListProps={{
          onMouseLeave: handleMenuClose,
        }}
        sx={{
          pointerEvents: 'none',
          '& .MuiPaper-root': {
            pointerEvents: 'auto',
          },
        }}
      >
        <MenuItem onClick={onExport} disabled={hasErrors}>
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Эспортировать</ListItemText>
        </MenuItem>
        {/* <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <SortIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Сортировать</ListItemText>
        </MenuItem> */}
      </Menu>
    </ControlsContainer>
  );
};

export default GraphControls;