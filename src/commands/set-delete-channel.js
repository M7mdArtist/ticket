import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketConfig from '../../database/models/TicketConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('set-delete-channel')
    .setDescription('sets the delete channel for an existing channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Chose the channel. "leave blank for this channel"')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) {
        return interaction.reply({
          content: 'Ticket system not configured.\nUse **/setup** first.',
          ephemeral: true,
        });
      }

      // Get allowed roles
      const roles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
      if (!isAllowed) {
        return interaction.reply({
          content: `You don't have permission to use this command`,
          ephemeral: true,
        });
      }

      if (!ticketConfig.getDataValue('deleteTicketsChannel')) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel') || interaction.channel;

        await ticketConfig.update({
          deleteTicketsChannel: true,
          deleteTicketsChannelId: channel.id,
        });

        interaction.editReply(`delete channel set to <#${channel.id}>`);
      }
    } catch (error) {
      console.error('error while trying to set the delete channel', error);
    }
  },
};
