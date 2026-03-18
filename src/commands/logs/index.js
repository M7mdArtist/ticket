import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketConfig from '../../../database/models/TicketConfig.js'; // 👈 Make sure this path is correct!
import create from './subCommands/create-logs.js';
import set from './subCommands/set-logs.js';
import stop from './subCommands/stop-logs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Log management for tickets')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Creates a logs channel')
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Choose the category to create the logs channel')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption(
          option =>
            option.setName('type').setDescription('Select the ticket type').setRequired(true).setAutocomplete(true), // 👈 Turns on dynamic searching
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Start logs in an existing channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Choose the channel to start the logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption(
          option =>
            option.setName('type').setDescription('Select the ticket type').setRequired(true).setAutocomplete(true), // 👈 Turns on dynamic searching
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop logging tickets')
        .addStringOption(
          option =>
            option
              .setName('type')
              .setDescription('Select the ticket type to stop logging for')
              .setRequired(true)
              .setAutocomplete(true), // 👈 Turns on dynamic searching
        ),
    ),

  // 👇 This new function handles the dynamic dropdown menu
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();

      // Fetch all ticket configurations for this specific server
      const configs = await TicketConfig.findAll({ where: { guildId: interaction.guild.id } });

      // Extract just the names of the types (and remove duplicates if any)
      const types = [...new Set(configs.map(c => c.type))];

      // Filter the list based on what the user is currently typing
      const filtered = types.filter(type => type.toLowerCase().startsWith(focusedValue.toLowerCase()));

      // Send the list back to Discord (Discord limits autocomplete to 25 choices maximum)
      await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    } catch (error) {
      console.error('Autocomplete error in logs:', error);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return create.execute(interaction);
    if (sub === 'set') return set.execute(interaction);
    if (sub === 'stop') return stop.execute(interaction);
  },
};
