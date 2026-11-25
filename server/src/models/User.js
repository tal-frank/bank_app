// Mongoose model for users (Phase 3). A schema describes the shape of a
// document and its indexes. Only repositories/userRepo.js (and the transfer
// in transactionRepo.js) may use this model - the rest of the app talks to
// the repository, so it never knows MongoDB is underneath.
import mongoose from 'mongoose';

const { Schema } = mongoose;

// The pending OTP, embedded INSIDE the user document (not its own collection):
// it belongs to exactly one user and is always read together with it.
// `_id: false`: an embedded object doesn't need its own id.
const otpSchema = new Schema(
  {
    hash: { type: String, required: true }, // bcrypt hash, never the code itself
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    // `unique: true` creates a UNIQUE INDEX. The DATABASE refuses a second
    // user with the same email (error code 11000), even if two sign-ups
    // arrive at the same instant. A check in our code alone can't promise that.
    // The validation layer already trims + lowercases the email.
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: true },
    otpChannel: { type: String, required: true, enum: ['email', 'sms'] },
    isVerified: { type: Boolean, required: true, default: false },
    // Money = integer agorot. The validator rejects floats on save.
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'balance must be an integer (agorot)' },
    },
    otp: { type: otpSchema, default: null }, // null once verified
  },
  {
    // Mongoose sets createdAt for us. No updatedAt: nothing needs it.
    timestamps: { createdAt: true, updatedAt: false },
    // Drop Mongoose's internal "__v" version field from documents.
    versionKey: false,
  },
);

// TTL index: a pending (unverified) account lives only as long as its code.
// MongoDB's background job deletes a user once otp.expiresAt has passed
// (it runs about once a minute, so up to ~60 s late).
// Safe for verified users: verifying sets `otp: null`, and a TTL index skips
// documents whose field isn't a date. Resending a code moves expiresAt
// forward, which keeps the pending account alive for another 5 minutes.
// WARNING: never give a VERIFIED user an `otp` (e.g. for a later 2FA
// feature) without changing this, or MongoDB will delete that user.
userSchema.index({ 'otp.expiresAt': 1 }, { expireAfterSeconds: 0 });

export const User = mongoose.model('User', userSchema);
