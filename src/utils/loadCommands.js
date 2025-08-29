import { readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands() {
  const commands = new Map();
  const commandsPath = path.join(__dirname, '../commands');
  const entries = readdirSync(commandsPath);

  for (const entry of entries) {
    const fullPath = path.join(commandsPath, entry);

    if (statSync(fullPath).isDirectory()) {
      // If it's a folder, load its index.js
      const { default: command } = await import(`../commands/${entry}/index.js`);
      commands.set(command.data.name, command);
    } else if (entry.endsWith('.js')) {
      // If it's a file, load it directly
      const { default: command } = await import(`../commands/${entry}`);
      commands.set(command.data.name, command);
    }
  }

  return commands;
}
