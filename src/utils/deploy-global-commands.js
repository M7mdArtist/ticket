// src/utils/deploy-global-commands.js
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const commands = [];
const commandsPath = path.resolve('../commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log(config.bot.token);
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandModule = await import(`file://${filePath}`);
  const command = commandModule.default;

  if (!command?.data) continue;

  // Push the command, subcommands included
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log(`Refreshing ${commands.length} global commands...`);

    await rest.put(Routes.applicationCommands(config.bot.id), { body: commands });

    console.log('✅ Successfully registered all global commands!');
  } catch (error) {
    console.error(error);
  }
})();
