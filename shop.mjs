import { Telegraf,Scenes,session,Markup } from 'telegraf'
import { message } from 'telegraf/filters'
import connectDB from './utils/database.mjs';
import signupScene from './scenes/signupScene.mjs';
import dotenv from 'dotenv';
import loginScene from './scenes/loginScene.mjs';
import translateText from './utils/translator.mjs';
import forgotPasswordScene from './scenes/forgotPasswordScene.mjs';
import checkoutWizard from './scenes/checkoutScene.mjs';
import { userMenuKeyboard } from './utils/menus.mjs';
import { registerActions } from './utils/actions.mjs';
import Order from './models/Order.mjs';
import GiftCard from './models/GiftCard.mjs';
import crypto from 'crypto';
import express from 'express';
import bodyParser from 'body-parser';
import { sendGiftCardEmail } from './utils/mailer.mjs';

dotenv.config();

// Connect to MongoDB
connectDB();

const bot = new Telegraf(process.env.BOT_TOKEN)



const stage = new Scenes.Stage([signupScene,loginScene,forgotPasswordScene, checkoutWizard]);


// Middlewares
bot.use(session());
bot.use((ctx, next) => {
    ctx.state.role = 'user' // You can replace 'user' with logic to assign roles
    return next()
  })
bot.use((ctx, next) => {
  ctx.session ??= {};
  ctx.session.lang ??= 'EN'; // Default language
  return next();
});
bot.use((ctx, next) => {
  if (ctx.callbackQuery && ctx.session.__scenes?.current) {
    const query = ctx.callbackQuery.data;

    // Define queries that should not cause an exit from any scene
    const shouldNotExit = [
      'qty_up', 'qty_down', 'remove_', 'cart_item', 'cart_checkout', 'check_address', 'check_payment', 'payment_cash', 'payment_card', 'pay_paystack', 'cancel_checkout'
    ].some(prefix => query.startsWith(prefix));

    if (!shouldNotExit) {
      ctx.session.__scenes = {}; // Manually leave the scene
    }
  }
  return next();
});
bot.use(stage.middleware());

bot.on('callback_query', async (ctx, next) => {
  const allowedActions = ['login', 'signup', 'help', 'lang', 'forgot', 'contact'];
  const lang = ctx.session.lang || 'EN';
  const query = ctx.callbackQuery?.data;

  if (!ctx.session.user && query && !allowedActions.some(action => query.startsWith(action))) {
    await ctx.answerCbQuery();
    return ctx.reply(await translateText('⚠️ You must be logged in to access this feature.', lang));
  }
  return next();
});

//Handling Commands

bot.command('quit', async (ctx) => {
  await ctx.leaveChat()
})
bot.command('start', async (ctx) => {
  const lang = ctx.session.lang || 'EN';
  const greetings = await translateText('Welcome to our Bot! Choose one action from below buttons to get started:',lang)
  await ctx.reply(greetings,
    Markup.inlineKeyboard([[Markup.button.callback(await translateText('Login', lang),'login'),
                            Markup.button.callback(await translateText('Signup', lang),'signup'),
                            Markup.button.callback(await translateText('Help', lang),'help')
                          ],
                           [Markup.button.callback(await translateText('Language', lang),'lang'),
                            Markup.button.callback(await translateText('Forget password', lang),'forgot')
                          ],
                           [
                            Markup.button.callback(await translateText('Contact support', lang),'contact')
                          ],
  ]))
})



// Register all bot actions
registerActions(bot);

//set server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json()); // To parse JSON webhook body

// General request logger to debug reachability
app.use((req, res, next) => {
  console.log(`🌐 Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) {
    console.warn('❌ Invalid signature on Paystack webhook');
    return res.sendStatus(400);
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    console.log(`✅ Paystack Webhook: Received charge.success for order ${event.data.metadata?.order_id}`);
    try {
      const orderId = event.data.metadata.order_id;
      const order = await Order.findById(orderId).populate('user');
      
      if (!order) {
        console.error(`❌ Paystack Webhook: Order ${orderId} not found`);
        return res.sendStatus(404);
      }

      if (order.paymentStatus === 'pending') {
        order.paymentStatus = 'completed';
        order.transactionId = event.data.reference;
        await order.save();
        console.log(`✅ Paystack Webhook: Order ${orderId} marked as completed`);

        // Assign available gift cards
        let assignedGiftCards = [];
        for (const item of order.products) {
          const giftCards = await GiftCard.find({ product: item.product, isSold: false }).limit(item.quantity);
          console.log(`📦 Paystack Webhook: Found ${giftCards.length} gift cards for product ${item.product}`);
          for (const card of giftCards) {
            card.isSold = true;
            card.user = order.user._id;
            card.order = order._id;
            await card.save();
            assignedGiftCards.push(card.code);
          }
        }

        // Send Telegram message
        if (order.user.telegramId) {
          const msg = await translateText(
            '🎉 Your order is complete! The gift card codes have been sent to your email.',
            order.user.preferredLang || 'en'
          );
          await bot.telegram.sendMessage(order.user.telegramId, msg);
          console.log(`📱 Paystack Webhook: Telegram message sent to ${order.user.telegramId}`);
        } else {
          console.warn(`⚠️ Paystack Webhook: No telegramId for user ${order.user._id}`);
        }

        // Optionally send by email
       await sendGiftCardEmail(order.user.email, assignedGiftCards, order._id);
       console.log(`📧 Paystack Webhook: Gift card email sent to ${order.user.email}`);
      } else {
        console.log(`ℹ️ Paystack Webhook: Order ${orderId} already has status ${order.paymentStatus}`);
      }
    } catch (err) {
      console.error('🔥 Error processing Paystack webhook:', err);
    }
  } else {
    console.log(`ℹ️ Paystack Webhook: Received unhandled event type: ${event.event}`);
  }

  res.sendStatus(200);
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on http://localhost:${PORT}`);
});

// Self-keepalive: ping our own public URL so Render's free tier
// doesn't spin the app down after 15 minutes of no inbound traffic.
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.BOT_URL || '').replace(/\/$/, '');
if (PUBLIC_URL) {
  setInterval(async () => {
    try {
      await fetch(`${PUBLIC_URL}/health`);
    } catch (err) {
      console.error('⚠️ Keep-alive ping failed:', err.message);
    }
  }, 10 * 60 * 1000);
  console.log(`🔁 Keep-alive enabled, pinging ${PUBLIC_URL}/health every 10 min`);
}




// bot replies to other messages 
bot.on(message('text'), async (ctx) => {
  const lang = ctx.session.lang || 'EN';
  await ctx.reply(await translateText(`Hello ${ctx.state.role}`, lang))
})
bot.on('callback_query', (ctx) => {
  console.log('Received callback query:', ctx.callbackQuery.data);
});


// starting bot
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))