// Mongoose model for refresh tokens (Phase 3). We store only the token's
// SHA-256 hash: a leaked database can't be used to log in.
import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    // Unique index: lookups by hash are fast, and a hash can't exist twice.
    tokenHash: { type: String, required: true, unique: true },
    // Indexed so "sign out all my sessions" (revokeAllForUser) is fast.
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// TTL index: MongoDB itself deletes each document once its expiresAt has
// passed (`expireAfterSeconds: 0` = right at expiresAt). No cleanup job needed.
// The deletion runs about once a minute, so an expired token may live a little
// longer - that's why the service still checks expiresAt itself.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
