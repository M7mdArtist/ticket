import { SlashCommandBuilder } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction, client) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { logs: true, guildId: interaction.guild.id } });

      if (!ticketConfig) {
        interaction.reply({
          content: 'there is no active logs',
          ephemeral: true,
        });
      }

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (isAllowed) {
        if (ticketConfig) {
          await ticketConfig.update({
            logs: false,
            logsChannelId: null,
          });
          console.log(ticketConfig);
          interaction.reply({
            content: 'logs stopped',
            ephemeral: true,
          });
        }
      } else {
        interaction.reply({
          content: `you don't have permission to use this command`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('error while stopping logs', error);
    }
  },
};
