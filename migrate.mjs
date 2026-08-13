import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.mjs';
import Category from './models/Category.mjs';
import GiftCard from './models/GiftCard.mjs';

dotenv.config();

const categories = [
  { name: 'Amazon', slug: 'amazon', title: '🛒 Amazon Gift Cards' },
  { name: 'Steam', slug: 'steam', title: '🎮 Steam Gift Cards' },
  { name: 'Google Play', slug: 'google', title: '📱 Google Play Gift Cards' },
  { name: 'Apple', slug: 'apple', title: '🍎 Apple Gift Cards' },
  { name: 'eBay', slug: 'ebay', title: '🛍️ eBay Gift Cards' },
];

const products = [
  // Amazon
  { name: 'Amazon Gift Card $5', price: 5.00, categorySlug: 'amazon' },
  { name: 'Amazon Gift Card $10', price: 10.00, categorySlug: 'amazon' },
  { name: 'Amazon Gift Card $25', price: 25.00, categorySlug: 'amazon' },
  // Steam
  { name: 'Steam Wallet Card $5', price: 5.00, categorySlug: 'steam' },
  { name: 'Steam Wallet Card $10', price: 10.00, categorySlug: 'steam' },
  { name: 'Steam Wallet Card $20', price: 20.00, categorySlug: 'steam' },
  // Google Play
  { name: 'Google Play Card $10', price: 10.00, categorySlug: 'google' },
  { name: 'Google Play Card $15', price: 15.00, categorySlug: 'google' },
  { name: 'Google Play Card $25', price: 25.00, categorySlug: 'google' },
  // Apple
  { name: 'Apple Gift Card $10', price: 10.00, categorySlug: 'apple' },
  { name: 'Apple Gift Card $15', price: 15.00, categorySlug: 'apple' },
  { name: 'Apple Gift Card $25', price: 25.00, categorySlug: 'apple' },
  // eBay
  { name: 'eBay Gift Card $10', price: 10.00, categorySlug: 'ebay' },
  { name: 'eBay Gift Card $25', price: 25.00, categorySlug: 'ebay' },
  { name: 'eBay Gift Card $50', price: 50.00, categorySlug: 'ebay' },
];

// Generates a simple unique gift card code
const generateGiftCardCode = (productName) => {
  const prefix = productName.slice(0, 4).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const migrateData = async () => {
  await connectDB();

  try {
    // Clear existing data
    await Category.deleteMany({});
    await Product.deleteMany({});
    await GiftCard.deleteMany({});
    console.log('Cleared existing data.');

    // Insert categories and get their IDs
    const createdCategories = await Category.insertMany(categories);
    const categoryMap = createdCategories.reduce((map, cat) => {
      map[cat.slug] = cat._id;
      return map;
    }, {});
    console.log('Categories inserted.');

    // Prepare products with correct category IDs
    const productsToCreate = products.map(p => ({
      ...p,
      description: `A ${p.name} for all your needs.`,
      currency: 'USD',
      isDigital: true,
      validityDays: 365,
      category: categoryMap[p.categorySlug],
    }));

    const createdProducts = await Product.insertMany(productsToCreate);
    console.log('Products inserted.');

    // Create a stock of gift cards for each product
    let giftCardsToCreate = [];
    for (const product of createdProducts) {
      for (let i = 0; i < 10; i++) { // Create 10 gift cards per product
        giftCardsToCreate.push({
          product: product._id,
          code: generateGiftCardCode(product.name),
        });
      }
    }

    await GiftCard.insertMany(giftCardsToCreate);
    console.log('Gift cards inserted.');

    console.log('Database migration successful!');
    process.exit();
  } catch (error) {
    console.error('Error migrating data:', error);
    process.exit(1);
  }
};

migrateData();
