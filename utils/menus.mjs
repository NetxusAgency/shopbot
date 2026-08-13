import { Markup } from 'telegraf';
import translateText from './translator.mjs';

export const userMenuKeyboard = async (lang = 'EN') =>
  Markup.inlineKeyboard([
    [Markup.button.callback(await translateText('👤 Profile', lang), 'menu_profile'), Markup.button.callback(await translateText('🎁 My Gift Cards', lang), 'menu_giftcards')],
    [Markup.button.callback(await translateText('🛒 Cart', lang), 'menu_cart'), Markup.button.callback(await translateText('📦 Catalogue', lang), 'menu_catalogue')],
    [Markup.button.callback(await translateText('🌍 Change Language', lang), 'lang'), Markup.button.callback(await translateText('🚪 Logout', lang), 'menu_logout')],
  ]);