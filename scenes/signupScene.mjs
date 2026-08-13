import { Markup, Scenes } from 'telegraf';
import User from '../models/User.mjs';
import sendVerificationMail from '../utils/mailer.mjs';
import { hash } from 'bcryptjs';
import validator from 'validator';
import { userMenuKeyboard } from '../utils/menus.mjs';
import translateText from '../utils/translator.mjs';

const signupScene = new Scenes.WizardScene(
  'signup-wizard',

  // Step 1: Ask for email
  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    await ctx.reply(await translateText('📧 Enter your email address:', lang));
    return ctx.wizard.next();
  },

  // Step 2: Validate email & ask for password
  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const email = ctx.message.text.trim().toLowerCase();

    if (!validator.isEmail(email)) {
      await ctx.reply(await translateText('❌ Invalid email format. Please enter a valid email:', lang));
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      await ctx.reply(await translateText('⚠️ This email is already registered. Try logging in.', lang));
      return ctx.scene.leave();
    }

    ctx.wizard.state.email = email;
    await ctx.reply(await translateText('🔐 Create a password:', lang));
    return ctx.wizard.next();
  },

  // Step 3: Hash password, generate code, send email
  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const password = ctx.message.text;

    if (password.length < 6) {
      await ctx.reply(await translateText('🔒 Password must be at least 6 characters.', lang));
      return;
    }

    ctx.wizard.state.password = await hash(password, 10);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    ctx.wizard.state.verificationCode = code;

    await sendVerificationMail(ctx.wizard.state.email, code,'signup', lang);
    await ctx.reply(await translateText('📨 A verification code has been sent to your email. Enter it here:', lang));
    return ctx.wizard.next();
  },

  // Step 4: Verify code & create user
  async (ctx) => {
    const lang = ctx.session.lang || 'EN';
    const enteredCode = ctx.message.text.trim();
    const { email, password, verificationCode } = ctx.wizard.state;

    if (enteredCode !== verificationCode) {
      await ctx.reply(await translateText('❌ Incorrect code. Please try again.', lang));
      return;
    }

    await new User({
  telegramId: ctx.from.id,
  email,
  password,
  verified: true,
  preferredLang: ctx.session.language || 'en',
  createdAt: new Date(),
  name: ctx.from.first_name || '',
}).save();

    await ctx.reply(await translateText('✅ Account created successfully! You are verified.', lang));
    await ctx.reply(await translateText('🎉 Welcome! Your account was created.', lang), userMenuKeyboard(lang));
    return ctx.scene.leave();
  }
);

export default signupScene;