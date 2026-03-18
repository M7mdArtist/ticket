import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder, PermissionsBitField } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      // 1. Instantly defer to prevent timeouts
      await interaction.deferReply({ ephemeral: true });

      // 2. Find the closed ticket in the database
      const ticket = await Ticket.findOne({
        where: { channelId: interaction.channel.id, resolved: true },
      });

      if (!ticket) return interaction.editReply({ content: 'No closed ticket found to reopen.' });

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: ticket.type },
      });

      if (!ticketConfig) return interaction.editReply({ content: 'Ticket system is not configured.' });

      // 3. Permission Check (Staff only)
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isAllowed) {
        return interaction.editReply({ content: 'Only staff can reopen tickets ❌' });
      }

      // 4. Database Updates
      await ticket.update({ resolved: false, closeReq: false });

      const ticketChannel = interaction.channel;

      // 5. Restore User Permissions (Let them see the channel again)
      await ticketChannel.permissionOverwrites
        .edit(ticket.authorId, {
          [PermissionsBitField.Flags.ViewChannel]: true,
        })
        .catch(() => null);

      // 👇 THE CATEGORY SHIFT FIX (Moves it back to the open category) 👇
      if (ticketConfig.parentId) {
        await ticketChannel.setParent(ticketConfig.parentId, { lockPermissions: false }).catch(() => null);
      }

      // 6. Update Main Embed Back to "Opened"
      const ticketMsgId = ticket.getDataValue('ticketMsgId');
      const ticketMsg = await ticketChannel.messages.fetch(ticketMsgId).catch(() => null);
      if (ticketMsg?.embeds[0]) {
        const newEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
          .setColor('#77B255')
          .setFields(
            ticketMsg.embeds[0].fields.map(f => (f.name.toLowerCase() === 'status' ? { ...f, value: 'Opened ✅' } : f)),
          );
        await ticketMsg.edit({ embeds: [newEmbed] }).catch(() => null);
      }

      // 7. Update Logs Back to "Opened"
      if (ticketConfig.getDataValue('logs') && ticket.getDataValue('logId') && ticketConfig.logsChannelId) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId')).catch(() => null);
            if (logMsg?.embeds[0]) {
              const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#77B255')
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase() === 'status:' ? { ...f, value: 'Opened ✅' } : f,
                  ),
                );
              await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
            }
          }
        } catch (err) {
          console.log('Log update failed');
        }
      }

      // 8. Clean up and Announce
      // Delete the message that held the Reopen/Delete buttons so it can't be clicked again
      await interaction.message.delete().catch(() => null);

      await interaction.editReply({ content: 'Processing reopen...' });
      await ticketChannel.send(`Ticket reopened by <@${interaction.user.id}> 🔓`);
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: 'An error occurred while reopening the ticket.' }).catch(() => null);
    }
  },
};
