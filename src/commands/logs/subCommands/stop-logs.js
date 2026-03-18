import { PermissionsBitField } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type');
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: type } });

      if (!ticketConfig) {
        return interaction.editReply({ content: `No ticket system configured for type: **${type}** ❌` });
      }

      if (!ticketConfig.logs) {
        return interaction.editReply({ content: `Logs are already disabled for **${type}** tickets.` });
      }

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed =
        interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)) ||
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

      if (!isAllowed) {
        return interaction.editReply({ content: `You do not have permission to use this command ❌` });
      }

      await ticketConfig.update({
        logs: false,
        logsChannelId: null,
      });

      await interaction.editReply({ content: `Logging stopped for **${type}** tickets 🛑` });
    } catch (error) {
      console.error('Error while stopping logs', error);
      await interaction.editReply({ content: 'An error occurred while stopping the logs.' }).catch(() => null);
    }
  },
};
