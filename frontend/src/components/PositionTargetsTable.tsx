import { useMemo, useState } from 'react';
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
import { alpha } from '@mui/material/styles';
import type { Position } from './PositionTable';

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

const PositionTargetsTable = ({
  positions,
  loading = false
}: {
  positions: Position[];
  loading?: boolean;
}): JSX.Element => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

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
                      <Tooltip title={`Create ${target.pct}% alert (coming soon)`}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setAlertMessage(
                              `We'll notify you here once alerts for ${row.ticker} ${target.pct}% targets are available.`
                            )
                          }
                          aria-label={`Create placeholder alert for ${row.ticker} ${target.pct}% target`}
                        >
                          <NotificationsActiveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Snackbar
        open={Boolean(alertMessage)}
        autoHideDuration={4000}
        onClose={() => setAlertMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setAlertMessage(null)} severity="info" sx={{ width: '100%' }}>
          {alertMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PositionTargetsTable;
