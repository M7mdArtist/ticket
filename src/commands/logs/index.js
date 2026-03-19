import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketCategory from '../../../database/models/TicketCategory.js';
import set from './subCommands/set-logs.js';
import stop from './subCommands/stop-logs.js';

export default {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Log management for ticket categories and the global system')

    // --- SET SUBCOMMAND ---
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Start logs in an already existing channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Choose the text channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Select the ticket type or "Dynamic-Panel" for global logs')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )

    // --- STOP SUBCOMMAND ---
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop logging tickets for a specific type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Select the ticket type to stop logging for')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  // 👇 SMART AUTOCOMPLETE: Combines Database Categories + Global System
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();

      // 1. Fetch all custom categories from the database
      const categories = await TicketCategory.findAll({
        where: { guildId: interaction.guild.id },
      });

      // 2. Map category names and ADD "Dynamic-Panel" for global logging
      let choices = categories.map(cat => cat.name);
      choices.push('Dynamic-Panel');

      // 3. Filter choices based on user typing
      const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));

      // 4. Respond to Discord (limit to 25)
      await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    } catch (error) {
      console.error('Autocomplete error in logs index:', error);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Route to the specific subcommand file
    if (sub === 'set') return set.execute(interaction);
    if (sub === 'stop') return stop.execute(interaction);

    return interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
  },
};
