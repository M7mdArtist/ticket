import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('List of all available commands'),

  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('⚙️ System Configuration')
      .setDescription('Use the commands below to manage the bot settings.')
      .setColor('#5865F2')
      .addFields(
        {
          name: '🚀 Setup & Core',
          value:
            '` /setup ` - Initialize the bot. Run this multiple times for different ticket types.\n` /role  ` - Configure staff and user access roles.',
        },
        {
          name: '🎫 Ticket Management',
          value: '` /ticket ` - General ticket settings and overrides.\n` /delete ` - Cleanup and deletion protocols.',
        },
        {
          name: '📜 Logging',
          value: '` /log    ` - Define where and how actions are recorded.',
        },
      )
      .setFooter({ text: 'Tip: Use /setup for every new category you want to create.' })
      .setTimestamp();

    await interaction.reply({
      embeds: [helpEmbed],
      ephemeral: true,
    });
  },
};
