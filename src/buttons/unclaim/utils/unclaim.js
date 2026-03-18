import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    console.log('\n=========================================');
    console.log('🟡 UNCLAIM PROCESS INITIATED');
    console.log('=========================================');

    try {
      // 1. INSTANTLY acknowledge
      await interaction.deferReply({ ephemeral: true });

      // 2. Fetch Ticket
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) {
        return interaction.editReply({ content: 'Invalid channel or ticket is closed ❌' });
      }

      // 3. Verify Claim Status
      if (!ticket.claimed) {
        return interaction.editReply({ content: 'This ticket is not currently claimed by anyone.' });
      }
      if (ticket.claimerId !== interaction.user.id) {
        return interaction.editReply({
          content: `You are not the claimer for this ticket. (<@${ticket.claimerId}> is)`,
        });
      }

      // 4. Fetch Config & Check Permissions
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: ticket.type } });
      if (!ticketConfig) return interaction.editReply({ content: 'Ticket system is not configured.' });

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
      if (!isAllowed) return interaction.editReply({ content: `You don't have permission to use this command ❌` });

      // 5. Update Database (Added the missing 'await' here!)
      console.log(`[Task A] Database: Removing claimer...`);
      await ticket.update({ claimed: false, claimerId: null });

      // 6. Update Main Embed
      console.log('[Task B] Updating Main Ticket Embed...');
      const ticketMsgId = ticket.getDataValue('ticketMsgId');
      if (ticketMsgId) {
        const ticketMsg = await interaction.channel.messages.fetch(ticketMsgId).catch(() => null);
        if (ticketMsg?.embeds[0]) {
          const newEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
            .setColor('#FDCB58') // Yellow for unclaimed
            .setFields(
              ticketMsg.embeds[0].fields.map(f =>
                f.name.toLowerCase().includes('claimed by') ? { ...f, value: 'Not claimed 🟡' } : f,
              ),
            );
          await ticketMsg.edit({ embeds: [newEmbed] }).catch(() => null);
          console.log('✅ Main embed updated.');
        }
      }

      // 7. Update Logs
      console.log('[Task C] Updating Mod Logs...');
      if (ticket.logId && ticketConfig.logsChannelId) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.logId).catch(() => null);
            if (logMsg?.embeds[0]) {
              const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#FDCB58')
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase().includes('claimed by') ? { ...f, value: 'Not claimed 🟡' } : f,
                  ),
                );
              await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
              console.log('✅ Logs updated.');
            }
          }
        } catch (error) {
          console.log('⚠️ Logs Error:', error.message);
        }
      }

      // 8. Final Output
      await interaction.editReply({ content: 'You have unclaimed this ticket 🟡' });
      await interaction.channel.send({ content: `⚠️ This ticket has been unclaimed and is back in the queue.` });

      console.log('🎉 UNCLAIM SEQUENCE COMPLETE\n');
    } catch (error) {
      console.error('❌ Error while un-claiming the ticket:', error);
      await interaction.editReply({ content: 'An error occurred while unclaiming the ticket.' }).catch(() => null);
    }
  },
};
