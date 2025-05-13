import { memo } from 'react';
import { Position } from 'reactflow';
import { styled, TextField } from '@mui/material';
import { NodeCard, StyledHandle, StyledCardContent,StyledTextField } from '../NodeStyles';
import { NodeData } from '../../../types';

const AnswerNodeCard = styled(NodeCard)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.light,
  borderColor: theme.palette.secondary.main,
  '& .MuiInputBase-root': {
    backgroundColor: `${theme.palette.secondary.light} !important`,
  },
}));


interface AnswerNodeProps {
  data: NodeData;
  isConnectable: boolean;
  id: string;
}

const AnswerNode = ({ data, isConnectable, id }: AnswerNodeProps) => {
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


  return (
    <AnswerNodeCard>
      <StyledCardContent>
        <StyledTextField
          fullWidth
          multiline
          size="small"
          value={data.label}
          onChange={handleLabelChange}
          placeholder="Введите ответ"
        />
      </StyledCardContent>
      <StyledHandle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
    </AnswerNodeCard>
  );
};

export default memo(AnswerNode); 