// Shared frame for every page: brand line, centred card, title and subtitle.
// Pages pass their content as children, so the layout is written once.
import type { ReactNode } from 'react';
import { Container, Paper, Typography } from '@mui/material';

type Props = {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  // Auth screens are narrow forms; the dashboard needs room for a table.
  maxWidth?: 'xs' | 'sm' | 'md';
};

export default function PageShell({ title, subtitle, children, maxWidth = 'xs' }: Props) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: 6 }}>
      <Typography variant="overline" color="primary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
        Bank App
      </Typography>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </Paper>
    </Container>
  );
}
