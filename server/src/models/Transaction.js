// Mongoose model for transfers (Phase 3). One document per transfer; the API
// shows it as 'sent' to one side and 'received' to the other.
import mongoose from 'mongoose';

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    // ObjectId references to the two users. `ref` documents the link (and
    // would allow .populate()); we don't need populate because...
    fromId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // ...the emails are copied in at transfer time: listing needs no user
    // lookups, and a payment record keeps what was true when it happened.
    fromEmail: { type: String, required: true },
    toEmail: { type: String, required: true },
    // Always positive, integer agorot. The sign is added per viewer in the API.
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amount must be an integer (agorot)' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Indexes for "my transactions, newest first". The list query asks for
// fromId = me OR toId = me; MongoDB uses one index per side of the OR, and
// the createdAt part lets it return them already sorted (no sort in memory).
transactionSchema.index({ fromId: 1, createdAt: -1 });
transactionSchema.index({ toId: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
