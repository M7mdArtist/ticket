import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    console.log('\n=========================================');
    console.log('🙋‍♂️ CLAIM PROCESS INITIATED');
    console.log('=========================================');

    try {
      // 1. INSTANTLY acknowledge
      await interaction.deferReply({ ephemeral: true });

      // 2. Fetch Ticket First
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) {
        return interaction.editReply({ content: 'This is not a valid open ticket channel.' });
      }

      if (ticket.claimed) {
        return interaction.editReply({ content: `This ticket is already claimed by <@${ticket.claimerId}>.` });
      }

      // 3. Fetch Config (Using specific ticket type!)
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: ticket.type } });
      if (!ticketConfig) {
        return interaction.editReply({ content: 'Ticket system is not set up ❌' });
      }

      // 4. Check Permissions
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
      if (!isAllowed) {
        return interaction.editReply({ content: `You don't have permission to use this command ❌` });
      }

      // 5. Update Database
      console.log(`[Task A] Updating Database for claimer: ${interaction.user.tag}`);
      await ticket.update({ claimed: true, claimerId: interaction.user.id });

      // 6. Update Main Embed
      console.log('[Task B] Updating Main Ticket Embed...');
      const ticketMsgId = ticket.getDataValue('ticketMsgId');
      if (ticketMsgId) {
        const ticketMsg = await interaction.channel.messages.fetch(ticketMsgId).catch(() => null);
        if (ticketMsg?.embeds[0]) {
          const newEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
            .setColor('#226699') // Blue for claimed
            .setFields(
              ticketMsg.embeds[0].fields.map(f =>
                f.name.toLowerCase().includes('claimed by') ? { ...f, value: `<@${interaction.user.id}> ☑️` } : f,
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
                .setColor('#226699')
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase().includes('claimed by') ? { ...f, value: `<@${interaction.user.id}> ☑️` } : f,
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
      await interaction.editReply({ content: 'You have successfully claimed this ticket! ☑️' });

      // Optional: Send a public message so the user knows who is helping them
      await interaction.channel.send({
        content: `👋 <@${ticket.authorId}>, your ticket has been claimed by <@${interaction.user.id}>.`,
      });

      console.log('🎉 CLAIM SEQUENCE COMPLETE\n');
    } catch (error) {
      console.error('❌ Error claiming ticket:', error);
      await interaction.editReply({ content: 'An error occurred while claiming the ticket.' }).catch(() => null);
    }
  },
};
