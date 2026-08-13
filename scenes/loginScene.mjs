import { Scenes,Markup } from 'telegraf';
import User from '../models/User.mjs';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { userMenuKeyboard } from '../utils/menus.mjs';
import translateText from '../utils/translator.mjs';

const loginScene = new Scenes.WizardScene(
    'login-wizard',
    async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        await ctx.reply(await translateText('📧 Enter your registered email address:', lang))
        return ctx.wizard.next()
    },
    async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        if (ctx.message && ctx.message.text) {
            const email = ctx.message.text.trim().toLowerCase();
            if(!validator.isEmail(email)){
                await ctx.reply(await translateText('❌ Invalid email format. Please enter a valid email:', lang));
                return;
            }
            const user = await User.findOne({ email });

            if (!user) {
                await ctx.reply(await translateText('❌ No account found with this email.', lang));
                return ctx.scene.leave();
            }
            ctx.wizard.state.user = user;
            await ctx.reply(await translateText('🔐 Enter your password:', lang));
            return ctx.wizard.next();
        } else {
            await ctx.reply(await translateText('Please enter your email address:', lang));
        }
    },
    async (ctx) => {
        const lang = ctx.session.lang || 'EN';
        const password = ctx.message.text;
        const user = ctx.wizard.state.user;

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            await ctx.reply(await translateText('❌ Incorrect password. Please try again:', lang));
            return;
        }

         if (!user.verified) {
             await ctx.reply(await translateText('⚠️ Your email is not verified. Please verify first.', lang));
             return ctx.scene.leave();
         }

         ctx.session.user = {
              id: user._id,
             email: user.email,
             telegramId: user.telegramId
            };

        await ctx.reply(`${await translateText('✅ Welcome back,', lang)} ${user.email}! ${await translateText('You now have access to features.', lang)}`, await userMenuKeyboard(lang));
        return ctx.scene.leave();
    }
);
export default loginScene;