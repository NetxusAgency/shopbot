import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export default async function translateText(text, targetLang = 'EN') {
  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', targetLang.toUpperCase());

    const response = await axios.post(DEEPL_API_URL, params, {
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    return response.data.translations[0].text;
  } catch (error) {
    console.error('DeepL Translation Error:', error.response?.data || error.message);
    return text; // fallback to original
  }
}