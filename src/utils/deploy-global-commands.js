import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const commands = [];

// Safely navigates from your root folder -> src -> commands
const commandsPath = path.join(process.cwd(), 'src', 'commands');

// Read the FOLDERS inside the commands directory (e.g., 'logs', 'setup')
const commandFolders = fs.readdirSync(commandsPath);

console.log(`🔑 Token loaded: ${config.bot.token ? 'YES' : 'NO'}`);

for (const folder of commandFolders) {
  // Look for the index.js inside each command folder
  const commandFilePath = path.join(commandsPath, folder, 'index.js');

  // Check if the index.js file actually exists before trying to load it
  if (fs.existsSync(commandFilePath)) {
    // Dynamically import the file (using pathToFileURL for Windows/Linux compatibility)
    const { pathToFileURL } = await import('url');
    const commandModule = await import(pathToFileURL(commandFilePath).href);
    const command = commandModule.default;

    if (command && command.data) {
      commands.push(command.data.toJSON());
      console.log(`✅ Found command: /${command.data.name}`);
    } else {
      console.log(`⚠️ Warning: The command at ${folder}/index.js is missing 'data' or 'execute'.`);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log(`\n🚀 Refreshing ${commands.length} global commands...`);

    // Sends the payload to Discord
    await rest.put(Routes.applicationCommands(config.bot.id), { body: commands });

    console.log('🎉 Successfully registered all global commands!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
})();
