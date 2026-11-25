// TypeScript copies of the response shapes in server/src/docs/openapi.yaml.
// The spec is the source of truth: if a schema changes there, change it here.
// (Later this could be generated from the spec; by hand keeps the lesson visible.)

/** components.schemas.User - money is integer agorot (523400 = ₪5,234.00). */
export type User = {
  id: string;
  email: string;
  phone: string;
  balance: number;
  createdAt: string; // ISO date-time
};

export type OtpChannel = 'email' | 'sms';

/** Returned by signup and resend-otp. The code itself is never returned. */
export type SignupResponse = {
  email: string;
  otpChannel: OtpChannel;
  otpExpiresAt: string; // ISO date-time
};

/** Returned by login and verify-otp: token + user, so the dashboard renders at once. */
export type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // seconds
  user: User;
};

/** Returned by /auth/refresh: a new token only, no user. */
export type RefreshResponse = Omit<AuthResponse, 'user'>;

/**
 * components.schemas.Transaction - one transfer, seen from the CALLER's side.
 * amount is signed agorot: -2500 = you sent ₪25, +2500 = you received ₪25.
 */
export type Transaction = {
  id: string;
  direction: 'sent' | 'received';
  counterpartyEmail: string; // the OTHER person
  amount: number;
  createdAt: string; // ISO date-time
};

/** One page of GET /transactions. total = all transactions, for "Page 1 of N". */
export type TransactionPage = {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
};

/** Reply to POST /transactions: the new row + the sender's new balance (agorot). */
export type TransferResponse = {
  transaction: Transaction;
  balance: number;
};

/** The spec's Error.code enum. The UI switches on these, never on message text. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_TAKEN'
  | 'USER_NOT_FOUND'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS_EXCEEDED'
  | 'OTP_DELIVERY_FAILED'
  | 'ALREADY_VERIFIED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_NOT_VERIFIED'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'RECIPIENT_NOT_FOUND'
  | 'SELF_TRANSFER'
  | 'INSUFFICIENT_FUNDS'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

/** The one error shape every failed response uses. */
export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>; // only for VALIDATION_ERROR
  };
};
