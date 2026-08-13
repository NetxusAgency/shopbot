import Paystack from 'paystack-api';
import dotenv from 'dotenv';

dotenv.config();

const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

export async function createPaymentLink(order, user) {
    try {
        await order.save();
        const response = await paystack.transaction.initialize({
            email: user.email,
            amount: order.totalAmount * 100, // Amount in kobo
            metadata: {
                order_id: order._id.toString(),
            }
        });
        return response.data.authorization_url;
    } catch (error) {
        console.error('Paystack initialization error:', error);
        return null; // Return null or throw an error to be handled by the caller
    }
}
