import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const getFilesWithPrefix = (dir, prefix) => {
  return fs.readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.jpg'))
    .map(f => path.join(dir, f))[0];
};

const artifactDir = '/home/ramu/.gemini/antigravity-cli/brain/d7e17dc5-c39d-4c16-9e41-351f3b7fea41';
const target1 = getFilesWithPrefix(artifactDir, 'target_apple');
const source1 = getFilesWithPrefix(artifactDir, 'source_tree');

async function checkAccuracy(target1, source1) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  
  // 1. Upload Target
  const targetUpload = await page.waitForSelector('input[type="file"]');
  await targetUpload.uploadFile(target1);
  
  // 2. Switch to Image Mode
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Image Mode'));
  });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('Image Mode'))?.click();
  });
  
  // 3. Upload Source
  await page.waitForFunction(() => {
    return document.querySelectorAll('input[type="file"]').length >= 2;
  });
  const fileInputs = await page.$$('input[type="file"]');
  await fileInputs[fileInputs.length - 1].uploadFile(source1);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // 4. Set Morph to 100%
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="range"]'));
    const progressInput = inputs.find(i => i.max === "1");
    if (progressInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(progressInput, 1);
      progressInput.dispatchEvent(new Event('input', { bubbles: true }));
      progressInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 5. Get Morph Result Pixels
  const morphData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return { data: Array.from(data), width: canvas.width, height: canvas.height };
  });

  // 6. Get Ground Truth Target Pixels
  // We'll draw the target image onto an identical canvas in the browser to match scaling
  const groundTruthData = await page.evaluate(async (imgPath) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        // Exact same logic as extractParticles to scale the image
        const scale = Math.min(500 / img.width, 500 / img.height);
        const w = Math.floor(img.width * scale);
        const h = Math.floor(img.height * scale);
        const offsetX = (500 - w) / 2;
        const offsetY = (500 - h) / 2;
        
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0,0,500,500);
        
        ctx.drawImage(img, offsetX, offsetY, w, h);
        const data = ctx.getImageData(0, 0, 500, 500).data;
        resolve(Array.from(data));
      };
      // For local files we can't easily load it directly in evaluate due to CORS,
      // But we can use an object URL created from a blob if we pass the file.
      // Easiest is to just read the file in Node, pass as base64.
    });
  }, 'dummy'); // We'll do it differently to avoid base64 huge string
  
  await browser.close();
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Read target as base64
  const targetBase64 = fs.readFileSync(target1).toString('base64');
  
  await page.goto('http://localhost:5173');
  
  const targetUpload = await page.waitForSelector('input[type="file"]');
  await targetUpload.uploadFile(target1);
  
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Image Mode'));
  });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('Image Mode'))?.click();
  });
  
  await page.waitForFunction(() => document.querySelectorAll('input[type="file"]').length >= 2);
  const fileInputs = await page.$$('input[type="file"]');
  await fileInputs[fileInputs.length - 1].uploadFile(source1);
  
  await new Promise(r => setTimeout(r, 2000));
  
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="range"]'));
    const progressInput = inputs.find(i => i.max === "1");
    if (progressInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(progressInput, 1);
      progressInput.dispatchEvent(new Event('input', { bubbles: true }));
      progressInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const morphData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    return Array.from(ctx.getImageData(0, 0, 500, 500).data);
  });
  
  const truthData = await page.evaluate(async (b64) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 500; c.height = 500;
        const ctx = c.getContext('2d');
        const scale = Math.min(500 / img.width, 500 / img.height);
        const w = Math.floor(img.width * scale);
        const h = Math.floor(img.height * scale);
        const offsetX = (500 - w) / 2;
        const offsetY = (500 - h) / 2;
        ctx.drawImage(img, offsetX, offsetY, w, h);
        resolve(Array.from(ctx.getImageData(0,0,500,500).data));
      };
      img.src = "data:image/jpeg;base64," + b64;
    });
  }, targetBase64);
  
  await browser.close();
  
  const img1 = new Uint8Array(morphData);
  const img2 = new Uint8Array(truthData);
  
  // Compare using pixelmatch with a bit of threshold
  const numDiffPixels = pixelmatch(img1, img2, null, 500, 500, { threshold: 0.1 });
  const totalPixels = 500 * 500;
  const accuracy = ((totalPixels - numDiffPixels) / totalPixels) * 100;
  
  console.log(`Accuracy: ${accuracy.toFixed(2)}%`);
  return accuracy;
}

main().catch(console.error);
