// Date display. The API sends ISO strings in UTC ("2026-11-22T08:14:00.000Z");
// Intl shows them in the viewer's own time zone: "22 Nov 2026, 10:14".
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
