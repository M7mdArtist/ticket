import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder, PermissionsBitField } from 'discord.js';

export default {
  async execute(interaction, userTickets) {
    console.log('\n=========================================');
    console.log('🔁 REOPEN PROCESS INITIATED');
    console.log('=========================================');

    try {
      // 1. INSTANTLY acknowledge the button
      await interaction.deferReply({ ephemeral: true });
      console.log('[Step 1] Interaction deferred.');

      // 2. Fetch Ticket & Config
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: true } });
      if (!ticket) {
        console.log('❌ Error: Ticket not found or already open.');
        return interaction.editReply({ content: 'This ticket cannot be reopened.' });
      }

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: ticket.type } });
      console.log(`[Step 2] Fetched data for ticket type: ${ticket.type}`);

      // --- A. UPDATE DATABASE & MEMORY (Highest Priority) ---
      console.log('[Task A] Updating Database and Memory...');
      await ticket.update({ resolved: false, closeReq: false });

      const ticketKey = `${interaction.guild.id}-${ticket.authorId}-${ticket.type}`;
      userTickets[ticketKey] = { active: true, type: ticket.type };
      console.log('✅ Database & Memory: Ticket reactivated.');

      // --- B. RESTORE PERMISSIONS (Non-blocking) ---
      console.log('[Task B] Restoring user permissions (Non-blocking)...');
      interaction.channel.permissionOverwrites
        .edit(ticket.authorId, {
          [PermissionsBitField.Flags.ViewChannel]: true,
          [PermissionsBitField.Flags.SendMessages]: true,
        })
        .then(() => console.log('✅ Permissions: Access restored.'))
        .catch(e => console.log('⚠️ Permissions Failed:', e.message));

      // --- C. CREATE STATUS EMBED ---
      const statusEmbed = new EmbedBuilder()
        .setTitle('🔁 Ticket Reopened')
        .setDescription(`This ticket has been reactivated by staff.`)
        .setColor('#77B255')
        .addFields(
          { name: '👤 Opened By', value: `<@${ticket.authorId}>`, inline: true },
          { name: '🔄 Reopened By', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();

      // --- D. UPDATE MAIN EMBED ---
      console.log('[Task C] Updating original ticket embed...');
      const ticketMsg = await interaction.channel.messages.fetch(ticket.ticketMsgId).catch(() => null);
      if (ticketMsg?.embeds[0]) {
        const reopenedEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
          .setColor('#77B255')
          .setFields(
            ticketMsg.embeds[0].fields.map(f => (f.name.toLowerCase() === 'status' ? { ...f, value: 'Open ✅' } : f)),
          );

        await ticketMsg.edit({ embeds: [reopenedEmbed] }).catch(() => null);
        console.log('✅ Embed: Main ticket message updated to Open.');
      }

      // --- E. UPDATE LOGS ---
      console.log('[Task D] Updating Mod Logs...');
      if (ticket.logId && ticketConfig?.logsChannelId) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.logId).catch(() => null);
            if (logMsg?.embeds[0]) {
              const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#77B255')
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase() === 'status:' ? { ...f, value: 'Reopened 🔁' } : f,
                  ),
                );
              await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
              console.log('✅ Logs: Log message updated successfully.');
            }
          }
        } catch (err) {
          console.log('⚠️ Logs: Failed to update log message.');
        }
      }

      // --- F. CLEANUP & NOTIFICATION ---
      console.log('[Task E] Cleaning up UI and sending notifications...');
      await interaction.message.delete().catch(() => null); // Deletes the "Reopen/Delete" buttons

      await interaction.editReply({ content: 'Ticket reopened successfully! ✅' }).catch(() => null);
      await interaction.channel.send({ content: `<@${ticket.authorId}>`, embeds: [statusEmbed] });
      console.log('✅ UI: Buttons removed and notifications sent.');

      // --- G. CHANNEL RENAME (Non-blocking / Last step) ---
      console.log('[Task F] Attempting channel rename (Non-blocking)...');
      const oldName = interaction.channel.name;
      const cleanName = oldName.replace('-closed', '');

      if (oldName !== cleanName) {
        interaction.channel
          .edit({ name: cleanName })
          .then(() => console.log(`✅ Rename: Channel restored to ${cleanName}`))
          .catch(e => console.log('⚠️ Rename: Delayed by Discord rate limits.'));
      } else {
        console.log('⏭️ Rename: Channel name already correct. Skipped.');
      }

      console.log('\n🎉 ========================================= 🎉');
      console.log('       REOPEN SEQUENCE FULLY COMPLETE');
      console.log('🎉 ========================================= 🎉\n');
    } catch (error) {
      console.error('❌ CRITICAL ERROR inside Reopen:', error);
      await interaction.editReply({ content: 'An error occurred during reopening.' }).catch(() => null);
    }
  },
};
