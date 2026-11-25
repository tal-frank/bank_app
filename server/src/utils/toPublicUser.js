// Turns a stored user record into the `User` shape from openapi.yaml.
//
// This is a WHITELIST: it copies only the fields that may be shown. If
// someone later adds a field to the stored record, it stays private unless
// it's added here on purpose. passwordHash and otp can never leak this way.
// Every response that contains a user must go through this function.
export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    balance: user.balance,
    createdAt: user.createdAt,
  };
}
