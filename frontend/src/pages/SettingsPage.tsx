import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export type ThemePreferences = {
  mode: 'light' | 'dark';
  primaryColor: string;
};

export type AppSettings = {
  priceMin: number;
  priceMax: number;
  minRvol: number;
  minPctChange: number;
  volumeCap: number;
  startingCapital: number;
  theme: ThemePreferences;
};

export type AppSettingsSubmitValues = {
  priceMin: number;
  priceMax: number;
  minRvol: number;
  minPctChange: number;
  volumeCap: number;
  startingCapital: number;
  themeMode: 'light' | 'dark';
  primaryColor: string;
};

type SettingsPageProps = {
  settings: AppSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRetry: () => void;
  onSubmit: (values: AppSettingsSubmitValues) => Promise<void>;
};

type FormValues = {
  priceMin: string;
  priceMax: string;
  minRvol: string;
  minPctChange: string;
  volumeCap: string;
  startingCapital: string;
  themeMode: 'light' | 'dark';
  primaryColor: string;
};

const defaultFormValues: FormValues = {
  priceMin: '',
  priceMax: '',
  minRvol: '',
  minPctChange: '',
  volumeCap: '',
  startingCapital: '',
  themeMode: 'light',
  primaryColor: '#1976d2'
};

const isNumeric = (value: string) => value.trim() !== '' && !Number.isNaN(Number(value));

function SettingsPage({
  settings,
  loading,
  saving,
  error,
  onRetry,
  onSubmit
}: SettingsPageProps): JSX.Element {
  const [formValues, setFormValues] = useState<FormValues>(defaultFormValues);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setFormValues({
      priceMin: settings.priceMin.toString(),
      priceMax: settings.priceMax.toString(),
      minRvol: settings.minRvol.toString(),
      minPctChange: settings.minPctChange.toString(),
      volumeCap: settings.volumeCap.toString(),
      startingCapital: settings.startingCapital.toString(),
      themeMode: settings.theme.mode,
      primaryColor: settings.theme.primaryColor
    });
    setShowSuccess(false);
  }, [settings]);

  useEffect(() => {
    if (saving) {
      setShowSuccess(false);
    }
  }, [saving]);

  const hasValidationError = useMemo(() => {
    const { priceMin, priceMax, minRvol, minPctChange, volumeCap, startingCapital } = formValues;
    if (
      !isNumeric(priceMin) ||
      !isNumeric(priceMax) ||
      !isNumeric(minRvol) ||
      !isNumeric(minPctChange) ||
      !isNumeric(volumeCap) ||
      !isNumeric(startingCapital)
    ) {
      return true;
    }

    const priceMinValue = Number(priceMin);
    const priceMaxValue = Number(priceMax);

    return priceMinValue > priceMaxValue;
  }, [formValues]);

  const handleFieldChange = (field: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasValidationError) {
      return;
    }

    const submitValues: AppSettingsSubmitValues = {
      priceMin: Number(formValues.priceMin),
      priceMax: Number(formValues.priceMax),
      minRvol: Number(formValues.minRvol),
      minPctChange: Number(formValues.minPctChange),
      volumeCap: Number(formValues.volumeCap),
      startingCapital: Number(formValues.startingCapital),
      themeMode: formValues.themeMode,
      primaryColor: formValues.primaryColor
    };

    try {
      await onSubmit(submitValues);
      setShowSuccess(true);
    } catch (err) {
      setShowSuccess(false);
      // Error feedback is handled via the error prop
    }
  };

  if (loading && !settings) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={32} />
          <Typography color="text.secondary">Loading application settings…</Typography>
        </Stack>
      </Paper>
    );
  }

  const isBusy = loading || saving;

  return (
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 } }}>
      <Stack spacing={3} component="form" onSubmit={handleSubmit}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Application settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tune screening thresholds and display preferences for the dashboard.
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
        {showSuccess && !error && !saving && (
          <Alert severity="success" onClose={() => setShowSuccess(false)}>
            Settings updated successfully.
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Theme color"
              type="color"
              fullWidth
              value={formValues.primaryColor}
              onChange={handleFieldChange('primaryColor')}
              InputLabelProps={{ shrink: true }}
              disabled={isBusy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Theme mode"
              fullWidth
              value={formValues.themeMode}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  themeMode: event.target.value as 'light' | 'dark'
                }))
              }
              disabled={isBusy}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Price minimum"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              value={formValues.priceMin}
              onChange={handleFieldChange('priceMin')}
              disabled={isBusy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Price maximum"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              value={formValues.priceMax}
              onChange={handleFieldChange('priceMax')}
              disabled={isBusy}
              error={formValues.priceMin.trim() !== '' && formValues.priceMax.trim() !== '' && Number(formValues.priceMin) > Number(formValues.priceMax)}
              helperText={
                formValues.priceMin.trim() !== '' && formValues.priceMax.trim() !== '' &&
                Number(formValues.priceMin) > Number(formValues.priceMax)
                  ? 'Price max should be greater than or equal to price min.'
                  : ' '
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Minimum RVOL"
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
              fullWidth
              value={formValues.minRvol}
              onChange={handleFieldChange('minRvol')}
              disabled={isBusy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Minimum % change"
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
              fullWidth
              value={formValues.minPctChange}
              onChange={handleFieldChange('minPctChange')}
              disabled={isBusy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Volume cap"
              type="number"
              inputProps={{ min: 0, step: 1000 }}
              fullWidth
              value={formValues.volumeCap}
              onChange={handleFieldChange('volumeCap')}
              disabled={isBusy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Starting capital"
              type="number"
              inputProps={{ min: 0, step: 100 }}
              fullWidth
              value={formValues.startingCapital}
              onChange={handleFieldChange('startingCapital')}
              disabled={isBusy}
            />
          </Grid>
        </Grid>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            type="submit"
            variant="contained"
            disabled={isBusy || hasValidationError}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={onRetry}
            disabled={isBusy}
          >
            Reload from server
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default SettingsPage;
