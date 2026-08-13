import Product from '../models/Product.mjs';

// This function will be used by the application to get products.
export const getProducts = async (filter = {}) => {
  try {
    const products = await Product.find(filter);
    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
};
