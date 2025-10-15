import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import { alpha } from '@mui/material/styles';

export type Position = {
  id: number;
  ticker: string;
  side: 'long' | 'short';
  qty: number;
  entryPrice: number;
  currentPrice: number | null;
  createdAt: string;
  notes?: string | null;
  exitPrice?: number | null;
  closedAt?: string | null;
  status: 'open' | 'closed';
};

type PositionTableProps = {
  positions: Position[];
  variant: 'open' | 'closed';
  loading?: boolean;
  onEdit?: (position: Position) => void;
};

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);

const formatSignedCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        signDisplay: 'always'
      }).format(value);

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const PositionTable = ({ positions, variant, loading = false, onEdit }: PositionTableProps): JSX.Element => {
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
            Loading positions…
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (positions.length === 0) {
    const description =
      variant === 'open'
        ? 'Use the form above to add your first position. Your open positions will show up here with cost basis and performance summaries.'
        : 'Once you close a position it will appear here with its exit price and realized performance.';

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
            {variant === 'open' ? 'Start tracking your portfolio' : 'No closed positions yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={420}>
            {description}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  const totals = positions.reduce(
    (acc, position) => {
      const cost = position.qty * position.entryPrice;
      const exitValue =
        position.exitPrice === null || position.exitPrice === undefined
          ? null
          : position.exitPrice * position.qty;
      let realized = null as number | null;
      if (exitValue !== null) {
        realized =
          position.side === 'long'
            ? exitValue - cost
            : cost - exitValue;
      }

      return {
        qty: acc.qty + position.qty,
        costBasis: acc.costBasis + cost,
        exitValue: exitValue !== null ? acc.exitValue + exitValue : acc.exitValue,
        realized: realized !== null ? acc.realized + realized : acc.realized,
        realizedCount: realized !== null ? acc.realizedCount + 1 : acc.realizedCount
      };
    },
    { qty: 0, costBasis: 0, exitValue: 0, realized: 0, realizedCount: 0 }
  );

  const averageEntryPrice = totals.qty > 0 ? totals.costBasis / totals.qty : 0;

  const summaryTiles =
    variant === 'open'
      ? [
          { title: 'Open positions', value: positions.length.toString() },
          { title: 'Total quantity', value: totals.qty.toLocaleString() },
          { title: 'Cost basis', value: formatCurrency(totals.costBasis) },
          { title: 'Avg. entry price', value: formatCurrency(averageEntryPrice) }
        ]
      : [
          { title: 'Closed positions', value: positions.length.toString() },
          { title: 'Total quantity', value: totals.qty.toLocaleString() },
          { title: 'Cost basis', value: formatCurrency(totals.costBasis) },
          {
            title: 'Realized P&L',
            value:
              totals.realizedCount > 0
                ? formatSignedCurrency(totals.realized)
                : '—'
          }
        ];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(auto-fill, minmax(140px, 1fr))',
            md: 'repeat(auto-fill, minmax(180px, 1fr))'
          },
          gap: 2
        }}
      >
        {summaryTiles.map((tile) => (
          <SummaryTile key={tile.title} title={tile.title} value={tile.value} />
        ))}
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Entry price</TableCell>
              {variant === 'closed' && <TableCell align="right">Exit price</TableCell>}
              <TableCell align="right">Cost basis</TableCell>
              {variant === 'closed' && (
                <>
                  <TableCell align="right">Exit value</TableCell>
                  <TableCell align="right">Realized P&L</TableCell>
                </>
              )}
              <TableCell>Notes</TableCell>
              {variant === 'closed' ? (
                <>
                  <TableCell>Closed</TableCell>
                  <TableCell>Opened</TableCell>
                </>
              ) : (
                <TableCell>Created</TableCell>
              )}
              {onEdit && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position) => {
              const cost = position.qty * position.entryPrice;
              const exitPrice = position.exitPrice ?? null;
              const exitValue = exitPrice !== null ? exitPrice * position.qty : null;
              const realizedPnL =
                exitValue !== null
                  ? position.side === 'long'
                    ? exitValue - cost
                    : cost - exitValue
                  : null;
              return (
                <TableRow key={position.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={position.ticker} color="primary" size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell>{capitalize(position.side)}</TableCell>
                  <TableCell align="right">{position.qty.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatCurrency(position.entryPrice)}</TableCell>
                  {variant === 'closed' && (
                    <TableCell align="right">{formatCurrency(exitPrice)}</TableCell>
                  )}
                  <TableCell align="right">{formatCurrency(cost)}</TableCell>
                  {variant === 'closed' && (
                    <>
                      <TableCell align="right">{formatCurrency(exitValue)}</TableCell>
                      <TableCell align="right">{formatSignedCurrency(realizedPnL)}</TableCell>
                    </>
                  )}
                  <TableCell sx={{ maxWidth: 260 }}>{position.notes?.trim() ? position.notes : '—'}</TableCell>
                  {variant === 'closed' ? (
                    <>
                      <TableCell>{position.closedAt ? formatDate(position.closedAt) : '—'}</TableCell>
                      <TableCell>{formatDate(position.createdAt)}</TableCell>
                    </>
                  ) : (
                    <TableCell>{formatDate(position.createdAt)}</TableCell>
                  )}
                  {onEdit && (
                    <TableCell align="right">
                      <Tooltip title="Edit position">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${position.ticker}`}
                          onClick={() => onEdit(position)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

type SummaryTileProps = {
  title: string;
  value: string;
};

const SummaryTile = ({ title, value }: SummaryTileProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2.5,
      borderRadius: 2,
      background: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.05 : 0.1)
    }}
  >
    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
      {title}
    </Typography>
    <Typography variant="h6" fontWeight={600}>
      {value}
    </Typography>
  </Paper>
);

export default PositionTable;
