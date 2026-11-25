// Errors that repositories throw. They describe WHAT went wrong in storage
// terms, without saying HOW the data is stored. That way services catch the
// same error whether the repository uses a Map (Phase 2) or MongoDB
// (Phase 3, where the Mongo repository translates duplicate-key error 11000
// into this same class).
export class DuplicateEmailError extends Error {
  constructor(email) {
    super(`A user with email ${email} already exists`);
    this.name = 'DuplicateEmailError';
  }
}

// Thrown by transactionRepo.transfer() when the sender's balance is too low.
// The check happens INSIDE the atomic transfer step, never before it.
export class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient funds');
    this.name = 'InsufficientFundsError';
  }
}
