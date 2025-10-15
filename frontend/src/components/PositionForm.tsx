import { ChangeEvent, FormEvent, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Unstable_Grid2';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';

export type PositionFormValues = {
  ticker: string;
  shares: number;
  entryPrice: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  entryDate: string;
  notes?: string;
  strategy: 'Long' | 'Short' | 'Options';
};

type FormState = {
  [K in keyof PositionFormValues]: string;
};

const initialState: FormState = {
  ticker: '',
  shares: '',
  entryPrice: '',
  targetPrice: '',
  stopLoss: '',
  entryDate: new Date().toISOString().substring(0, 10),
  notes: '',
  strategy: 'Long'
};

type PositionFormProps = {
  onSubmit: (values: PositionFormValues) => void;
};

const strategies: PositionFormValues['strategy'][] = ['Long', 'Short', 'Options'];

const PositionForm = ({ onSubmit }: PositionFormProps): JSX.Element => {
  const [values, setValues] = useState<FormState>(initialState);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const parseNumber = (value: string): number | null => {
    if (value.trim() === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const shares = parseNumber(values.shares);
    const entryPrice = parseNumber(values.entryPrice);

    if (!values.ticker.trim() || shares === null || shares <= 0 || entryPrice === null || entryPrice <= 0) {
      return;
    }

    const payload: PositionFormValues = {
      ticker: values.ticker.trim().toUpperCase(),
      shares,
      entryPrice,
      targetPrice: parseNumber(values.targetPrice),
      stopLoss: parseNumber(values.stopLoss),
      entryDate: values.entryDate,
      notes: values.notes.trim(),
      strategy: values.strategy as PositionFormValues['strategy']
    };

    onSubmit(payload);
    setValues(initialState);
  };

  return (
    <Card variant="outlined" sx={{ background: (t) => t.palette.background.paper }}>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid xs={12} md={4}>
              <TextField
                label="Ticker"
                name="ticker"
                value={values.ticker}
                onChange={handleChange}
                required
                autoFocus
                fullWidth
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Shares"
                name="shares"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={values.shares}
                onChange={handleChange}
                required
                fullWidth
              />
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Entry price"
                name="entryPrice"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={values.entryPrice}
                onChange={handleChange}
                required
                fullWidth
              />
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Target price"
                name="targetPrice"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={values.targetPrice}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Stop loss"
                name="stopLoss"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={values.stopLoss}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid xs={12} md={3}>
              <TextField
                label="Entry date"
                name="entryDate"
                type="date"
                value={values.entryDate}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <TextField
                label="Strategy"
                name="strategy"
                select
                value={values.strategy}
                onChange={handleChange}
                fullWidth
              >
                {strategies.map((strategy) => (
                  <MenuItem key={strategy} value={strategy}>
                    {strategy}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid xs={12} md={6}>
              <TextField
                label="Notes"
                name="notes"
                value={values.notes}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', px: 3, pb: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="inherit" onClick={() => setValues(initialState)} type="button">
              Reset
            </Button>
            <Button variant="contained" color="primary" type="submit">
              Add position
            </Button>
          </Stack>
        </CardActions>
      </form>
    </Card>
  );
};

export default PositionForm;
