import { PaletteMode } from '@mui/material';
import { createTheme, ThemeOptions } from '@mui/material/styles';

const baseOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#1976d2'
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
};

export const createAppTheme = (mode: PaletteMode = 'light') =>
  createTheme({
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

const theme = createAppTheme('light');

export default theme;
