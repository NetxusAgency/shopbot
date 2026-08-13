import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import translateText from './translator.mjs';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'lateefokanlawon52@gmail.com',
    pass: process.env.SMTP_PASS || process.env.GOOGLE_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

try {
  await transporter.verify();
  console.log(`✅ Mail server is ready (${transporter.options.host})`);
} catch (err) {
  console.warn(`⚠️ Mail server not reachable at startup (${transporter.options.host}), emails will retry on send:`, err.message);
}

const MAIL_FROM = process.env.SMTP_FROM || '"Lateefz" <lateefokanlawon52@gmail.com>';

const sendVerificationMail = async (to, code, type = 'signup', lang = 'EN') => {
  const subject =
    type === 'signup'
      ? await translateText('Email Verification Code', lang)
      : await translateText('Password Reset Verification Code', lang);

  const message =
    type === 'signup'
      ? await translateText(`👋 Welcome! Your signup verification code is: ${code}`, lang)
      : await translateText(`🔑 Here is your password reset code: ${code}`, lang);

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text: message,
    });

    console.log('📤 Message sent: %s', info.messageId);
    console.log('🔎 Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error('❌ Error while sending mail', err);
  }
};

export default sendVerificationMail;

export const sendGiftCardEmail = async (to, giftCardCodes, orderId) => {
  const subject = 'Your Gift Card Codes!';
  let message = `🎉 Congratulations on your purchase!\n\nHere are your gift card codes for Order ID: ${orderId}\n\n`;

  giftCardCodes.forEach((code, index) => {
    message += `${index + 1}. ${code}\n`;
  });

  message += `\nThank you for shopping with us!`;

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text: message,
    });

    console.log('📤 Gift card email sent: %s', info.messageId);
  } catch (err) {
    console.error('❌ Error sending gift card email', err);
  }
};