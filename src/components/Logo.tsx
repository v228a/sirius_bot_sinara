import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

const Logo = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="img"
      src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Logo"
      sx={{
        height: 40,
        marginRight: 2,
      }}
    />
  );
};

export default Logo; 