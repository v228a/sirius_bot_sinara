import { memo } from 'react';
import { Position } from 'reactflow';
import { styled, TextField, IconButton, useTheme } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { NodeCard, StyledHandle, StyledCardContent } from './NodeStyles';
import { NodeData } from '../../types';
import AttachmentList from '../AttachmentList';
import { fileToBase64, generateFileHash, isFileSizeValid, formatFileSize, MAX_FILE_SIZE } from '../../utils/files';

const QuestionNodeCard = styled(NodeCard)(({ theme }) => ({
  backgroundColor: '#EBA577',
  borderColor: '#EBA577',
  '& .MuiInputBase-root': {
    backgroundColor: `#EBA577 !important`,
  },
}));

const StyledTextField = styled(TextField)({
  '& .MuiInputBase-root': {
    padding: '8px',
    '& fieldset': {
      border: 'none',
    },
    '&:hover fieldset': {
      border: 'none',
    },
    '&.Mui-focused fieldset': {
      border: 'none',
    },
  },
  '& .MuiInputBase-input': {
    padding: '0',
  },
});

interface QuestionNodeProps {
  data: NodeData;
  isConnectable: boolean;
  id: string;
}

const QuestionNode = ({ data, isConnectable, id }: QuestionNodeProps) => {
  const theme = useTheme();
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const evt = {
      target: {
        id,
        value: { 
          ...data, 
          label: value, 
          content: value,
        },
      },
    };
    window.dispatchEvent(new CustomEvent('node-label-change', { detail: evt }));
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('delete-node', { detail: { id } }));
  };

  const handleFileAttach = async (file: File) => {
    if (!isFileSizeValid(file)) {
      window.dispatchEvent(new CustomEvent('file-error', { 
        detail: `Файл слишком большой. Максимальный размер: ${formatFileSize(MAX_FILE_SIZE)}, размер файла: ${formatFileSize(file.size)}`
      }));
      return;
    }

    const hash = await generateFileHash(file);
    const base64 = await fileToBase64(file);

    const attachment = {
      id: hash,
      name: file.name,
      type: 'file' as const,
      data: base64,
    };

    const evt = {
      target: {
        id,
        value: {
          ...data,
          attachments: [...(data.attachments || []), attachment],
        },
      },
    };
    window.dispatchEvent(new CustomEvent('node-label-change', { detail: evt }));
  };

  const handleImageAttach = async (file: File) => {
    if (!isFileSizeValid(file)) {
      window.dispatchEvent(new CustomEvent('file-error', { 
        detail: `Изображение слишком большое. Максимальный размер: ${formatFileSize(MAX_FILE_SIZE)}, размер файла: ${formatFileSize(file.size)}`
      }));
      return;
    }

    const hash = await generateFileHash(file);
    const base64 = await fileToBase64(file);

    const attachment = {
      id: hash,
      name: file.name,
      type: 'image' as const,
      data: base64,
    };

    const evt = {
      target: {
        id,
        value: {
          ...data,
          attachments: [...(data.attachments || []), attachment],
        },
      },
    };
    window.dispatchEvent(new CustomEvent('node-label-change', { detail: evt }));
  };

  const handleAttachmentDelete = (attachmentId: string) => {
    const evt = {
      target: {
        id,
        value: {
          ...data,
          attachments: data.attachments?.filter(a => a.id !== attachmentId) || [],
        },
      },
    };
    window.dispatchEvent(new CustomEvent('node-label-change', { detail: evt }));
  };

  return (
    <QuestionNodeCard sx={{ position: 'relative' }}>
      <IconButton
        size="small"
        onClick={handleDelete}
        sx={{
          position: 'absolute',
          top: 2,
          right: 2,
          backgroundColor: '#EBA577',
          color: '#fff',
          opacity: 1,
          zIndex: 2,
          padding: '2px',
          '&:hover': {
            backgroundColor: '#EBA577',
            color: '#fff',
            opacity: 1,
          },
        }}
      >
        <DeleteIcon fontSize="small" sx={{ fontSize: 16 }} />
      </IconButton>
      <StyledCardContent>
        <StyledTextField
          fullWidth
          multiline
          size="small"
          value={data.label}
          onChange={handleLabelChange}
          placeholder="Введите вопрос"
        />
        <AttachmentList
          attachments={data.attachments}
          onFileAttach={handleFileAttach}
          onImageAttach={handleImageAttach}
          onAttachmentDelete={handleAttachmentDelete}
          nodeId={id}
        />
      </StyledCardContent>
      <StyledHandle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <StyledHandle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </QuestionNodeCard>
  );
};

export default memo(QuestionNode); 