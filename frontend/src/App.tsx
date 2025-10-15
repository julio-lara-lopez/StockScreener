import { useCallback, useEffect, useMemo, useState } from 'react';
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
import Alert from '@mui/material/Alert';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import theme, { createAppTheme } from './theme';
import PositionForm, { PositionFormValues } from './components/PositionForm';
import PositionTable, { Position } from './components/PositionTable';
import EditPositionDialog from './components/EditPositionDialog';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiPosition = {
  id: number;
  created_at: string;
  ticker: string;
  side: 'long' | 'short';
  qty: number;
  entry_price: number;
  notes?: string | null;
};

const mapPosition = (position: ApiPosition): Position => ({
  id: position.id,
  ticker: position.ticker,
  side: position.side,
  qty: Number(position.qty),
  entryPrice: Number(position.entry_price),
  createdAt: position.created_at,
  notes: position.notes ?? ''
});

function App(): JSX.Element {
  const [positions, setPositions] = useState<Position[]>([]);
  const [useDarkMode, setUseDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);

  const activeTheme = useMemo(() => (useDarkMode ? createAppTheme('dark') : theme), [useDarkMode]);

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/positions`);
      if (!response.ok) {
        throw new Error('Failed to load positions from the server.');
      }
      const data: ApiPosition[] = await response.json();
      setPositions(data.map(mapPosition));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while loading positions.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPositions();
  }, [fetchPositions]);

  const handleAddPosition = useCallback(
    async (values: PositionFormValues) => {
      setError(null);
      setIsSubmitting(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/positions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticker: values.ticker,
            side: values.side,
            qty: values.qty,
            entry_price: values.entryPrice,
            notes: values.notes?.trim() ? values.notes.trim() : null
          })
        });

        if (!response.ok) {
          let message = 'Unable to save the position.';
          try {
            const body = await response.json();
            if (body?.detail) {
              message = typeof body.detail === 'string' ? body.detail : message;
            }
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message);
        }

        const payload: ApiPosition = await response.json();
        setPositions((prev) => [mapPosition(payload), ...prev]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error while saving the position.';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleEditPosition = useCallback((position: Position) => {
    setError(null);
    setEditingPosition(position);
  }, []);

  const handleUpdatePosition = useCallback(
    async (id: number, values: PositionFormValues) => {
      setError(null);
      setIsUpdating(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/positions/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticker: values.ticker,
            side: values.side,
            qty: values.qty,
            entry_price: values.entryPrice,
            notes: values.notes?.trim() ? values.notes.trim() : null
          })
        });

        if (!response.ok) {
          let message = 'Unable to update the position.';
          try {
            const body = await response.json();
            if (body?.detail) {
              message = typeof body.detail === 'string' ? body.detail : message;
            }
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message);
        }

        const payload: ApiPosition = await response.json();
        setPositions((prev) => prev.map((position) => (position.id === id ? mapPosition(payload) : position)));
        setEditingPosition(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unexpected error while updating the position.';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

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
              {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              <PositionForm onSubmit={handleAddPosition} isSubmitting={isSubmitting} />
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
              <PositionTable positions={positions} loading={isLoading} onEdit={handleEditPosition} />
            </Paper>
          </Stack>
        </Container>
      </Box>
      <EditPositionDialog
        open={Boolean(editingPosition)}
        position={editingPosition}
        onClose={() => setEditingPosition(null)}
        onSubmit={async (values) => {
          if (!editingPosition) {
            return;
          }
          await handleUpdatePosition(editingPosition.id, values);
        }}
        isSubmitting={isUpdating}
      />
    </ThemeProvider>
  );
}

export default App;
