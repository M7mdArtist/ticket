import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import TicketConfig from '../../../database/models/TicketConfig.js';
import reg from './utils/reg.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup the ticket system (server owner only)')
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('The category ID for OPEN tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addChannelOption(option =>
      option
        .setName('closed_category')
        .setDescription('The category ID for CLOSED tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('type').setDescription('The type of the ticket (e.g., "Support")').setRequired(false),
    ),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: 'Only the server owner 👑 can use this command.', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const categoryChannel = interaction.options.getChannel('category');
      const closedCategoryChannel = interaction.options.getChannel('closed_category');
      const type = interaction.options.getString('type') || 'Ticket';

      const embed = new EmbedBuilder()
        .setTitle(`${type} System`)
        .setDescription(`Click the button below to open a ${type} ticket! 🎫`)
        .setColor('#DBD42B');

      const openButton = new ButtonBuilder().setCustomId('open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(openButton);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      // Save Configuration to Database
      await TicketConfig.create({
        messageId: msg.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        parentId: categoryChannel.id,
        closedCategoryId: closedCategoryChannel.id, // 👈 NEW: Saves the closed category!
        deleteTicketsChannel: false,
        logs: false,
        type: type,
        roles: '[]',
      });

      let replyMsg = `✅ **${type} System** deployed successfully!\n⏳ Registering **old tickets** in **${categoryChannel.name}**...`;
      await interaction.editReply({ content: replyMsg });

      await reg.execute(interaction, categoryChannel, type, replyMsg);
    } catch (err) {
      console.error('Setup error:', err);
      await interaction.editReply({ content: `❌ Error during setup: ${err.message}` }).catch(() => null);
    }
  },
};
