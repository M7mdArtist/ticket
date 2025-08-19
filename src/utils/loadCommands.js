import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands() {
  const commands = new Map();
  const commandsPath = path.join(__dirname, '../commands');
  const files = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const { default: command } = await import(`../commands/${file}`);
    commands.set(command.data.name, command);
  }
  return commands;
}
