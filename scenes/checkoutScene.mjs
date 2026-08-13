import { Scenes, Markup } from 'telegraf';
import Order from '../models/Order.mjs';
import GiftCard from '../models/GiftCard.mjs';
import { getProducts } from '../utils/products.mjs';
import { sendGiftCardEmail } from '../utils/mailer.mjs'; // Assuming you have this function
import translateText from '../utils/translator.mjs';

import { createPaymentLink } from '../utils/payment.mjs';

const checkoutWizard = new Scenes.WizardScene(
    'checkout-wizard',
    async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const cart = ctx.session.cart || {};
        if (Object.keys(cart).length === 0) {
            await ctx.reply(await translateText('Your cart is empty. Nothing to checkout.', lang));
            return ctx.scene.leave();
        }

        const productIds = Object.keys(cart);
        const productObjects = await getProducts({ _id: { $in: productIds } });
        const productMap = productObjects.reduce((map, p) => ({ ...map, [p._id.toString()]: p }), {});

        let total = 0;
        let orderSummary = `${await translateText('🛒 *Your Order Summary*', lang)}

`;
        let productsForOrder = [];

        for (const productId in cart) {
            const product = productMap[productId];
            const quantity = cart[productId];
            if (product) {
                const price = product.price * quantity;
                total += price;
                orderSummary += `• ${product.name} x ${quantity} - ${price.toFixed(2)}
`;
                productsForOrder.push({ product: product, quantity, price: product.price });
            }
        }

        orderSummary += `
💰 *${await translateText('Total Amount', lang)}: ${total.toFixed(2)}*`;

        ctx.wizard.state.order = {
            user: ctx.session.user.id,
            products: productsForOrder,
            totalAmount: total,
            paymentStatus: 'pending',
        };

        await ctx.replyWithMarkdown(orderSummary);
        await ctx.reply(await translateText('Please choose your payment method:', lang), Markup.inlineKeyboard([
            Markup.button.callback(await translateText('💳 Pay with Paystack', lang), 'pay_paystack'),
            Markup.button.callback(await translateText('Cancel', lang), 'cancel_checkout')
        ]));
    }
);

checkoutWizard.action('pay_paystack', async (ctx) => {
    await ctx.answerCbQuery();
    const lang = ctx.session.lang || 'EN';
    await ctx.reply(await translateText('⏳ We are generating your payment link...', lang));
    
    const orderData = ctx.wizard.state.order;
    const order = new Order(orderData);

    const paymentLink = await createPaymentLink(order, ctx.session.user);
    if (paymentLink) {
        await ctx.reply(await translateText('Please complete your payment by visiting this link: ' + paymentLink, lang));
    } else {
        await ctx.reply(await translateText('Failed to generate payment link. Please try again later.', lang));
    }

    return ctx.scene.leave();
});

checkoutWizard.action('cancel_checkout', async (ctx) => {
    await ctx.answerCbQuery();
    const lang = ctx.session.lang || 'EN';
    await ctx.reply(await translateText('Checkout cancelled.', lang));
    return ctx.scene.leave();
});

export default checkoutWizard;