import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';
import transcriptHandler from '../../../utils/transcripts.js';

export default {
  async execute(interaction, userTickets) {
    console.log('\n=========================================');
    console.log('🔴 DELETE PROCESS INITIATED');
    console.log('=========================================');

    try {
      // 1. INSTANTLY acknowledge the button
      await interaction.deferReply();
      console.log('[Step 1] Interaction deferred.');

      // 2. Fetch Ticket (Must be resolved/closed to be deleted)
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: true } });
      if (!ticket) {
        console.log('❌ Error: No closed ticket found.');
        return interaction.editReply({
          content: 'No closed ticket found to delete. (Is it already deleted or still open?)',
        });
      }

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: ticket.type } });
      console.log(`[Step 2] Fetched data for ticket type: ${ticket.type}`);

      // 3. Permission Check
      console.log('[Step 3] Checking user permissions...');
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isAllowed) {
        console.log('⚠️ User denied: Missing staff roles.');
        return interaction.editReply({ content: 'You do not have permission to delete tickets ❌' });
      }

      // --- A. FINAL TRANSCRIPT ---
      console.log('[Task A] Generating final transcript...');
      try {
        await transcriptHandler.execute(interaction.channel, ticket, ticketConfig, interaction.guild);
        console.log('✅ Transcript: Final copy saved.');
      } catch (err) {
        console.log('⚠️ Transcript Error:', err.message);
      }

      // --- B. UPDATE MOD LOGS ---
      console.log('[Task B] Updating Mod Logs to "Deleted"...');
      if (ticket.logId && ticketConfig?.logsChannelId) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.logId).catch(() => null);
            if (logMsg?.embeds[0]) {
              const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#2B2D31') // A dark grey color to signify it's completely gone
                .setFields(
                  logMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase() === 'status:' ? { ...f, value: 'Deleted 🔴' } : f,
                  ),
                );
              await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
              console.log('✅ Logs: Updated to Deleted 🔴.');
            }
          }
        } catch (err) {
          console.log('⚠️ Logs: Failed to update log message.');
        }
      }

      // --- C. MEMORY CLEANUP ---
      console.log('[Task C] Clearing bot memory...');
      const ticketKey = `${interaction.guild.id}-${ticket.authorId}-${ticket.type}`;
      if (userTickets[ticketKey]) {
        delete userTickets[ticketKey]; // Completely removes the entry to save RAM
        console.log(`✅ Memory: Wipe complete for key ${ticketKey}`);
      }

      // (Optional) You could do `await ticket.destroy()` here if you want to wipe it from the Database entirely!
      // Currently, it just remains in the DB as `resolved: true` based on your original code.

      // --- D. COUNTDOWN & DELETION ---
      console.log('[Task D] Initiating 5-second countdown...');
      await interaction.editReply({
        content: 'Channel will be deleted in 5 seconds... ⏳\n*(Requested by <@' + interaction.user.id + '>)*',
      });

      setTimeout(() => {
        console.log('💥 BOOM: Deleting channel via Discord API...');
        interaction.channel
          .delete()
          .then(() => {
            console.log('\n🎉 ========================================= 🎉');
            console.log('       DELETE SEQUENCE FULLY COMPLETE');
            console.log('🎉 ========================================= 🎉\n');
          })
          .catch(e => console.log('⚠️ Deletion Failed:', e.message));
      }, 5000);
    } catch (error) {
      console.error('❌ CRITICAL ERROR inside Delete:', error);
      await interaction.editReply({ content: 'An error occurred during deletion.' }).catch(() => null);
    }
  },
};
