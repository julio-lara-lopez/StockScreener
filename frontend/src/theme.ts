import { PaletteMode } from '@mui/material';
import { createTheme, ThemeOptions } from '@mui/material/styles';

const buildBaseOptions = (primaryColor: string): ThemeOptions => ({
  palette: {
    primary: {
      main: primaryColor
    },
    secondary: {
      main: '#f50057'
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff'
    }
  },
  shape: {
    borderRadius: 12
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  }
});

export const createAppTheme = (mode: PaletteMode = 'light', primaryColor = '#1976d2') => {
  const baseOptions = buildBaseOptions(primaryColor);
  return createTheme({
    ...baseOptions,
    palette: {
      ...baseOptions.palette,
      mode,
      background:
        mode === 'light'
          ? baseOptions.palette?.background
          : {
              default: '#0b1929',
              paper: '#132f4c'
            }
    }
  });
};

const theme = createAppTheme('light');

export default theme;
