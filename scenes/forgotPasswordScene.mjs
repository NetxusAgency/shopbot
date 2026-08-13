import { Scenes } from 'telegraf';
import User from '../models/User.mjs';
import sendVerificationMail from '../utils/mailer.mjs';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import translateText from '../utils/translator.mjs';

const forgotPasswordScene = new Scenes.WizardScene(
  'forgot-password-wizard',

  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    await ctx.reply(await translateText('📧 Enter your registered email:', lang));
    return ctx.wizard.next();
  },

  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const email = ctx.message.text.trim().toLowerCase();

    if (!validator.isEmail(email)) {
      await ctx.reply(await translateText('❌ Invalid email. Try again:', lang));
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      await ctx.reply(await translateText('⚠️ No user found with this email.', lang));
      return ctx.scene.leave();
    }

    ctx.wizard.state.email = email;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    ctx.wizard.state.code = code;

    await sendVerificationMail(email, code, 'reset', lang);
    await ctx.reply(await translateText('📨 A verification code has been sent. Enter it:', lang));
    return ctx.wizard.next();
  },

  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const inputCode = ctx.message.text.trim();
    if (inputCode !== ctx.wizard.state.code) {
      await ctx.reply(await translateText('❌ Wrong code. Try again:', lang));
      return;
    }

    await ctx.reply(await translateText('🔐 Enter your new password:', lang));
    return ctx.wizard.next();
  },

  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const newPassword = ctx.message.text.trim();
    if (newPassword.length < 6) {
      await ctx.reply(await translateText('🔒 Password must be at least 6 characters.', lang));
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email: ctx.wizard.state.email }, { password: hashed });

    await ctx.reply('✅ Password updated successfully!');
    return ctx.scene.leave();
  }
);

export default forgotPasswordScene;