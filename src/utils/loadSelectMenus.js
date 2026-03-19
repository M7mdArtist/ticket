import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export async function loadSelectMenus(client) {
  const foldersPath = path.join(process.cwd(), 'src', 'selectMenus');
  if (!fs.existsSync(foldersPath)) return;

  const files = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(foldersPath, file);
    const { default: menu } = await import(pathToFileURL(filePath).href);

    if (menu.customId && menu.execute) {
      client.selectMenus.set(menu.customId, menu);
      console.log(`✅ Loaded Select Menu: ${menu.customId}`);
    }
  }
}
