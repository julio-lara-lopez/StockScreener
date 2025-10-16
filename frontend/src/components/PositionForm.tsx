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
  side: 'long' | 'short';
  qty: number;
  entryPrice: number;
  currentPrice?: number | null;
  createdAt?: string | null;
  notes?: string;
  exitPrice?: number | null;
  closedAt?: string | null;
};

type FormState = {
  ticker: string;
  side: PositionFormValues['side'];
  qty: string;
  entryPrice: string;
  currentPrice: string;
  notes: string;
};

const initialState: FormState = {
  ticker: '',
  side: 'long',
  qty: '',
  entryPrice: '',
  currentPrice: '',
  notes: ''
};

type PositionFormProps = {
  onSubmit: (values: PositionFormValues) => Promise<void>;
  isSubmitting?: boolean;
};

const sides: { label: string; value: PositionFormValues['side'] }[] = [
  { label: 'Long', value: 'long' },
  { label: 'Short', value: 'short' }
];

const PositionForm = ({ onSubmit, isSubmitting = false }: PositionFormProps): JSX.Element => {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const qty = parseNumber(values.qty);
    const entryPrice = parseNumber(values.entryPrice);
    const currentPrice = parseNumber(values.currentPrice);

    if (!values.ticker.trim() || qty === null || qty <= 0 || entryPrice === null || entryPrice <= 0) {
      return;
    }

    const payload: PositionFormValues = {
      ticker: values.ticker.trim().toUpperCase(),
      side: values.side,
      qty,
      entryPrice,
      currentPrice: currentPrice ?? entryPrice,
      notes: values.notes.trim() ? values.notes.trim() : undefined
    };

    try {
      await onSubmit(payload);
      setValues(initialState);
    } catch {
      // Keep the current form state so the user can adjust inputs after an error.
    }
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
                label="Side"
                name="side"
                select
                value={values.side}
                onChange={handleChange}
                required
                fullWidth
              >
                {sides.map((side) => (
                  <MenuItem key={side.value} value={side.value}>
                    {side.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Quantity"
                name="qty"
                type="number"
                inputProps={{ min: 0, step: 0.0001 }}
                value={values.qty}
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
                inputProps={{ min: 0, step: 0.0001 }}
                value={values.entryPrice}
                onChange={handleChange}
                required
                fullWidth
              />
            </Grid>
            <Grid xs={6} md={2}>
              <TextField
                label="Current price"
                name="currentPrice"
                type="number"
                inputProps={{ min: 0, step: 0.0001 }}
                value={values.currentPrice}
                onChange={handleChange}
                fullWidth
                helperText="Defaults to entry price"
              />
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
            <Button variant="outlined" color="inherit" onClick={() => setValues(initialState)} type="button" disabled={isSubmitting}>
              Reset
            </Button>
            <Button variant="contained" color="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Add position'}
            </Button>
          </Stack>
        </CardActions>
      </form>
    </Card>
  );
};

export default PositionForm;
