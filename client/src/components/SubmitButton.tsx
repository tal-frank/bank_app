// The submit button every form uses: disabled with a spinner while the request
// runs, so a double click can't send the form twice (Errors wireframe: "Loading").
import { Button, CircularProgress, type ButtonProps } from '@mui/material';

type Props = ButtonProps & {
  loading: boolean;
  /** Text while loading, e.g. "Sending…" on the transfer form. */
  loadingText?: string;
};

export default function SubmitButton({ loading, loadingText = 'Please wait…', children, disabled, ...rest }: Props) {
  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      fullWidth
      disabled={loading || disabled}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
      {...rest}
    >
      {loading ? loadingText : children}
    </Button>
  );
}
