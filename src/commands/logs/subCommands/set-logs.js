import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction, client) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { logs: false, guildId: interaction.guild.id } });
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      if (!ticketConfig) {
        interaction.reply({
          content: 'there is already a logs or system is not configured',
          ephemeral: true,
        });
      }

      if (!ticketConfig.getDataValue('roles') || ticketConfig.getDataValue('roles') === '[]')
        return interaction.reply({ content: 'No roles are set to manage tickets❌', ephemeral: true });

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (isAllowed) {
        if (ticketConfig) {
          await ticketConfig.update({
            logs: true,
            logsChannelId: channel.id,
          });
          interaction.reply({
            content: `logs channel set to <#${channel.id}>`,
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
      console.error('error while setting the logs', error);
    }
  },
};
