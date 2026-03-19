import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import TicketCategory from '../../../database/models/TicketCategory.js';
import TicketConfig from '../../../database/models/TicketConfig.js';

export default {
  data: new SlashCommandBuilder().setName('panel').setDescription('Deploy the dynamic ticket dropdown panel'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.editReply({ content: 'Only the server owner can deploy the panel 👑' });
      }

      // 1. Fetch all categories for this server from the database
      const categories = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });

      if (categories.length === 0) {
        return interaction.editReply({
          content: '❌ Your database is empty! Please add some categories first using `/category add`.',
        });
      }

      // 2. Build the Dropdown Menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_panel_select')
        .setPlaceholder('✨ Select a ticket category...')
        .setMinValues(1)
        .setMaxValues(1);

      // 3. Add the database categories to the menu
      categories.forEach(cat => {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.name)
            .setDescription(cat.description || 'Open a ticket for this category')
            .setEmoji(cat.emoji || '🎫')
            .setValue(cat.name), // We use the name to look it up later
        );
      });

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle('📩 Open a Support Ticket')
        .setDescription(
          'Please select the most relevant category from the dropdown menu below to start a conversation with our staff.',
        )
        .setColor('#5865F2')
        .setFooter({ text: 'Our team will be with you shortly!' });

      // 4. Send the panel to the channel
      const panelMessage = await interaction.channel.send({
        embeds: [embed],
        components: [row],
      });

      // 5. Save this as a valid config (so the bot knows this message is a panel)
      await TicketConfig.upsert({
        messageId: panelMessage.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        type: 'Dynamic-Panel',
        roles: '[]', // You can update this later with /role
      });

      await interaction.editReply({ content: '✅ Dynamic Panel deployed successfully!' });
    } catch (error) {
      console.error('Panel deployment error:', error);
      await interaction.editReply({ content: '❌ Failed to deploy the panel.' });
    }
  },
};
