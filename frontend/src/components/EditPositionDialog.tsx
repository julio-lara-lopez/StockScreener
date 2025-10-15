import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Unstable_Grid2';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { Position } from './PositionTable';
import { PositionFormValues } from './PositionForm';

type FormState = {
  ticker: string;
  side: PositionFormValues['side'];
  qty: string;
  entryPrice: string;
  notes: string;
};

type EditPositionDialogProps = {
  open: boolean;
  position: Position | null;
  onClose: () => void;
  onSubmit: (values: PositionFormValues) => Promise<void>;
  isSubmitting?: boolean;
};

const sides: { label: string; value: PositionFormValues['side'] }[] = [
  { label: 'Long', value: 'long' },
  { label: 'Short', value: 'short' }
];

const emptyState: FormState = {
  ticker: '',
  side: 'long',
  qty: '',
  entryPrice: '',
  notes: ''
};

const EditPositionDialog = ({
  open,
  position,
  onClose,
  onSubmit,
  isSubmitting = false
}: EditPositionDialogProps): JSX.Element => {
  const [values, setValues] = useState<FormState>(emptyState);

  useEffect(() => {
    if (open && position) {
      setValues({
        ticker: position.ticker,
        side: position.side,
        qty: position.qty.toString(),
        entryPrice: position.entryPrice.toString(),
        notes: position.notes ?? ''
      });
    } else if (!open) {
      setValues(emptyState);
    }
  }, [open, position]);

  const title = useMemo(() => {
    if (!position) {
      return 'Edit position';
    }
    return `Edit ${position.ticker}`;
  }, [position]);

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

    if (!position) {
      return;
    }

    const qty = parseNumber(values.qty);
    const entryPrice = parseNumber(values.entryPrice);

    if (!values.ticker.trim() || qty === null || qty <= 0 || entryPrice === null || entryPrice <= 0) {
      return;
    }

    const payload: PositionFormValues = {
      ticker: values.ticker.trim().toUpperCase(),
      side: values.side,
      qty,
      entryPrice,
      notes: values.notes.trim() ? values.notes.trim() : undefined
    };

    try {
      await onSubmit(payload);
    } catch {
      // The caller handles error presentation; keep the dialog open for corrections.
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid xs={12} md={4}>
              <TextField
                label="Ticker"
                name="ticker"
                value={values.ticker}
                onChange={handleChange}
                required
                fullWidth
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <TextField
                label="Notes"
                name="notes"
                value={values.notes}
                onChange={handleChange}
                fullWidth
                disabled={isSubmitting}
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Stack direction="row" spacing={2} sx={{ px: 2, py: 1 }}>
            <Button onClick={onClose} color="inherit" type="button" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EditPositionDialog;
