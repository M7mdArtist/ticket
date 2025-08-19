import { REST, Routes } from 'discord.js';
import config from '../config.js';

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log('Started removing global commands...');

    await rest.put(Routes.applicationCommands(config.bot.id), { body: [] });

    console.log('Successfully removed all global commands.');
  } catch (error) {
    console.error(error);
  }
})();
