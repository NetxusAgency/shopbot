import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import translateText from './translator.mjs';
dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'ShopBot <onboarding@resend.dev>';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = process.env.BREVO_SENDER || { email: 'lateefokanlawon52@gmail.com', name: 'ShopBot' };

// HTTPS email APIs (work even where outbound SMTP ports are blocked, e.g. free Render)
const sendViaApi = async ({ to, subject, text }) => {
  if (BREVO_API_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: BREVO_SENDER,
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { messageId: data.messageId };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { messageId: data.id };
};

// Fallback: classic SMTP (works for local dev, Gmail, or any SMTP provider)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'lateefokanlawon52@gmail.com',
    pass: process.env.SMTP_PASS || process.env.GOOGLE_APP_PASSWORD,
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

const MAIL_FROM = process.env.SMTP_FROM || '"Lateefz" <lateefokanlawon52@gmail.com>';

const sendMail = async (to, subject, text) => {
  if (BREVO_API_KEY || RESEND_API_KEY) {
    const info = await sendViaApi({ to, subject, text });
    console.log(`📤 Email sent via ${BREVO_API_KEY ? 'Brevo' : 'Resend'} API: %s`, info.messageId);
    return;
  }
  const info = await transporter.sendMail({ from: MAIL_FROM, to, subject, text });
  console.log('📤 Email sent via SMTP: %s', info.messageId);
};

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
    await sendMail(to, subject, message);
  } catch (err) {
    console.error('❌ Error while sending mail', err?.message || err);
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
    await sendMail(to, subject, message);
  } catch (err) {
    console.error('❌ Error sending gift card email', err?.message || err);
  }
};