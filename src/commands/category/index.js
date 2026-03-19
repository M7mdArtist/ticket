import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketCategory from '../../../database/models/TicketCategory.js';
import add from './subCommands/add.js';
import remove from './subCommands/remove.js';

export default {
  data: new SlashCommandBuilder()
    .setName('category')
    .setDescription('Manage the dynamic options on your ticket panel')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a new category to your ticket panel')
        .addStringOption(option =>
          option.setName('name').setDescription('Name of the category (e.g., Support)').setRequired(true),
        )
        .addChannelOption(option =>
          option
            .setName('open_category')
            .setDescription('Where should tickets open?')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addChannelOption(option =>
          option
            .setName('closed_category')
            .setDescription('Where should closed tickets go?')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addStringOption(option =>
          option.setName('description').setDescription('A short description for the dropdown menu').setRequired(false),
        )
        .addStringOption(option =>
          option.setName('emoji').setDescription('An emoji for the dropdown menu (e.g., 🟢)').setRequired(false),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a category from your ticket panel')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('The name of the category to remove')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  // Autocomplete for the 'remove' command
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const categories = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });
      const choices = categories.map(cat => cat.name);
      const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
      await interaction.respond(filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })));
    } catch (error) {
      console.error('Autocomplete error:', error);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') return add.execute(interaction);
    if (sub === 'remove') return remove.execute(interaction);
  },
};
