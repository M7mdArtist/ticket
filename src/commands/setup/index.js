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
        .setDescription('The category ID for tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('type').setDescription('The type of the ticket e.g"Apply ticket"').setRequired(false),
    ),

  async execute(interaction, client) {
    let replyMsg;
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: 'Only server owner👑 can use this command',
        ephemeral: true,
      });
    }

    try {
      const categoryId = interaction.options.getChannel('category').id;

      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type') || 'Ticket';
      const embed = new EmbedBuilder()
        .setTitle(type)
        .setDescription('Click the button to open a ticket!🎫')
        .setColor('#DBD42B');

      const openButton = new ButtonBuilder().setCustomId('open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(openButton);

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      const categoryChannel = client.channels.cache.get(categoryId);

      if (!categoryChannel) {
        throw new Error('Invalid category ID');
      }

      const ticketConfig = TicketConfig.create({
        messageId: msg.id,
        channelId: interaction.channel.id,
        guildId: interaction.guild.id,
        // roles: JSON.stringify(roles),
        parentId: categoryChannel.id,
        deleteTicketsChannel: false,
        logs: false,
        type: type,
      });

      console.log(ticketConfig);
      replyMsg = `\n⏳Registering **old tickets** in **${categoryChannel.name}** category...`;
      await interaction.editReply({ content: replyMsg });
      reg.execute(interaction, categoryChannel, replyMsg);
    } catch (err) {
      console.error('Setup error:', err);
      interaction.editReply({ content: `Error during setup: ${err.message}` });
    }
  },
};
