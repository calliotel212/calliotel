/** Client-facing use notes. Never name upstream suppliers. */

function slugOf(code) {
  return String(code || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function getServiceUseNote(code, name) {
  const slug = slugOf(code);
  const label = name || 'this app';
  const base =
    `Use a real phone and the official ${label} app from the App Store or Play Store. ` +
    `If you use a VPN or proxy, set it to the same country as this number. ` +
    `Do not use emulators (Nox, BlueStacks) or a device that was banned before. ` +
    `Request the code only after the number is on your screen.`;

  if (slug.includes('whatsapp')) {
    return (
      `${base} For WhatsApp: keep your IP in the same country as the number. ` +
      `The phone must not have been blocked on WhatsApp or other Meta apps. ` +
      `Use a high-quality VPN or proxy and a fresh device.`
    );
  }
  if (
    slug.includes('instagram') ||
    slug.includes('facebook') ||
    slug.includes('messenger') ||
    slug.includes('threads') ||
    slug === 'meta'
  ) {
    return (
      `${base} For ${label}: keep your IP in the same country as the number. ` +
      `The device must not have been blocked on Meta apps. Use a high-quality VPN or proxy and a fresh device.`
    );
  }
  if (slug.includes('telegram')) {
    return (
      `${base} For Telegram: official app on a physical phone only — not an emulator. ` +
      `On Android use the original OS, not GrapheneOS or similar, or the code may not arrive.`
    );
  }
  if (slug.includes('google') || slug.includes('gmail') || slug.includes('youtube')) {
    return (
      `${base} For Google: use the official app or a normal browser on a real device. ` +
      `Match VPN country to the number.`
    );
  }
  if (slug.includes('tiktok') || slug.includes('douyin')) {
    return (
      `${base} For TikTok: official app on a real phone. Match VPN country to the number. Avoid banned or emulator devices.`
    );
  }
  return base;
}
