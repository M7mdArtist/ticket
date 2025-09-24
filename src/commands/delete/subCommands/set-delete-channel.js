import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) {
        return interaction.reply({
          content: 'Ticket system not configured.\nUse **/setup** first.',
          ephemeral: true,
        });
      }

      if (!ticketConfig.getDataValue('roles') || ticketConfig.getDataValue('roles') === '[]')
        return interaction.reply({ content: 'No roles are set to manage tickets❌', ephemeral: true });
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
