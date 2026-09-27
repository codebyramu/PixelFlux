import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const getFilesWithPrefix = (dir, prefix) => {
  return fs.readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.jpg'))
    .map(f => path.join(dir, f))[0];
};

const artifactDir = '/home/ramu/.gemini/antigravity-cli/brain/d7e17dc5-c39d-4c16-9e41-351f3b7fea41';
const target1 = getFilesWithPrefix(artifactDir, 'target_apple');
const target2 = getFilesWithPrefix(artifactDir, 'target_cube');
const source1 = getFilesWithPrefix(artifactDir, 'source_tree');
const source2 = getFilesWithPrefix(artifactDir, 'source_face');

async function runTest(targetPath, sourcePath, index) {
  console.log(`Starting test ${index}...`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  
  console.log('Uploading target...');
  const targetUpload = await page.waitForSelector('input[type="file"]');
  await targetUpload.uploadFile(targetPath);
  
  console.log('Switching to Image Mode...');
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Image Mode'));
  });
  
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('Image Mode'))?.click();
  });
  
  console.log('Uploading source...');
  await page.waitForFunction(() => {
    return document.querySelectorAll('input[type="file"]').length >= 2;
  });
  const fileInputs = await page.$$('input[type="file"]');
  await fileInputs[fileInputs.length - 1].uploadFile(sourcePath);
  
  console.log('Waiting for processing to finish...');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Running morph to 100%...');
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
  
  const canvasElement = await page.$('canvas');
  await canvasElement.screenshot({ path: `result_${index}.png` });
  console.log(`Saved result_${index}.png`);
  
  await browser.close();
}

async function main() {
  await runTest(target1, source1, 1);
  await runTest(target2, source2, 2);
  console.log("Tests completed.");
}

main().catch(console.error);
