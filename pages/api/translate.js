// Vercel serverless function for translation

// DeepL API configuration
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

// Language code mappings
const LANGUAGE_MAP = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'hindi': 'hi',
  'mandarin': 'zh',
  'vietnamese': 'vi'
};

const DEEPL_LANGUAGE_MAP = {
  'en': 'EN',
  'es': 'ES',
  'fr': 'FR',
  'hi': 'HI',
  'zh': 'ZH',
  'vi': 'VI'
};

// Simple language detection based on character patterns
function detectLanguage(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  if (/[\u1ea0-\u1ef9]/.test(text)) return 'vi';
  if (/[àâäéèêëïîôùûüÿç]/.test(text)) return 'fr';
  if (/[ñáéíóúü]/.test(text)) return 'es';
  return 'en';
}

// DeepL translation
async function translateWithDeepL(text, targetLang, sourceLang = null) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error('DeepL API key not configured');
  }

  const deeplTarget = DEEPL_LANGUAGE_MAP[targetLang] || 'EN';
  const deeplSource = sourceLang ? DEEPL_LANGUAGE_MAP[sourceLang] : null;

  const body = {
    text: [text],
    target_lang: deeplTarget
  };

  if (deeplSource) {
    body.source_lang = deeplSource;
  }

  const response = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL API error: ${error}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

// Google Cloud Translation
async function translateWithGoogle(text, targetLang, sourceLang = null) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error('Google Translate API key not configured');
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  
  const body = {
    q: text,
    target: targetLang
  };

  if (sourceLang && sourceLang !== 'auto') {
    body.source = sourceLang;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Translate API error: ${error}`);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, source, target } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const targetLang = LANGUAGE_MAP[target] || 'es';
    const sourceLang = source ? LANGUAGE_MAP[source] : null;
    const detectedSource = sourceLang || detectLanguage(text);

    let result;
    let usedService = 'deepl';

    try {
      result = await translateWithDeepL(text, targetLang, sourceLang);
    } catch (deeplError) {
      console.log('DeepL failed, trying Google:', deeplError.message);
      try {
        result = await translateWithGoogle(text, targetLang, sourceLang);
        usedService = 'google';
      } catch (googleError) {
        throw new Error(`Both translation services failed: ${deeplError.message}, ${googleError.message}`);
      }
    }

    res.status(200).json({
      result,
      detectedSource,
      targetUsed: targetLang,
      service: usedService
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message });
  }
};
