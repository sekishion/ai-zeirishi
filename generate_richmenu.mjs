import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'generate_richmenu.html');
const outputPath = path.join(__dirname, 'richmenu6_light.png');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 2500, height: 1686 });
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });

// メニュー要素だけをスクリーンショット
await page.evaluate(() => {
  const el = document.getElementById('richmenu');
  el.style.transform = 'none';
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.zIndex = '9999';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = '#fff';
});

await page.screenshot({
  path: outputPath,
  clip: { x: 0, y: 0, width: 2500, height: 1686 },
});

await browser.close();
console.log(`Saved: ${outputPath}`);
