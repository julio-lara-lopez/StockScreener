import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

export type ActiveBatchRow = {
  id: string;
  batchId: string;
  ingestedAt: string;
  ticker: string;
  name: string | null;
  rvol: number | null;
  price: number | null;
  pctChange: number | null;
  volume: number | null;
  marketCap: number | null;
  sector: string | null;
  analystRating: string | null;
};

type ActiveBatchesPageProps = {
  rows: ActiveBatchRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const formatNumber = (value: number | null, options?: Intl.NumberFormatOptions) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat(undefined, options).format(value);
};

function ActiveBatchesPage({ rows, loading, error, onRetry }: ActiveBatchesPageProps): JSX.Element {
  if (loading && rows.length === 0 && !error) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography color="text.secondary">Loading recent RVOL batches…</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Active RVOL batches
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Latest ingestion batches that match your screening thresholds. Each row shows the tickers that cleared
            the RVOL and price filters for the selected session.
          </Typography>
        </Box>
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onRetry} disabled={loading}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch time</TableCell>
                <TableCell>Ticker</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">RVOL</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Change %</TableCell>
                <TableCell align="right">Volume</TableCell>
                <TableCell align="right">Market cap</TableCell>
                <TableCell>Sector</TableCell>
                <TableCell>Analyst rating</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography color="text.secondary">No active batches matched the configured filters.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{formatDateTime(row.ingestedAt)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.ticker}</TableCell>
                    <TableCell>{row.name ?? '—'}</TableCell>
                    <TableCell align="right">{formatNumber(row.rvol, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">{formatNumber(row.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">
                      {row.pctChange === null || row.pctChange === undefined
                        ? '—'
                        : `${formatNumber(row.pctChange, { maximumFractionDigits: 2 })}%`}
                    </TableCell>
                    <TableCell align="right">{formatNumber(row.volume, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell align="right">{formatNumber(row.marketCap, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell>{row.sector ?? '—'}</TableCell>
                    <TableCell>{row.analystRating ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {loading && rows.length > 0 && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Refreshing…
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export default ActiveBatchesPage;
