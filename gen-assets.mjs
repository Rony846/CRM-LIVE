import sharp from 'sharp';
import { writeFileSync } from 'fs';

const SRC = '/tmp/stitch15/stitch_musclegrid_mobile_crm/musclegrid_crm_app_icon_1/screen.png';
const BG = { r: 0x0f, g: 0x13, b: 0x1f, alpha: 1 }; // #0f131f

// icon_1 is a navy squircle on a WHITE field -> mask to rounded-rect so the
// white corners become transparent (blends into the dark theme everywhere).
const SIZE = 1024, R = Math.round(SIZE * 0.225);
const maskSvg = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${R}" ry="${R}"/></svg>`
);
const masked = await sharp(SRC).resize(SIZE, SIZE)
  .composite([{ input: maskSvg, blend: 'dest-in' }]).png().toBuffer();

// Native source for @capacitor/assets
writeFileSync('resources/icon.png', masked);

async function splash(out, side = 2732) {
  const logo = await sharp(masked).resize(Math.round(side * 0.3)).png().toBuffer();
  await sharp({ create: { width: side, height: side, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }]).png().toFile(out);
}
await splash('resources/splash.png');
await splash('resources/splash-dark.png');

// PWA / web icons
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon-32.png': 32, 'favicon-16.png': 16 };
for (const [name, s] of Object.entries(sizes)) {
  await sharp(masked).resize(s, s).png().toFile(`public/icons/${name}`);
}
// maskable: logo on full-bleed dark bg, ~72% safe zone
const mlogo = await sharp(masked).resize(Math.round(512 * 0.72)).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: mlogo, gravity: 'center' }]).png().toFile('public/icons/icon-512-maskable.png');

console.log('assets regenerated (corners masked)');
