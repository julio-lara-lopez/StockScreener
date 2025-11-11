import { useCallback, useEffect, useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Switch from '@mui/material/Switch';
import RefreshIcon from '@mui/icons-material/Refresh';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiAlert = {
  id: number;
  ticker: string;
  kind: string;
  threshold_value: number;
  trailing: boolean;
  active: boolean;
  created_at: string;
  last_triggered_at: string | null;
};

type SnackbarState = {
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
};

type Direction = 'above' | 'below';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
};

const WatchlistAlertsCard = (): JSX.Element => {
  const [ticker, setTicker] = useState('');
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<Direction>('above');
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedTicker = ticker.trim().toUpperCase();
  const parsedPrice = useMemo(() => {
    if (price.trim() === '') {
      return null;
    }
    const parsed = Number(price);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }, [price]);

  const canSubmit = normalizedTicker.length > 0 && parsedPrice !== null;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        kind: 'price_cross'
      });
      const response = await fetch(`${API_BASE_URL}/api/alerts?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Unable to load watchlist alerts.');
      }
      const data: ApiAlert[] = await response.json();
      const sorted = [...data].sort((a, b) => {
        const tickerCompare = a.ticker.localeCompare(b.ticker);
        if (tickerCompare !== 0) {
          return tickerCompare;
        }
        return a.threshold_value - b.threshold_value;
      });
      setAlerts(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while loading alerts.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const resetForm = () => {
    setTicker('');
    setPrice('');
    setDirection('above');
  };

  const handleSubmit = async () => {
    if (!canSubmit || parsedPrice === null) {
      return;
    }
    setSubmitting(true);
    setSnackbar(null);
    try {
      const payload = {
        ticker: normalizedTicker,
        kind: 'price_cross',
        threshold_value: parsedPrice,
        trailing: direction === 'below'
      };
      const response = await fetch(`${API_BASE_URL}/api/alerts/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Unable to save watchlist alert.');
      }
      setSnackbar({
        severity: 'success',
        message: `Price alert saved for ${normalizedTicker}.`
      });
      resetForm();
      await fetchAlerts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while saving alert.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (alert: ApiAlert) => {
    setSnackbar(null);
    try {
      const endpoint = alert.active ? 'deactivate' : 'activate';
      const response = await fetch(`${API_BASE_URL}/api/alerts/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker: alert.ticker,
          kind: alert.kind,
          threshold_value: alert.threshold_value,
          trailing: alert.trailing
        })
      });
      if (!response.ok) {
        throw new Error(alert.active ? 'Unable to disable alert.' : 'Unable to activate alert.');
      }
      setSnackbar({
        severity: 'success',
        message: `${alert.active ? 'Disabled' : 'Activated'} alert for ${alert.ticker}.`
      });
      await fetchAlerts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error while updating alert.';
      setSnackbar({ severity: 'error', message });
    }
  };

  const handleRefresh = async () => {
    setSnackbar(null);
    await fetchAlerts();
  };

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <div>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Watchlist price alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Get notified on Telegram when a stock you are watching hits your target price.
            </Typography>
          </div>
          <Tooltip title="Refresh alerts">
            <span>
              <IconButton onClick={() => { void handleRefresh(); }} disabled={loading}>
                {loading ? <CircularProgress size={20} thickness={5} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'flex-end' }}
        >
          <TextField
            label="Ticker"
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            inputProps={{ maxLength: 6, style: { textTransform: 'uppercase' } }}
            fullWidth
          />
          <TextField
            label="Target price"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
            error={price.trim() !== '' && parsedPrice === null}
            helperText={price.trim() !== '' && parsedPrice === null ? 'Enter a valid price greater than 0.' : ' '}
          />
          <ToggleButtonGroup
            exclusive
            value={direction}
            onChange={(_, value: Direction | null) => {
              if (value) {
                setDirection(value);
              }
            }}
            aria-label="Price direction"
            color="primary"
          >
            <ToggleButton value="above" aria-label="Alert when price is at or above target">
              ≥ Target
            </ToggleButton>
            <ToggleButton value="below" aria-label="Alert when price is at or below target">
              ≤ Target
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            onClick={() => { void handleSubmit(); }}
            disabled={!canSubmit || submitting}
            sx={{ minWidth: { md: 140 } }}
          >
            {submitting ? <CircularProgress size={20} thickness={5} /> : 'Save alert'}
          </Button>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Watchlist alerts table">
            <TableHead>
              <TableRow>
                <TableCell>Ticker</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell align="right">Target price</TableCell>
                <TableCell align="right">Status</TableCell>
                <TableCell align="right">Last triggered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    {loading ? (
                      <CircularProgress size={24} thickness={5} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No watchlist alerts yet. Add one above to get started.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => {
                  const directionLabel = alert.trailing ? '≤ Target' : '≥ Target';
                  return (
                    <TableRow key={alert.id} hover>
                      <TableCell>{alert.ticker}</TableCell>
                      <TableCell>{directionLabel}</TableCell>
                      <TableCell align="right">{formatCurrency(alert.threshold_value)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
                          <Typography variant="body2" color="text.secondary">
                            {alert.active ? 'Active' : 'Paused'}
                          </Typography>
                          <Switch
                            checked={alert.active}
                            onChange={() => { void handleToggle(alert); }}
                            inputProps={{ 'aria-label': `Toggle alert for ${alert.ticker}` }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{formatDateTime(alert.last_triggered_at)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={snackbar?.severity === 'error' ? 6000 : 3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Paper>
  );
};

export default WatchlistAlertsCard;
