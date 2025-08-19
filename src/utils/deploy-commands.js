import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import config from '../config.js';

const commands = [];
const commandsPath = path.join(process.cwd(), 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = (await import(filePath)).default;
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(config.bot.id, config.guild.id), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
