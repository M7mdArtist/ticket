import { SlashCommandBuilder, ChannelType } from 'discord.js';
import create from './subCommands/create-logs.js';
import set from './subCommands/set-logs.js';
import stop from './subCommands/stop-logs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('log management')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Creates a logs channel')
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Chose the category to create the logs channel')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Start the logs in an existing channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Chose the channel to start the logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub => sub.setName('stop').setDescription('stop logging the tickets')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return create.execute(interaction);
    if (sub === 'set') return set.execute(interaction);
    if (sub === 'stop') return stop.execute(interaction);
  },
};
