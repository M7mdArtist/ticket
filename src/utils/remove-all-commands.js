import { REST, Routes } from 'discord.js';
import config from '../config.js';

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log('Started removing guild commands...');

    await rest.put(Routes.applicationGuildCommands(config.bot.id, config.guild.id), { body: [] });

    console.log('Successfully removed all guild commands.');
  } catch (error) {
    console.error(error);
  }
})();
