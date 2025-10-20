import { useEffect, useMemo, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { alpha } from '@mui/material/styles';
import type { Position } from './PositionTable';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const TARGET_PCTS = [1, 3, 5, 10];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);

const formatOptionalCurrency = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : formatCurrency(value);

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

type SnackbarState = {
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
};

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

const PositionTargetsTable = ({
  positions,
  loading = false
}: {
  positions: Position[];
  loading?: boolean;
}): JSX.Element => {
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, boolean>>({});
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      positions.map((position) => ({
        ...position,
        createdDate: formatDate(position.createdAt),
        targets: TARGET_PCTS.map((pct) => {
          const multiplier = position.side === 'long' ? 1 + pct / 100 : 1 - pct / 100;
          const targetPrice = position.entryPrice * multiplier;
          return {
            pct,
            targetPrice,
            formatted: formatCurrency(targetPrice)
          };
        })
      })),
    [positions]
  );

  useEffect(() => {
    let ignore = false;

    const loadAlertStatuses = async () => {
      if (positions.length === 0) {
        if (!ignore) {
          setAlertStatuses({});
        }
        return;
      }

      const defaults: Record<string, boolean> = {};
      positions.forEach((position) => {
        TARGET_PCTS.forEach((pct) => {
          defaults[`${position.ticker.toUpperCase()}-${pct}`] = false;
        });
      });

      try {
        const uniqueTickers = [...new Set(positions.map((p) => p.ticker.toUpperCase()))];
        const responses = await Promise.all(
          uniqueTickers.map(async (ticker) => {
            const params = new URLSearchParams({
              active: 'true',
              ticker,
              kind: 'target_pct',
              trailing: 'false'
            });
            const response = await fetch(`${API_BASE_URL}/api/alerts?${params.toString()}`);
            if (!response.ok) {
              throw new Error('Unable to load alert statuses.');
            }
            const data: ApiAlert[] = await response.json();
            return data;
          })
        );
        responses.flat().forEach((alert) => {
          const key = `${alert.ticker}-${Number(alert.threshold_value)}`;
          defaults[key] = alert.active;
        });
        if (!ignore) {
          setAlertStatuses(defaults);
        }
      } catch (err) {
        if (!ignore) {
          setAlertStatuses(defaults);
          const message =
            err instanceof Error
              ? err.message
              : 'Unexpected error while loading alert statuses.';
          setSnackbar({ severity: 'error', message });
        }
      }
    };

    void loadAlertStatuses();

    return () => {
      ignore = true;
    };
  }, [positions]);

  const toggleAlert = async (ticker: string, pct: number, currentlyActive: boolean) => {
    const normalizedTicker = ticker.toUpperCase();
    const key = `${normalizedTicker}-${pct}`;
    setUpdatingKey(key);
    setSnackbar(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/alerts/${currentlyActive ? 'deactivate' : 'activate'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticker: normalizedTicker,
            kind: 'target_pct',
            threshold_value: pct,
            trailing: false
          })
        }
      );
      if (!response.ok) {
        throw new Error(
          currentlyActive ? 'Unable to deactivate alert.' : 'Unable to activate alert.'
        );
      }
      const data: ApiAlert = await response.json();
      setAlertStatuses((prev) => ({
        ...prev,
        [key]: data.active
      }));
      setSnackbar({
        severity: 'success',
        message: `${data.active ? 'Activated' : 'Deactivated'} ${pct}% alert for ${normalizedTicker}.`
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error while updating alert.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setUpdatingKey((prev) => (prev === key ? null : prev));
    }
  };

  if (loading && positions.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          px: { xs: 3, md: 6 },
          py: { xs: 6, md: 8 },
          textAlign: 'center'
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Loading target calculations…
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (positions.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          px: { xs: 3, md: 6 },
          py: { xs: 6, md: 8 },
          textAlign: 'center',
          background: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.05 : 0.15)
        }}
      >
        <Stack spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            No open positions yet
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={420}>
            Add an open position first to see what prices you need to reach each profit target.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Profit target table for open positions">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Entry price</TableCell>
              <TableCell align="right">Current price</TableCell>
              {TARGET_PCTS.map((pct) => (
                <TableCell key={pct} align="right">{pct}% target</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={600}>{row.ticker}</Typography>
                    {row.createdDate && (
                      <Typography variant="caption" color="text.secondary">
                        Added {row.createdDate}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.side === 'long' ? 'Long' : 'Short'}
                    size="small"
                    color={row.side === 'long' ? 'success' : 'error'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">{formatCurrency(row.entryPrice)}</TableCell>
                <TableCell align="right">{formatOptionalCurrency(row.currentPrice)}</TableCell>
                {row.targets.map((target) => (
                  <TableCell align="right" key={target.pct}>
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                      <Typography variant="body2">{target.formatted}</Typography>
                      {(() => {
                        const key = `${row.ticker.toUpperCase()}-${target.pct}`;
                        const isActive = alertStatuses[key] ?? false;
                        return (
                          <Tooltip
                            title={
                              updatingKey === key
                                ? `${isActive ? 'Deactivating' : 'Activating'} alert…`
                                : `${isActive ? 'Deactivate' : 'Activate'} ${target.pct}% alert`
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  void toggleAlert(row.ticker, target.pct, isActive)
                                }
                                aria-label={`${
                                  isActive ? 'Deactivate' : 'Activate'
                                } alert for ${row.ticker} ${target.pct}% target`}
                                disabled={updatingKey === key}
                              >
                                {updatingKey === key ? (
                                  <CircularProgress size={16} thickness={5} />
                                ) : (
                                  <NotificationsActiveIcon
                                    fontSize="small"
                                    color={isActive ? 'success' : 'disabled'}
                                  />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        );
                      })()}
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={snackbar?.severity === 'error' ? 6000 : 4000}
        onClose={() => {
          setSnackbar(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert
            onClose={() => {
              setSnackbar(null);
            }}
            severity={snackbar.severity}
            iconMapping={{
              success: <CheckCircleIcon fontSize="small" />,
              warning: <WarningAmberIcon fontSize="small" />,
              error: undefined,
              info: undefined
            }}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};

export default PositionTargetsTable;
