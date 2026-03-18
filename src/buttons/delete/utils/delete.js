import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      // 1. Instantly defer
      await interaction.deferReply();

      // 2. Fetch the ticket from the database
      const ticket = await Ticket.findOne({
        where: { channelId: interaction.channel.id },
      });

      if (!ticket) {
        return interaction.editReply({ content: 'No ticket record found in the database.' });
      }

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: ticket.type },
      });

      // 3. Permission Check (Staff only)
      if (ticketConfig) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
        const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

        if (!isAllowed) {
          return interaction.editReply({ content: 'Only staff can delete tickets ❌' });
        }
      }

      // 4. Start the visual countdown
      await interaction.editReply({ content: '🧨 Ticket will be permanently deleted in **5 seconds**...' });

      // 5. Update the Mod Logs to show it was deleted
      if (
        ticketConfig &&
        ticketConfig.getDataValue('logs') &&
        ticket.getDataValue('logId') &&
        ticketConfig.logsChannelId
      ) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId')).catch(() => null);
            if (logMsg?.embeds[0]) {
              const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#000000') // Black color to signify deletion
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase() === 'status:' ? { ...f, value: 'Deleted 🗑️' } : f,
                  ),
                );
              await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
            }
          }
        } catch (err) {
          console.log('Log update failed during deletion');
        }
      }

      // 6. Completely wipe the record from the database
      await ticket.destroy();

      // 7. Wait 5 seconds, then delete the Discord channel
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
      }, 5000);
    } catch (error) {
      console.error('Error in delete.js:', error);
      await interaction
        .editReply({ content: 'An error occurred while trying to delete the ticket.' })
        .catch(() => null);
    }
  },
};
