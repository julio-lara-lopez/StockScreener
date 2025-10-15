import { useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import theme, { createAppTheme } from './theme';
import PositionForm, { PositionFormValues } from './components/PositionForm';
import PositionTable, { Position } from './components/PositionTable';

function App(): JSX.Element {
  const [positions, setPositions] = useState<Position[]>([]);
  const [useDarkMode, setUseDarkMode] = useState(false);

  const activeTheme = useMemo(() => (useDarkMode ? createAppTheme('dark') : theme), [useDarkMode]);

  const handleAddPosition = (values: PositionFormValues) => {
    const nextPosition: Position = {
      id: crypto.randomUUID(),
      ...values
    };
    setPositions((prev) => [nextPosition, ...prev]);
  };

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <AppBar elevation={0} position="sticky" color="transparent">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600} color="primary">
            Portfolio Positions
          </Typography>
          <Tooltip title={`Switch to ${useDarkMode ? 'light' : 'dark'} mode`}>
            <IconButton color="primary" onClick={() => setUseDarkMode((prev) => !prev)}>
              {useDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box sx={{ py: { xs: 4, md: 6 }, background: (t) => t.palette.background.default, minHeight: '100vh' }}>
        <Container maxWidth="lg">
          <Stack spacing={4}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Add a position
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Record each stock position with entry details to stay on top of your exposure.
              </Typography>
              <PositionForm onSubmit={handleAddPosition} />
            </Paper>
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 2, px: { xs: 1, md: 0 } }}>
                <Box>
                  <Typography variant="h5" fontWeight={600}>
                    Positions overview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {positions.length === 0
                      ? 'No positions added yet. Use the form above to create your first entry.'
                      : 'Track current exposure, cost basis, and targets at a glance.'}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <PositionTable positions={positions} />
            </Paper>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
