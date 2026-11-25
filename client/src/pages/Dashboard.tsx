// Dashboard (wireframe: Dashboard.dc.html): balance + transactions, 10 per page.
// APIs: GET /users/me (fresh balance), GET /transactions?page=&limit=.
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { getMe } from '../api/users';
import { listTransactions } from '../api/transactions';
import { getApiError, type ApiError } from '../api/errors';
import type { TransactionPage } from '../api/types';
import { useAuth } from '../auth/authContext';
import { formatAgorot, formatSignedAgorot } from '../utils/money';
import { formatDateTime } from '../utils/dates';

const PAGE_SIZE = 10;

// Phones: hide the Date and Type columns so Amount fits on screen. The date
// moves under the email; the +/− sign and colour already say in or out.
const hideOnPhone = { display: { xs: 'none', sm: 'table-cell' } } as const;

/** "?page=2" -> 2. Missing, "abc", "0", "-3", "1.5" -> 1. */
function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Success message from the Transfer page (router state). Copied into local
  // state once, then removed from the history entry below, so a reload or
  // Back/Forward doesn't show "Sent ₪25.00" again.
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  );
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) {
      navigate({ search: location.search }, { replace: true, state: null });
    }
  }, [location.state, location.search, navigate]);

  // The page number lives in the URL (?page=2): reload keeps it, Back/Forward
  // move between pages, and the link can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));

  // Bumping this number re-runs the load effect (the Retry button).
  const [reloadKey, setReloadKey] = useState(0);
  // Which request we want right now. A new page or a Retry = a new key.
  const requestKey = `${page}:${reloadKey}`;

  // The last page that loaded successfully (kept on screen while the next loads).
  const [data, setData] = useState<TransactionPage | null>(null);
  // Which request the last reply answered, and whether it failed.
  const [settled, setSettled] = useState<{ key: string; error: ApiError | null } | null>(null);
  // "Loading" is DERIVED, not stored: if the last reply isn't for the current
  // key, we're waiting for one. (Storing it would mean setLoading(true) inside
  // the effect, which costs an extra render; the linter flags that.)
  const loading = settled?.key !== requestKey;
  const error = loading ? null : settled.error;

  // Fresh balance every time the dashboard opens: the user saved at login may
  // be stale (someone may have sent money since). setUser shares it app-wide.
  // A failure here is harmless: we keep showing the balance we already have.
  useEffect(() => {
    let ignore = false;
    getMe()
      .then((me) => !ignore && setUser(me))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [setUser]);

  // Load one page of transactions whenever the page (or reloadKey) changes.
  useEffect(() => {
    // `ignore`: if the user clicks Next twice quickly, the reply for the
    // earlier page may arrive LAST. Its effect was cleaned up, so it's dropped
    // instead of overwriting the newer page.
    let ignore = false;
    listTransactions(page, PAGE_SIZE)
      .then((res) => {
        if (ignore) return;
        setData(res);
        setSettled({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (!ignore) setSettled({ key: requestKey, error: getApiError(err) });
      });
    return () => {
      ignore = true;
    };
  }, [page, requestKey]);

  // At least 1, so an empty history reads "Page 1 of 1".
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // ?page=99 past the end (or the last page emptied): go to the last real page.
  // `replace`: the bad URL doesn't stay in history for Back to return to.
  useEffect(() => {
    if (data && page > totalPages) {
      setSearchParams({ page: String(totalPages) }, { replace: true });
    }
  }, [data, page, totalPages, setSearchParams]);

  const goToPage = (p: number) => setSearchParams({ page: String(p) });

  return (
    <Stack spacing={3}>
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {/* ---- Balance card ---- */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography color="text.secondary">Current balance</Typography>
            <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
              {user ? formatAgorot(user.balance) : <Skeleton width={200} />}
            </Typography>
          </Box>
          <Button variant="contained" size="large" component={RouterLink} to="/transfer">
            Send money
          </Button>
        </Stack>
      </Paper>

      {/* ---- Transactions ---- */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Transactions
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>
                Retry
              </Button>
            }
          >
            {error.message}
          </Alert>
        )}

        {/* On narrow screens the table scrolls sideways inside this box,
            instead of making the whole page scroll. */}
        <TableContainer>
          <Table size="small" aria-label="Transactions">
            <TableHead>
              <TableRow>
                <TableCell sx={hideOnPhone}>Date</TableCell>
                <TableCell sx={hideOnPhone}>Type</TableCell>
                <TableCell>With</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            {/* While changing pages, keep the old rows but fade them, so the
                table doesn't jump; skeleton rows only on the very first load. */}
            <TableBody sx={{ opacity: loading && data ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              {!data && loading &&
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {[0, 1, 2, 3].map((c) => (
                      <TableCell key={c} sx={c < 2 ? hideOnPhone : undefined}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {/* total, not items.length: a page past the end is also empty,
                  but that user HAS transactions (we redirect to the last page). */}
              {data && data.total === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No transactions yet. Money you send or receive will show up here.
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell sx={{ ...hideOnPhone, whiteSpace: 'nowrap' }}>
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                  <TableCell sx={hideOnPhone}>{t.direction === 'received' ? 'Received' : 'Sent'}</TableCell>
                  {/* wordBreak: a long email wraps instead of widening the table. */}
                  <TableCell sx={{ wordBreak: 'break-all' }}>
                    {t.counterpartyEmail}
                    {/* Phones only: the date moves here as a small second line. */}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: 'block', sm: 'none' }, wordBreak: 'normal' }}
                    >
                      {formatDateTime(t.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                      // Received = green; sent = normal text (not red: sending isn't an error).
                      color: t.amount > 0 ? 'success.main' : 'text.primary',
                    }}
                  >
                    {formatSignedAgorot(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ---- Pager ---- */}
        {data && data.total > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Page {Math.min(page, totalPages)} of {totalPages} · {PAGE_SIZE} per page
            </Typography>
            <Button onClick={() => goToPage(page - 1)} disabled={loading || page <= 1}>
              Previous
            </Button>
            <Button onClick={() => goToPage(page + 1)} disabled={loading || page >= totalPages}>
              Next
            </Button>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
