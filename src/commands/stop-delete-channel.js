import { SlashCommandBuilder } from 'discord.js';
import TicketConfig from '../../database/models/TicketConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stop-delete-channel')
    .setDescription('Stops the delete closed ticket channel.'),

  async execute(interaction) {
    const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });

    if (!ticketConfig) {
      return interaction.reply({ content: 'The ticket system is not configured yet.', ephemeral: true });
    }

    const roles = JSON.parse(ticketConfig.getDataValue('roles'));
    const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
    if (!isAllowed) {
      return interaction.reply({
        content: `You don't have permission to use this command`,
        ephemeral: true,
      });
    }

    if (!ticketConfig.getDataValue('deleteTicketsChannel')) {
      return interaction.reply({ content: 'There is no delete channel to stop.', ephemeral: true });
    }

    await ticketConfig.update({
      deleteTicketsChannel: false,
      deleteTicketsChannelId: null,
    });

    return interaction.reply({ content: 'Delete channel stopped.', ephemeral: true });
  },
};
