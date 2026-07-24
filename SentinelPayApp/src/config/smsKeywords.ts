/**
 * Multi-Language SMS Keyword Dictionary for SentinelPay.
 * Covers 10 major Indian languages (English, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, Bengali).
 * Categorized by scam type: Phishing, KYC, Job, Loan, APK, Screen Share, UPI Collect, Parcel.
 */

export const MULTI_LANG_SCAM_KEYWORDS: Record<string, string[]> = {
  // English
  en: [
    'bit.ly', 'tinyurl', 'claim prize', 'won lottery', 'account suspended',
    'update kyc', 'part time job', 'earn daily', 'telegram.me', 'click here to verify',
    'download apk', 'install app', 'anydesk', 'teamviewer', 'screen share',
    'upi collect', 'parcel stuck', 'customs fee', 'guaranteed return', 'pre-approved loan'
  ],
  // Hindi
  hi: [
    'इनाम जीता', 'केवाईसी अपडेट', 'अकाउंट सस्पेंड', 'लिंक पर क्लिक करें',
    'पार्ट टाइम जॉब', 'रोजाना कमाएं', 'ऐप डाउनलोड करें', 'लॉटरी लगी'
  ],
  // Marathi
  mr: [
    'बक्षीस जिंकले', 'केवायसी अपडेट', 'खाते रद्द', 'अ‍ॅप डाउनलोड करा', 'दररोज कमवा'
  ],
  // Tamil
  ta: [
    'பரிசு வென்றீர்கள்', 'கேஒய்சி புதுப்பிக்கவும்', 'கணக்கு இடைநிறுத்தப்பட்டது', 'செயலியை பதிவிறக்கவும்'
  ],
  // Telugu
  te: [
    'బహుమతి గెలిచారు', 'కేవైసీ అప్డేట్', 'ఖాతా సస్పెండ్', 'యాప్ డౌన్‌లోడ్ చేయండి'
  ],
  // Kannada
  kn: [
    'ಬಹುಮಾನ ಗೆದ್ದಿದ್ದೀರಿ', 'ಕೆವೈಸಿ ಅಪ್ಡೇಟ್', 'ಖಾತೆ ರದ್ದು', 'ಆ್ಯಪ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ'
  ],
  // Malayalam
  ml: [
    'സമ്മാനം ജയിച്ചു', 'കെവൈസി അപ്‌ഡേറ്റ്', 'ആപ്പ് ഡൗൺലോഡ് ചെയ്യുക'
  ],
  // Gujarati
  gu: [
    'ઈનામ જીત્યા', 'કેવાઈસી અપડેટ', 'ખાતું બ્લોક', 'એપ ડાઉનલોડ કરો'
  ],
  // Punjabi
  pa: [
    'ਇਨਾਮ ਜਿੱਤਿਆ', 'ਕੇਵਾਈਸੀ ਅਪਡੇਟ', 'ਖਾਤਾ ਬੰਦ', 'ਐਪ ਡਾਊਨਲੋਡ ਕਰੋ'
  ],
  // Bengali
  bn: [
    'পুরস্কার জিতেছেন', 'কেওয়াইসি আপডেট', 'অ্যাকাউন্ট ব্লক', 'অ্যাপ ডাউনলোড করুন'
  ]
};

export const EXTENDED_BANK_WHITELIST_SENDERS = [
  // Major Banks
  'HDFC', 'ICICI', 'AXIS', 'SBI', 'KOTAK', 'PAYTM', 'YESBNK', 'INDBNK', 'BOI', 'UNION', 'FED', 'RBL', 'CANARA', 'PNB', 'IDFC', 'BOB',
  // Regional & Public Banks
  'IOBTNK', 'SYNDBK', 'CENTBK', 'DENABNK', 'ANDBNK', 'BANDBK', 'ALLBNK', 'UCOBNK', 'PSB', 'J&KBNK', 'KARBNK', 'KVB', 'SOUTHB',
  // NBFCs & Payment Apps
  'BAJAJF', 'MUTHOO', 'MANAPP', 'HOMEFI', 'LTFIN', 'RAZORP', 'CASHFR', 'BHRTPE', 'MOBIKW', 'CRED', 'PHONEPE', 'GPAY',
  // Gov & Essential Services
  'UIDAI', 'NSDL', 'EPFO', 'IRCTC', 'FASTAG', 'GSTN', 'CBDT'
];

export function containsScamKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  for (const lang of Object.keys(MULTI_LANG_SCAM_KEYWORDS)) {
    for (const kw of MULTI_LANG_SCAM_KEYWORDS[lang]) {
      if (lower.includes(kw.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}
