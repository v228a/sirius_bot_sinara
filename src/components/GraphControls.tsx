import { Box, Card, CardContent, Typography, styled, IconButton } from '@mui/material';
import { useReactFlow } from 'reactflow';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const StyledTypography = styled(Typography)({
  fontSize: '11px',
  color: 'rgba(0, 0, 0, 0.6)',
});

const GraphControls = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Card sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1200 }}>
      <CardContent sx={{ p: 1, display: 'flex', gap: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => zoomIn()}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
          <StyledTypography>Приблизить</StyledTypography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => zoomOut()}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <StyledTypography>Отдалить</StyledTypography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => fitView()}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
          <StyledTypography>По центру</StyledTypography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GraphControls; 