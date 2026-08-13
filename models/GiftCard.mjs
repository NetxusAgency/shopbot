import mongoose from 'mongoose';

const giftCardSchema = new mongoose.Schema({
  product: { // The type of gift card, e.g., "Amazon $5"
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  isSold: {
    type: Boolean,
    default: false,
  },
  user: { // Who owns this card
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // Becomes non-null when sold
  },
  order: { // The order in which it was purchased
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  }
}, { timestamps: true });

const GiftCard = mongoose.model('GiftCard', giftCardSchema);

export default GiftCard;
