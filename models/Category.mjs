import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  title: { // e.g., '🛒 Amazon Gift Cards'
    type: String,
    required: true,
  }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
