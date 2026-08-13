import { Markup } from 'telegraf';
import { format } from 'date-fns';
import User from '../models/User.mjs';
import GiftCard from '../models/GiftCard.mjs';
import Category from '../models/Category.mjs';
import { userMenuKeyboard } from './menus.mjs';
import { getProducts } from './products.mjs';
import translateText from './translator.mjs';

// Helper function to get products for the cart
async function getCartProducts(cart) {
    if (!cart || Object.keys(cart).length === 0) {
        return { productMap: {}, total: 0 };
    }
    const productIds = Object.keys(cart);
    const productObjects = await getProducts({ _id: { $in: productIds } });

    const productMap = productObjects.reduce((map, product) => {
        map[product._id.toString()] = product;
        return map;
    }, {});

    let total = 0;
    for (const productId in cart) {
        const item = productMap[productId];
        if (item) {
            total += item.price * cart[productId];
        }
    }

    return { productMap, total };
}

// Check a product image URL is actually fetchable before asking
// Telegram to download it (avoids 90s hangs / crashes on dead links)
async function isImageReachable(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function registerActions(bot) {
    bot.action('signup', async (ctx) => {
        ctx.answerCbQuery();
        ctx.scene.enter('signup-wizard');
    });

    bot.action('login', async (ctx) => {
        await ctx.answerCbQuery();
        if (ctx.session.user) {
            const lang = ctx.session.lang || 'EN';
            const logged = await translateText('✅ You are already logged in as ', lang)
            await ctx.reply(logged + ' ' + ctx.session.user.email);
            const chooseAction = await translateText('Choose an action from below:', lang);
            await ctx.reply(chooseAction,await userMenuKeyboard(lang));
            return
        }
        ctx.scene.enter('login-wizard');
    });

    bot.action('contact', async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const contactRpl = await translateText('for help, contact @benetxus', lang)
        await ctx.answerCbQuery();
        await ctx.reply(contactRpl);
    });

    bot.action('help', async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const helpRpl = await translateText('I will add a video that will help the user here', lang)
        await ctx.answerCbQuery();
        await ctx.reply(helpRpl);
    });

    bot.action('lang', async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const langRpl = await translateText('🌍 Choose a language:', lang)
        await ctx.answerCbQuery();
        await ctx.reply(langRpl, Markup.inlineKeyboard([
            [Markup.button.callback(await translateText('🇬🇧 English', lang), 'lang_EN')],
            [Markup.button.callback(await translateText('🇫🇷 French', lang), 'lang_FR')],
            [Markup.button.callback(await translateText('🇪🇸 Spanish', lang), 'lang_ES')],
            [Markup.button.callback(await translateText('🇸🇦 Arabic', lang), 'lang_AR')],
            [Markup.button.callback(await translateText('🇩🇪 German', lang), 'lang_DE')],
        ]));
    });

    bot.action(/^lang_(.+)/, async (ctx) => {
        const selectedLang = ctx.match[1].toUpperCase();
        ctx.session.lang = selectedLang;

        const confirmation = await translateText('✅ Language changed successfully!', selectedLang);
        await ctx.answerCbQuery();
        await ctx.reply(confirmation);
    });

    bot.action('forgot', async (ctx) => {
        await ctx.answerCbQuery();
        ctx.scene.enter('forgot-password-wizard');
    });

    bot.action('menu_profile', async (ctx) => {
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';

        const userId = ctx.session.user?.id;
        if (!userId) {
            const notLoggedIn = await translateText('⚠️ You must be logged in to view your profile.', lang);
            return ctx.reply(notLoggedIn);
        }

        const user = await User.findById(userId);
        if (!user) {
            const userNotFound = await translateText('❌ User not found. Please login again.', lang);
            return ctx.reply(userNotFound);
        }

        const joined = format(user.createdAt, 'PPP'); // e.g., Apr 12, 2025
        const escape = (text) => text.toString().replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');

        const profileText = `
    👤 *Your Profile*
    
    📧 *Email:* ${escape(user.email)}
    🆔 *Telegram ID:* ${user.telegramId}
    🌍 *Language:* ${escape(user.preferredLang)}
    ✅ *Verified:* ${user.verified ? 'Yes' : 'No'}
    📅 *Joined:* ${escape(joined)}
    `;
        await ctx.replyWithMarkdownV2(profileText);
    });

    bot.action('menu_giftcards', async (ctx) => {
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';
        const userId = ctx.session.user?.id;
        if (!userId) {
            const notLoggedIn = await translateText('⚠️ You must be logged in to view your gift cards.', lang);
            return ctx.reply(notLoggedIn);
        }

        const giftCards = await GiftCard.find({ user: userId }).populate('product');

        if (giftCards.length === 0) {
            const noGiftCards = await translateText("You don't have any gift cards yet. Go buy some!", lang);
            return ctx.reply(noGiftCards);
        }

        let message = `${await translateText('🎁 *Your Gift Cards*', lang)}

`;
        for (const card of giftCards) {            message += "*" + card.product.name + "*\n";            message += "Code: `" + card.code + "`\n\n";        }

        await ctx.replyWithMarkdown(message);
    });

    bot.action('menu_cart', async (ctx) => {
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';
        const cart = ctx.session.cart || {};
        if (Object.keys(cart).length === 0) {
            const cartEmpty = await translateText('🛒 Your cart is empty.', lang);
            return ctx.reply(cartEmpty);
        }

        const { productMap, total } = await getCartProducts(cart);

        const lines = [await translateText('🛒 *Your cart:*', lang)];
        const buttons = [];

        for (const productId in cart) {
            const qty = cart[productId];
            const item = productMap[productId];
            if (!item) continue;

            lines.push(`• ${item.name} × ${qty}`);
            buttons.push([Markup.button.callback(`${item.name} × ${qty} 🔽`, `cart_item_${productId}`)]);
        }

        lines.push(`
💰 *${await translateText('Total', lang)}: ${total.toFixed(2)}*`);
        buttons.push([
            Markup.button.callback(await translateText('▶️ Checkout', lang), 'cart_checkout'),
            Markup.button.callback(await translateText('🛍️ Go to shopping', lang), 'menu_catalogue')
        ]);

        await ctx.reply(lines.join('\n'), {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });
    });

    bot.action('menu_catalogue', async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const saferpl = await translateText('*Choose a category*', lang);
        await ctx.answerCbQuery();

        const categories = await Category.find({});
        const buttons = categories.map(cat => Markup.button.callback(cat.title, `cat_${cat.slug}`))
        const buttonGrid = [];
        for (let i = 0; i < buttons.length; i += 2) {
            buttonGrid.push(buttons.slice(i, i + 2));
        }
        buttonGrid.push([Markup.button.callback(await translateText('Main Menu', lang), 'cat_main')])

        await ctx.replyWithMarkdownV2(saferpl, Markup.inlineKeyboard(buttonGrid));
    });

    bot.action(/^cat_(.+)/, async (ctx) => {
        const categorySlug = ctx.match[1]; // 'amazon', 'steam', etc.
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';

        if (categorySlug === 'main') {
            const welcomeBack = await translateText('✅ Welcome back, You now have access to features.', lang);
            await ctx.reply(welcomeBack, userMenuKeyboard(lang));
            return;
        }

        const category = await Category.findOne({ slug: categorySlug });
        if (!category) {
            const unknownCategory = await translateText('❌ Unknown category.', lang);
            return ctx.reply(unknownCategory);
        }

        const products = await getProducts({ category: category._id });

        if (products.length === 0) {
            const noGiftCardsAvailable = await translateText(`Sorry, no ${category.name} gift cards are available at the moment.`, lang);
            await ctx.reply(noGiftCardsAvailable);
            return;
        }

        const buttons = products.map(product => {
            return [Markup.button.callback(product.name, `buy_${product._id}`)]
        });

        buttons.push([Markup.button.callback(await translateText('🔙 Back', lang), 'menu_catalogue')]);

        await ctx.reply(category.title, Markup.inlineKeyboard(buttons));
    });

    bot.action(/^buy_(.+)/, async (ctx) => {
        const productId = ctx.match[1]; // This is now the MongoDB _id
        const lang = ctx.session.lang || 'EN';

        const product = (await getProducts({ _id: productId }))[0];

        if (!product) {
            const productNotFound = await translateText('❌ Product not found.', lang);
            await ctx.answerCbQuery(productNotFound);
            const sorryNotAvailable = await translateText('Sorry, this product is no longer available.', lang);
            return ctx.reply(sorryNotAvailable);
        }

        await ctx.answerCbQuery();

        // Fetch the category for the back button
        const category = await Category.findById(product.category);
        const backButton = category ? Markup.button.callback(await translateText('◀️ Back', lang), `cat_${category.slug}`) : Markup.button.callback(await translateText('◀️ Back', lang), 'menu_catalogue');

        const fallbackImage = 'https://giftcards.africa/wp-content/uploads/2023/07/fbef9b57-e0b0-4ead-aee3-fdc2bc80e2db.png';
        const imageUrl = product.image || fallbackImage;
        const canSendPhoto = await isImageReachable(imageUrl);

        if (canSendPhoto) {
            try {
                await ctx.replyWithPhoto(
                    { url: imageUrl },
                    {
                        caption: `${product.name}

 ${await translateText('Price', lang)}: ${product.price}$ / ${await translateText('card', lang)}`,
                        parse_mode: 'Markdown',
                        reply_markup: Markup.inlineKeyboard([
                            [backButton, Markup.button.callback(await translateText('Buy', lang), `checkout_${product._id}`)]
                        ]).reply_markup
                    }
                );
            } catch (error) {
                console.error('Error sending photo:', error);
                await ctx.reply(`${product.name}

 ${await translateText('Price', lang)}: ${product.price}$ / ${await translateText('card', lang)}`, {
                    parse_mode: 'Markdown',
                    reply_markup: Markup.inlineKeyboard([
                        [backButton, Markup.button.callback(await translateText('Buy', lang), `checkout_${product._id}`)]
                    ]).reply_markup
                });
            }
        } else {
            await ctx.reply(`${product.name}

 ${await translateText('Price', lang)}: ${product.price}$ / ${await translateText('card', lang)}`, {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard([
                    [backButton, Markup.button.callback(await translateText('Buy', lang), `checkout_${product._id}`)]
                ]).reply_markup
            });
        }
    });

    bot.action(/^checkout_(.+)/, async (ctx) => {
        const productId = ctx.match[1];
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';

        if (!ctx.session.cart) ctx.session.cart = {};
        
        // Add 1 of the item to the cart
        ctx.session.cart[productId] = (ctx.session.cart[productId] || 0) + 1;

        await ctx.reply(await translateText('✅ Added to cart!', lang), {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: await translateText('🛒 View Cart', lang), callback_data: 'menu_cart' },
                        { text: await translateText('🛍️ Continue Shopping', lang), callback_data: 'menu_catalogue' }
                    ]
                ]
            }
        });
    });

    bot.action(/^cart_item_(.+)$/, async (ctx) => {
        const productId = ctx.match[1];
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';

        const cart = ctx.session.cart || {};
        if (Object.keys(cart).length === 0) {
            const cartEmpty = await translateText('🛒 Your cart is empty.', lang);
            return ctx.editMessageText(cartEmpty, {
                reply_markup: {
                    inline_keyboard: [[{ text: '🛍️ Go to shopping', callback_data: 'menu_catalogue' }]]
                }
            });
        }

        // Toggle logic
        ctx.session.cartExpanded = (ctx.session.cartExpanded === productId) ? null : productId;

        const { productMap, total } = await getCartProducts(cart);
        const inlineKeyboard = [];

        for (const pId in cart) {
            const product = productMap[pId];
            if (!product) continue;

            const qty = cart[pId];
            const expanded = ctx.session.cartExpanded === pId;
            const label = expanded ? `${product.name} ▲` : `${product.name} × ${qty} ▼`;

            inlineKeyboard.push([{ text: label, callback_data: `cart_item_${pId}` }]);

            if (expanded) {
                inlineKeyboard.push([
                    { text: await translateText('➖', lang), callback_data: `qty_down_${pId}` },
                    { text: `${qty}`, callback_data: 'qty_none' },
                    { text: await translateText('➕', lang), callback_data: `qty_up_${pId}` },
                    { text: await translateText('❌ Remove', lang), callback_data: `remove_${pId}` }
                ]);
            }
        }

        inlineKeyboard.push([
            { text: await translateText('▶️ Checkout', lang), callback_data: 'cart_checkout' },
            { text: await translateText('🛍️ Go to shopping', lang), callback_data: 'menu_catalogue' }
        ]);

        const text = `${await translateText('🛒 *Your cart:*', lang)}

💰 *${await translateText('Total', lang)}: ${total.toFixed(2)}*`;

        try {
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: inlineKeyboard }
            });
        } catch (err) {
            if (!err.description?.includes('message is not modified')) console.error(err);
        }
    });

    bot.action(/^qty_up_(.+)$/, async (ctx) => {
        const productId = ctx.match[1];
        const cart = ctx.session.cart || {};
        cart[productId] = (cart[productId] || 0) + 1;
        ctx.session.cart = cart;
        ctx.session.cartExpanded = productId; // Keep it expanded
        
        // Trigger a redraw of the cart view
        return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.update.callback_query, data: `cart_item_${productId}` } }, ctx.bot);
    });

    bot.action(/^qty_down_(.+)$/, async (ctx) => {
        const productId = ctx.match[1];
        const cart = ctx.session.cart || {};

        if (cart[productId] > 1) {
            cart[productId] -= 1;
        } else {
            delete cart[productId];
            if (ctx.session.cartExpanded === productId) {
                ctx.session.cartExpanded = null; // Collapse if removed
            }
        }
        ctx.session.cart = cart;
        ctx.session.cartExpanded = productId; // Keep it expanded if not removed

        // Trigger a redraw of the cart view
        return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.update.callback_query, data: `cart_item_${productId}` } }, ctx.bot);
    });

    bot.action(/^remove_(.+)$/, async (ctx) => {
        const productId = ctx.match[1];
        const cart = ctx.session.cart || {};
        const lang = ctx.session.lang || 'EN';
        
        if (cart[productId]) {
            delete cart[productId];
            if (ctx.session.cartExpanded === productId) {
                ctx.session.cartExpanded = null;
            }
            ctx.session.cart = cart;
            await ctx.answerCbQuery(await translateText('🗑 Removed from cart', lang));
        } else {
            await ctx.answerCbQuery(await translateText('Item not in cart.', lang));
        }

        // Trigger a redraw of the cart view, using a generic cart_item_ call to refresh
        const anyProductIdInCart = Object.keys(cart)[0] || productId;
        return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.update.callback_query, data: `cart_item_${anyProductIdInCart}` } }, ctx.bot);
    });

    bot.action('cart_checkout', async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const cart = ctx.session.cart || {};
        if (Object.keys(cart).length === 0) {
            return ctx.answerCbQuery(await translateText('Your cart is empty.', lang));
        }
        return ctx.scene.enter('checkout-wizard');
    });

    bot.action('check_address', async (ctx) => {
        ctx.session.awaitingAddress = true;
        await ctx.answerCbQuery();
        const lang = ctx.session.lang || 'EN';
        await ctx.reply(await translateText('📍 Please type your delivery address:', lang));
        console.log(ctx.session.awaitingAddress);
    });

    bot.on('text', async (ctx, next) => {
        const lang = ctx.session.lang || 'EN';
        if (ctx.session.awaitingAddress) {
            ctx.session.address = ctx.message.text;
            ctx.session.awaitingAddress = false;
            await ctx.reply(await translateText('✅ Address saved!', lang));
            // Redirect to checkout screen again
            return bot.handleUpdate({
                ...ctx.update,
                callback_query: {
                    ...ctx.update.callback_query,
                    data: 'cart_checkout'
                }
            }, ctx.bot);
        }
        return next();
    });

    bot.action('check_payment', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup({
            inline_keyboard: [
                [
                    { text: await translateText('💵 Cash', lang), callback_data: 'payment_cash' },
                    { text: await translateText('💳 Card', lang), callback_data: 'payment_card' }
                ],
                [{ text: await translateText('⬅️ Back', lang), callback_data: 'cart_checkout' }]
            ]
        });
    });

    bot.action(/^payment_(.+)$/, async (ctx) => {
        const method = ctx.match[1]; // 'cash' or 'card'
        ctx.session.payment = method === 'cash' ? '💵 Cash' : '💳 Card';
        const lang = ctx.session.lang || 'EN';
        await ctx.answerCbQuery(await translateText('✅ Payment method saved.', lang));
        // Return to checkout
        return bot.handleUpdate({
            ...ctx.update,
            callback_query: {
                ...ctx.update.callback_query,
                data: 'cart_checkout'
            }
        }, ctx.bot);
    });

    bot.action('menu_logout', async (ctx) => {
        await ctx.answerCbQuery(); // Closes the inline popup
        const lang = ctx.session.lang || 'EN';

        ctx.session = null; // Clears session data (logs user out)

        await ctx.reply(await translateText('🚪 You have been logged out.', lang));

        // Optionally show main start menu again
        await ctx.reply(await translateText('🔁 Back to main menu. Please choose:', lang),
            Markup.inlineKeyboard([[Markup.button.callback(await translateText('Login', lang), 'login'),
            Markup.button.callback(await translateText('Signup', lang), 'signup'),
            Markup.button.callback(await translateText('Help', lang), 'help')
            ],
            [Markup.button.callback(await translateText('Language', lang), 'lang'),
            Markup.button.callback(await translateText('Forget password', lang), 'forgot')
            ],
            [
                Markup.button.callback(await translateText('Contact support', lang), 'contact')
            ],
            ]))
    });
}