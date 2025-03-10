import { 
  Box, 
  IconButton, 
  styled,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import { Attachment } from '../types';
import { useState } from 'react';

const StyledBadge = styled(Badge)({
  '& .MuiBadge-badge': {
    fontSize: '10px',
    height: '14px',
    minWidth: '14px',
    padding: '0 2px',
  },
});

const AttachmentContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
});

const StyledIconButton = styled(IconButton)({
  padding: 4,
  '& .MuiSvgIcon-root': {
    fontSize: 16,
  },
});

const MenuIconButton = styled(IconButton)({
  padding: 4,
  '& .MuiSvgIcon-root': {
    fontSize: 16,
  },
});

interface AttachmentListProps {
  attachments?: Attachment[];
  onFileAttach: (file: File) => void;
  onImageAttach: (file: File) => void;
  onAttachmentDelete: (attachmentId: string) => void;
}

const AttachmentList = ({ 
  attachments = [], 
  onFileAttach, 
  onImageAttach,
  onAttachmentDelete 
}: AttachmentListProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedType, setSelectedType] = useState<'file' | 'image' | null>(null);
  const open = Boolean(anchorEl);

  const fileAttachments = attachments.filter(a => a.type === 'file');
  const imageAttachments = attachments.filter(a => a.type === 'image');

  const handleClick = (event: React.MouseEvent<HTMLElement>, type: 'file' | 'image') => {
    setAnchorEl(event.currentTarget);
    setSelectedType(type);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedType(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === 'file') {
      onFileAttach(file);
    } else {
      onImageAttach(file);
    }
    
    event.target.value = '';
    handleClose();
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
  };

  const currentAttachments = selectedType === 'file' ? fileAttachments : imageAttachments;

  return (
    <AttachmentContainer>
      <input
        type="file"
        id="file-input"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'file')}
      />
      <StyledBadge 
        badgeContent={fileAttachments.length} 
        color="primary"
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <StyledIconButton 
          onClick={(e) => handleClick(e, 'file')}
          title="Файлы"
        >
          <AttachFileIcon sx={{ fontSize: 16 }} />
        </StyledIconButton>
      </StyledBadge>

      <input
        type="file"
        id="image-input"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'image')}
      />
      <StyledBadge 
        badgeContent={imageAttachments.length} 
        color="primary"
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <StyledIconButton 
          onClick={(e) => handleClick(e, 'image')}
          title="Изображения"
        >
          <ImageIcon sx={{ fontSize: 16 }} />
        </StyledIconButton>
      </StyledBadge>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={() => document.getElementById(selectedType === 'file' ? 'file-input' : 'image-input')?.click()}>
          <ListItemIcon>
            {selectedType === 'file' ? 
              <AttachFileIcon sx={{ fontSize: 16 }} /> : 
              <ImageIcon sx={{ fontSize: 16 }} />
            }
          </ListItemIcon>
          <ListItemText>
            Добавить {selectedType === 'file' ? 'файл' : 'изображение'}
          </ListItemText>
        </MenuItem>

        {currentAttachments.length > 0 && (
          <>
            <Divider />
            {currentAttachments.map((attachment) => (
              <MenuItem key={attachment.id}>
                <ListItemText>{attachment.name}</ListItemText>
                <MenuIconButton size="small" onClick={() => handleDownload(attachment)}>
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </MenuIconButton>
                <MenuIconButton size="small" onClick={() => onAttachmentDelete(attachment.id)}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </MenuIconButton>
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
    </AttachmentContainer>
  );
};

export default AttachmentList; 