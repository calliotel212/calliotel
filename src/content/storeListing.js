/**
 * App Store / Play Store listing copy — keep store consoles in sync with this.
 * Apple subtitle max 30 chars. Promo text max 170 chars.
 */
export const STORE_LISTING = {
  name: 'Calliotel',
  // Play Store + App Store icon: blue (#2563EB) + white glyph. Upload public/appstore-icon-1024.png (no alpha).
  subtitle: 'Virtual Numbers & eSIM', // 24 chars
  promotionalText:
    'Virtual numbers for SMS & calls. eSIM data when you travel. One account, worldwide.',
  shortDescription:
    'Real numbers. Real data. No SIM card required.',
  fullDescription: [
    'Calliotel gives you real virtual phone numbers and travel eSIM data in one account.',
    '',
    'VIRTUAL NUMBERS',
    '• US, UK, Canada, Australia & Puerto Rico',
    '• SMS and calls on a real number you control',
    '• Monthly plans · No ID required',
    '',
    'eSIM DATA',
    '• 180+ countries · 4G/5G',
    '• Scan a QR code and go online — no physical SIM',
    '• Plans from $0.54',
    '',
    'Privacy-first. Instant activation. Manage everything in the app.',
  ].join('\n'),
};
