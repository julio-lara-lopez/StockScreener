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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import theme, { createAppTheme } from './theme';
import PositionForm, { PositionFormValues } from './components/PositionForm';
import PositionTable, { Position } from './components/PositionTable';
import PositionTargetsTable from './components/PositionTargetsTable';
import EditPositionDialog from './components/EditPositionDialog';
import PortfolioSummaryCard, {
  PortfolioSummary,
  PortfolioSummaryPoint
} from './components/PortfolioSummaryCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiPosition = {
  id: number;
  created_at: string;
  ticker: string;
  side: 'long' | 'short';
  qty: number;
  entry_price: number;
  current_price: number | null;
  unrealized_pnl: number | null;
  unrealized_pct: number | null;
  notes?: string | null;
  exit_price?: number | null;
  closed_at?: string | null;
  status: 'open' | 'closed';
};

type ApiPortfolioPoint = {
  timestamp: string;
  label: string;
  realized: number;
  unrealized: number;
  equity: number;
};

type ApiPortfolioSummary = {
  starting_capital: number;
  current_capital: number;
  realized_pnl: number;
  unrealized_pnl: number;
  equity_series: ApiPortfolioPoint[];
};

const mapPosition = (position: ApiPosition): Position => ({
  id: position.id,
  ticker: position.ticker,
  side: position.side,
  qty: Number(position.qty),
  entryPrice: Number(position.entry_price),
  currentPrice:
    position.current_price === null || position.current_price === undefined
      ? null
      : Number(position.current_price),
  unrealizedPnl:
    position.unrealized_pnl === null || position.unrealized_pnl === undefined
      ? null
      : Number(position.unrealized_pnl),
  unrealizedPct:
    position.unrealized_pct === null || position.unrealized_pct === undefined
      ? null
      : Number(position.unrealized_pct),
  createdAt: position.created_at,
  notes: position.notes ?? '',
  exitPrice:
    position.exit_price === null || position.exit_price === undefined
      ? null
      : Number(position.exit_price),
  closedAt: position.closed_at ?? null,
  status: position.status
});

const mapPortfolioSummary = (payload: ApiPortfolioSummary): PortfolioSummary => ({
  startingCapital: payload.starting_capital,
  currentCapital: payload.current_capital,
  realizedPnl: payload.realized_pnl,
  unrealizedPnl: payload.unrealized_pnl,
  equitySeries: payload.equity_series.map<PortfolioSummaryPoint>((point) => ({
    timestamp: point.timestamp,
    label: point.label,
    realized: point.realized,
    unrealized: point.unrealized,
    equity: point.equity
  }))
});

function App(): JSX.Element {
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'targets'>('open');
  const [useDarkMode, setUseDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  const activeTheme = useMemo(() => (useDarkMode ? createAppTheme('dark') : theme), [useDarkMode]);

  const openPositions = useMemo(
    () => positions.filter((position) => position.status === 'open'),
    [positions]
  );

  const closedPositions = useMemo(
    () => positions.filter((position) => position.status === 'closed'),
    [positions]
  );

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/positions?status=all`);
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

  const fetchPortfolioSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/portfolio/summary`);
      if (!response.ok) {
        throw new Error('Failed to load portfolio summary.');
      }
      const data: ApiPortfolioSummary = await response.json();
      setPortfolioSummary(mapPortfolioSummary(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while loading the portfolio summary.';
      setSummaryError(message);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPositions();
    void fetchPortfolioSummary();
  }, [fetchPositions, fetchPortfolioSummary]);

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
            current_price: values.currentPrice ?? values.entryPrice,
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
        await fetchPortfolioSummary();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error while saving the position.';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchPortfolioSummary]
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
            current_price: values.currentPrice ?? values.entryPrice,
            created_at: values.createdAt ?? null,
            notes: values.notes?.trim() ? values.notes.trim() : null,
            exit_price: values.exitPrice ?? null,
            closed_at: values.closedAt ?? null
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

        await response.json();
        await fetchPositions();
        await fetchPortfolioSummary();
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
    [fetchPositions, fetchPortfolioSummary]
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
            <PortfolioSummaryCard
              summary={portfolioSummary}
              loading={isSummaryLoading}
              error={summaryError}
              onRetry={fetchPortfolioSummary}
            />
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 2, px: { xs: 1, md: 0 } }}>
                <Box>
                  <Typography variant="h5" fontWeight={600}>
                    Positions overview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {openPositions.length === 0 && closedPositions.length === 0
                      ? 'No positions added yet. Use the form above to create your first entry.'
                      : 'Track current exposure, cost basis, and realized performance at a glance.'}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Tabs
                value={activeTab}
                onChange={(_, value: 'open' | 'closed' | 'targets') => setActiveTab(value)}
                aria-label="Position status tabs"
                sx={{ px: { xs: 1, md: 0 }, mb: 2 }}
              >
                <Tab label={`Open (${openPositions.length})`} value="open" />
                <Tab label={`Closed (${closedPositions.length})`} value="closed" />
                <Tab label="Profit targets" value="targets" />
              </Tabs>
              {activeTab === 'targets' ? (
                <PositionTargetsTable positions={openPositions} loading={isLoading} />
              ) : (
                <PositionTable
                  positions={activeTab === 'open' ? openPositions : closedPositions}
                  variant={activeTab === 'open' ? 'open' : 'closed'}
                  loading={isLoading}
                  onEdit={handleEditPosition}
                />
              )}
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
