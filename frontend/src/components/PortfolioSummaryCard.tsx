import { useMemo } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export type PortfolioSummaryPoint = {
  timestamp: string;
  label: string;
  realized: number;
  unrealized: number;
  equity: number;
};

export type PortfolioSummary = {
  startingCapital: number;
  currentCapital: number;
  realizedPnl: number;
  unrealizedPnl: number;
  equitySeries: PortfolioSummaryPoint[];
};

type PortfolioSummaryCardProps = {
  summary: PortfolioSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);

const formatSignedCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always'
  }).format(value);

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const PortfolioSummaryCard = ({ summary, loading, error, onRetry }: PortfolioSummaryCardProps) => {
  const chartData = useMemo(() => {
    if (!summary) {
      return [];
    }
    return summary.equitySeries.map((point) => ({
      ...point,
      dateLabel: formatDateLabel(point.timestamp),
      tooltipLabel: `${formatDateTime(point.timestamp)} • ${point.label}`
    }));
  }, [summary]);

  const metrics = summary
    ? [
        {
          title: 'Starting capital',
          value: formatCurrency(summary.startingCapital)
        },
        {
          title: 'Current capital',
          value: formatCurrency(summary.currentCapital)
        },
        {
          title: 'Realized P&L',
          value: formatSignedCurrency(summary.realizedPnl)
        },
        {
          title: 'Unrealized P&L',
          value: formatSignedCurrency(summary.unrealizedPnl)
        }
      ]
    : [];

  return (
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Portfolio performance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Visualize realized and unrealized gains alongside your total account value.
            </Typography>
          </Box>
          <Button onClick={() => void onRetry()} disabled={loading} variant="outlined" size="small">
            Refresh
          </Button>
        </Stack>
        {error && !loading && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void onRetry()}>Retry</Button>}>
            {error}
          </Alert>
        )}
        {loading && !summary ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={320} />
          </Stack>
        ) : summary ? (
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
              {metrics.map((metric) => (
                <Paper
                  key={metric.title}
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    background: (theme) =>
                      alpha(theme.palette.success.main, theme.palette.mode === 'light' ? 0.05 : 0.12)
                  }}
                >
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    {metric.title}
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {metric.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="unrealizedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9c27b0" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#9c27b0" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="dateLabel" />
                  <YAxis tickFormatter={(value: number) => formatCurrency(value)} width={90} />
                  <Tooltip
                    formatter={(value: number | string, name) => {
                      const numericValue = typeof value === 'number' ? value : Number(value);
                      const labelMap: Record<string, string> = {
                        realized: 'Realized P&L',
                        unrealized: 'Unrealized P&L',
                        equity: 'Equity'
                      };
                      return [formatCurrency(numericValue), labelMap[String(name)] ?? String(name)];
                    }}
                    labelFormatter={(label, payload) =>
                      payload && payload[0] && typeof payload[0].payload.tooltipLabel === 'string'
                        ? payload[0].payload.tooltipLabel
                        : label
                    }
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="realized"
                    name="Realized P&L"
                    fill="url(#realizedGradient)"
                    stroke="#1976d2"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="unrealized"
                    name="Unrealized P&L"
                    fill="url(#unrealizedGradient)"
                    stroke="#9c27b0"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="equity" name="Equity" stroke="#2e7d32" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Add your first position to unlock portfolio analytics.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default PortfolioSummaryCard;
