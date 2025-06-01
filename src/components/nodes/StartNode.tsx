import { memo } from 'react';
import { Position } from 'reactflow';
import { styled, TextField } from '@mui/material';
import { NodeCard, StyledHandle, StyledCardContent } from './NodeStyles';
import { NodeData } from '../../types';

const StartNodeCard = styled(NodeCard)(({ theme }) => ({
  backgroundColor: '#FD8F47',
  borderColor: '#FD8F47',
  color: theme.palette.getContrastText('#FD8F47'),
  '& .MuiInputBase-root': {
    backgroundColor: `#FD8F47 !important`,
    color: `${theme.palette.getContrastText('#FD8F47')} !important`,
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

interface StartNodeProps {
  data: NodeData;
  isConnectable: boolean;
}

const StartNode = ({ data, isConnectable }: StartNodeProps) => {
  return (
    <StartNodeCard>
      <StyledCardContent>
        <StyledTextField
          fullWidth
          size="small"
          value={data.label}
          disabled
          multiline
        />
      </StyledCardContent>
      <StyledHandle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </StartNodeCard>
  );
};

export default memo(StartNode); 