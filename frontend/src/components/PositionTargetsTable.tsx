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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
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

type CustomTargetMode = 'pct' | 'abs';

type CustomTargetState = {
  mode: CustomTargetMode;
  value: string;
  active: boolean;
  alertKind: 'target_pct' | 'target_abs' | null;
  threshold: number | null;
};

const createDefaultCustomTargetState = (): CustomTargetState => ({
  mode: 'pct',
  value: '',
  active: false,
  alertKind: null,
  threshold: null
});

const parseNumericInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const computeCustomTargetPrice = (
  entryPrice: number,
  side: Position['side'],
  mode: CustomTargetMode,
  threshold: number | null
): number | null => {
  if (!Number.isFinite(entryPrice) || threshold === null || !Number.isFinite(threshold)) {
    return null;
  }
  if (mode === 'pct') {
    const multiplier = side === 'long' ? 1 + threshold / 100 : 1 - threshold / 100;
    return entryPrice * multiplier;
  }
  if (mode === 'abs') {
    return side === 'long' ? entryPrice + threshold : entryPrice - threshold;
  }
  return null;
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
  const [customTargets, setCustomTargets] = useState<Record<string, CustomTargetState>>({});
  const [customUpdating, setCustomUpdating] = useState<string | null>(null);

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
          setCustomTargets({});
        }
        return;
      }

      const defaults: Record<string, boolean> = {};
      positions.forEach((position) => {
        const tickerKey = position.ticker.toUpperCase();
        TARGET_PCTS.forEach((pct) => {
          defaults[`${tickerKey}-${pct}`] = false;
        });
      });

      try {
        const uniqueTickers = [...new Set(positions.map((p) => p.ticker.toUpperCase()))];
        const responses = await Promise.all(
          uniqueTickers.map(async (ticker) => {
            const params = new URLSearchParams({
              active: 'true',
              ticker,
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

        if (ignore) {
          return;
        }

        const customByTicker: Record<string, ApiAlert> = {};
        responses.flat().forEach((alert) => {
          const tickerKey = alert.ticker.toUpperCase();
          const numericThreshold = Number(alert.threshold_value);
          if (alert.kind === 'target_pct' && TARGET_PCTS.includes(numericThreshold)) {
            const key = `${tickerKey}-${numericThreshold}`;
            defaults[key] = alert.active;
            return;
          }
          if (
            (alert.kind === 'target_pct' || alert.kind === 'target_abs') &&
            !alert.trailing &&
            alert.active
          ) {
            const existing = customByTicker[tickerKey];
            if (!existing || alert.id > existing.id) {
              customByTicker[tickerKey] = alert;
            }
          }
        });

        setAlertStatuses(defaults);
        setCustomTargets((prev) => {
          const next: Record<string, CustomTargetState> = {};
          positions.forEach((position) => {
            const tickerKey = position.ticker.toUpperCase();
            const previousState = prev[tickerKey] ?? createDefaultCustomTargetState();
            next[tickerKey] = { ...previousState };
          });
          Object.entries(customByTicker).forEach(([tickerKey, alert]) => {
            const numericThreshold = Number(alert.threshold_value);
            next[tickerKey] = {
              mode: alert.kind === 'target_abs' ? 'abs' : 'pct',
              value: Number.isFinite(numericThreshold) ? numericThreshold.toString() : '',
              active: alert.active,
              alertKind: alert.kind === 'target_abs' ? 'target_abs' : 'target_pct',
              threshold: Number.isFinite(numericThreshold) ? numericThreshold : null
            };
          });
          return next;
        });
      } catch (err) {
        if (!ignore) {
          setAlertStatuses(defaults);
          setCustomTargets((prev) => {
            const next: Record<string, CustomTargetState> = {};
            positions.forEach((position) => {
              const tickerKey = position.ticker.toUpperCase();
              next[tickerKey] = prev[tickerKey] ?? createDefaultCustomTargetState();
            });
            return next;
          });
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

  const handleCustomModeChange = (ticker: string, mode: CustomTargetMode) => {
    const normalizedTicker = ticker.toUpperCase();
    setCustomTargets((prev) => {
      const previousState = prev[normalizedTicker] ?? createDefaultCustomTargetState();
      return {
        ...prev,
        [normalizedTicker]: {
          ...previousState,
          mode
        }
      };
    });
  };

  const handleCustomValueChange = (ticker: string, value: string) => {
    const normalizedTicker = ticker.toUpperCase();
    setCustomTargets((prev) => {
      const previousState = prev[normalizedTicker] ?? createDefaultCustomTargetState();
      return {
        ...prev,
        [normalizedTicker]: {
          ...previousState,
          value
        }
      };
    });
  };

  const saveCustomTarget = async (ticker: string) => {
    const normalizedTicker = ticker.toUpperCase();
    const current = customTargets[normalizedTicker] ?? createDefaultCustomTargetState();
    const parsedValue = parseNumericInput(current.value);

    if (current.mode === 'pct' && parsedValue !== null && TARGET_PCTS.includes(parsedValue)) {
      setSnackbar({
        severity: 'info',
        message: `Use the ${parsedValue}% toggle to manage this alert for ${normalizedTicker}.`
      });
      return;
    }

    if (parsedValue === null) {
      setSnackbar({ severity: 'error', message: 'Enter a valid number for your custom alert.' });
      return;
    }

    const desiredKind = current.mode === 'abs' ? 'target_abs' : 'target_pct';

    setCustomUpdating(normalizedTicker);
    setSnackbar(null);

    try {
      if (
        current.active &&
        current.alertKind &&
        current.threshold !== null &&
        (current.alertKind !== desiredKind || Math.abs(current.threshold - parsedValue) > 1e-6)
      ) {
        const deactivateResponse = await fetch(`${API_BASE_URL}/api/alerts/deactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticker: normalizedTicker,
            kind: current.alertKind,
            threshold_value: current.threshold,
            trailing: false
          })
        });

        if (!deactivateResponse.ok) {
          throw new Error('Unable to update existing custom alert.');
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/alerts/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker: normalizedTicker,
          kind: desiredKind,
          threshold_value: parsedValue,
          trailing: false
        })
      });

      if (!response.ok) {
        throw new Error('Unable to set custom alert.');
      }

      const data: ApiAlert = await response.json();
      const numericThreshold = Number(data.threshold_value);

      setCustomTargets((prev) => ({
        ...prev,
        [normalizedTicker]: {
          mode: desiredKind === 'target_abs' ? 'abs' : 'pct',
          value: parsedValue.toString(),
          active: data.active,
          alertKind: data.kind === 'target_abs' ? 'target_abs' : 'target_pct',
          threshold: Number.isFinite(numericThreshold) ? numericThreshold : parsedValue
        }
      }));

      setSnackbar({
        severity: 'success',
        message: `Custom ${desiredKind === 'target_abs' ? '$' : '%'} alert set for ${normalizedTicker}.`
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error while updating custom alert.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setCustomUpdating((prev) => (prev === normalizedTicker ? null : prev));
    }
  };

  const disableCustomTarget = async (ticker: string) => {
    const normalizedTicker = ticker.toUpperCase();
    const current = customTargets[normalizedTicker] ?? createDefaultCustomTargetState();

    if (!current.active) {
      setCustomTargets((prev) => ({
        ...prev,
        [normalizedTicker]: {
          ...current,
          active: false
        }
      }));
      return;
    }

    if (!current.alertKind || current.threshold === null) {
      setSnackbar({
        severity: 'error',
        message: 'Unable to disable this alert because its details are incomplete.'
      });
      return;
    }

    setCustomUpdating(normalizedTicker);
    setSnackbar(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker: normalizedTicker,
          kind: current.alertKind,
          threshold_value: current.threshold,
          trailing: false
        })
      });

      if (!response.ok) {
        throw new Error('Unable to disable custom alert.');
      }

      setCustomTargets((prev) => ({
        ...prev,
        [normalizedTicker]: {
          ...current,
          active: false
        }
      }));

      setSnackbar({
        severity: 'success',
        message: `Disabled custom alert for ${normalizedTicker}.`
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error while disabling custom alert.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setCustomUpdating((prev) => (prev === normalizedTicker ? null : prev));
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
              <TableCell align="right">Custom target alert</TableCell>
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
                                onClick={() => void toggleAlert(row.ticker, target.pct, isActive)}
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
                <TableCell align="right">
                  {(() => {
                    const tickerKey = row.ticker.toUpperCase();
                    const customState = customTargets[tickerKey] ?? createDefaultCustomTargetState();
                    const parsedInput = parseNumericInput(customState.value ?? '') ?? null;
                    const previewThreshold = parsedInput ?? customState.threshold;
                    const targetPrice = computeCustomTargetPrice(
                      row.entryPrice,
                      row.side,
                      customState.mode,
                      previewThreshold ?? null
                    );
                    const hasValidInput = parsedInput !== null;
                    const isUpdating = customUpdating === tickerKey;

                    return (
                      <Stack spacing={1} alignItems="flex-end">
                        <ToggleButtonGroup
                          size="small"
                          value={customState.mode}
                          exclusive
                          onChange={(_, value: CustomTargetMode | null) => {
                            if (value !== null) {
                              handleCustomModeChange(row.ticker, value);
                            }
                          }}
                          aria-label={`Choose custom alert type for ${row.ticker}`}
                        >
                          <ToggleButton value="pct" aria-label="Percentage target">
                            %
                          </ToggleButton>
                          <ToggleButton value="abs" aria-label="Dollar target">
                            $
                          </ToggleButton>
                        </ToggleButtonGroup>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          alignItems={{ xs: 'stretch', sm: 'center' }}
                          justifyContent="flex-end"
                        >
                          <TextField
                            size="small"
                            type="number"
                            value={customState.value}
                            onChange={(event) => {
                              handleCustomValueChange(row.ticker, event.target.value);
                            }}
                            placeholder={customState.mode === 'pct' ? '7.5' : '2.5'}
                            inputProps={{
                              step: customState.mode === 'pct' ? 0.1 : 0.01
                            }}
                            InputProps={{
                              startAdornment:
                                customState.mode === 'abs' ? (
                                  <InputAdornment position="start">$</InputAdornment>
                                ) : undefined,
                              endAdornment:
                                customState.mode === 'pct' ? (
                                  <InputAdornment position="end">%</InputAdornment>
                                ) : undefined
                            }}
                            aria-label={`Custom ${customState.mode === 'pct' ? 'percentage' : 'dollar'} target for ${row.ticker}`}
                            disabled={isUpdating}
                            error={customState.value.trim() !== '' && !hasValidInput}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              void saveCustomTarget(row.ticker);
                            }}
                            disabled={isUpdating || !hasValidInput}
                          >
                            {isUpdating ? (
                              <CircularProgress size={16} thickness={5} />
                            ) : customState.active ? (
                              'Update alert'
                            ) : (
                              'Set alert'
                            )}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => {
                              void disableCustomTarget(row.ticker);
                            }}
                            disabled={isUpdating || !customState.active}
                          >
                            Disable
                          </Button>
                        </Stack>
                        <Stack spacing={0.25} alignItems="flex-end">
                          <Chip
                            size="small"
                            label={customState.active ? 'Alert active' : 'Alert inactive'}
                            color={customState.active ? 'success' : 'default'}
                            variant={customState.active ? 'filled' : 'outlined'}
                          />
                          {targetPrice ? (
                            <Typography variant="caption" color="text.secondary">
                              Triggers at {formatCurrency(targetPrice)}
                              {previewThreshold !== null
                                ? customState.mode === 'pct'
                                  ? ` (${previewThreshold.toFixed(2)}%)`
                                  : ` (${formatCurrency(previewThreshold)})`
                                : ''}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Enter a target to enable a custom alert.
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    );
                  })()}
                </TableCell>
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
