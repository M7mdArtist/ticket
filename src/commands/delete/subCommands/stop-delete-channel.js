import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });

    const roles = JSON.parse(ticketConfig.getDataValue('roles'));
    const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
    if (!isAllowed) {
      return interaction.reply({
        content: `You don't have permission to use this command`,
        ephemeral: true,
      });
    }

    if (!ticketConfig.getDataValue('deleteTicketsChannel')) {
      return interaction.editReply({ content: 'There is no delete channel to stop.', ephemeral: true });
    }

    await ticketConfig.update({
      deleteTicketsChannel: false,
      deleteTicketsChannelId: null,
    });

    return interaction.editReply({ content: 'Delete channel stopped.', ephemeral: true });
  },
};
