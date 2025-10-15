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
import { alpha } from '@mui/material/styles';
import { PositionFormValues } from './PositionForm';

export type Position = PositionFormValues & {
  id: string;
};

type PositionTableProps = {
  positions: Position[];
};

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);

const PositionTable = ({ positions }: PositionTableProps): JSX.Element => {
  const totals = positions.reduce(
    (acc, position) => {
      const cost = position.shares * position.entryPrice;
      return {
        shares: acc.shares + position.shares,
        costBasis: acc.costBasis + cost,
        targets: acc.targets + (position.targetPrice ?? 0)
      };
    },
    { shares: 0, costBasis: 0, targets: 0 }
  );

  const averageTarget = positions.length > 0 ? totals.targets / positions.length : 0;

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
            basis and target summaries.
          </Typography>
        </Stack>
      </Paper>
    );
  }

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
        <SummaryTile title="Total shares" value={totals.shares.toLocaleString()} />
        <SummaryTile title="Cost basis" value={formatCurrency(totals.costBasis)} />
        <SummaryTile title="Average target" value={formatCurrency(averageTarget)} />
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell align="right">Shares</TableCell>
              <TableCell align="right">Entry price</TableCell>
              <TableCell align="right">Cost basis</TableCell>
              <TableCell align="right">Target</TableCell>
              <TableCell align="right">Stop loss</TableCell>
              <TableCell>Strategy</TableCell>
              <TableCell>Entry date</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((position) => {
              const cost = position.shares * position.entryPrice;
              return (
                <TableRow key={position.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={position.ticker} color="primary" size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{position.shares.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatCurrency(position.entryPrice)}</TableCell>
                  <TableCell align="right">{formatCurrency(cost)}</TableCell>
                  <TableCell align="right">{formatCurrency(position.targetPrice ?? null)}</TableCell>
                  <TableCell align="right">{formatCurrency(position.stopLoss ?? null)}</TableCell>
                  <TableCell>{position.strategy}</TableCell>
                  <TableCell>{position.entryDate}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>{position.notes || '—'}</TableCell>
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
