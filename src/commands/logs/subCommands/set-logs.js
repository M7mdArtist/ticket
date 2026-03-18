import { PermissionsBitField } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: type } });

      if (!ticketConfig) {
        return interaction.editReply({ content: `No ticket system configured for type: **${type}** ❌` });
      }

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed =
        interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)) ||
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

      if (!isAllowed) {
        return interaction.editReply({ content: `You do not have permission to use this command ❌` });
      }

      await ticketConfig.update({
        logs: true,
        logsChannelId: channel.id,
      });

      await interaction.editReply({ content: `Logs for **${type}** tickets set to <#${channel.id}> ✅` });
    } catch (error) {
      console.error('Error while setting the logs', error);
      await interaction.editReply({ content: 'An error occurred while setting the logs.' }).catch(() => null);
    }
  },
};
