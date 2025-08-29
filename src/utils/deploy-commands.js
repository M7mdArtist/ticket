import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import config from '../config.js';

const __dirname = process.cwd();
const commandsPath = path.join(__dirname, 'src', 'commands');

const commands = [];

// Recursively get all .js files in commands dir
function getCommandFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(getCommandFiles(fullPath)); // recurse into subdir
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }

  return results;
}

const commandFiles = getCommandFiles(commandsPath);

for (const file of commandFiles) {
  const commandModule = await import(`file://${file}`);
  const command = commandModule.default;

  if (command?.data && typeof command.data.toJSON === 'function') {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARN] Skipping ${file} because it has no valid command export.`);
  }
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    await rest.put(Routes.applicationGuildCommands(config.bot.id, config.guild.id), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
