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
  createdAt: string;
  notes?: string | null;
};

type PositionTableProps = {
  positions: Position[];
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

const PositionTable = ({ positions, loading = false, onEdit }: PositionTableProps): JSX.Element => {
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
            Start tracking your portfolio
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={420}>
            Use the form above to add your first position. Your positions will show up here with cost
            basis and performance summaries.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  const totals = positions.reduce(
    (acc, position) => {
      const cost = position.qty * position.entryPrice;
      return {
        qty: acc.qty + position.qty,
        costBasis: acc.costBasis + cost
      };
    },
    { qty: 0, costBasis: 0 }
  );

  const averageEntryPrice = totals.qty > 0 ? totals.costBasis / totals.qty : 0;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2
        }}
      >
        <SummaryTile title="Positions" value={positions.length.toString()} />
        <SummaryTile title="Total quantity" value={totals.qty.toLocaleString()} />
        <SummaryTile title="Cost basis" value={formatCurrency(totals.costBasis)} />
        <SummaryTile title="Avg. entry price" value={formatCurrency(averageEntryPrice)} />
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Entry price</TableCell>
              <TableCell align="right">Cost basis</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Created</TableCell>
              {onEdit && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position) => {
              const cost = position.qty * position.entryPrice;
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
                  <TableCell align="right">{formatCurrency(cost)}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>{position.notes?.trim() ? position.notes : '—'}</TableCell>
                  <TableCell>{formatDate(position.createdAt)}</TableCell>
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
