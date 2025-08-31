import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadButtons(client) {
  const buttonsPath = path.resolve('./src/buttons');

  function getAllFiles(dir) {
    let files = [];
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        files = files.concat(getAllFiles(fullPath));
      } else if (file.endsWith('.js')) {
        files.push(fullPath);
      }
    });
    return files;
  }

  const buttonFiles = getAllFiles(buttonsPath);

  client.buttons = new Map();

  for (const filePath of buttonFiles) {
    const { default: button } = await import(pathToFileURL(filePath));
    if (!button || !button.customId || !button.execute) {
      console.warn(`⚠️ Button file ${filePath} is missing "customId" or "execute".`);
      continue;
    }
    client.buttons.set(button.customId, button);
    console.log(`✅ Loaded button: ${button.customId}`);
  }
}
