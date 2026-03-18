import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { createTicketEmbed } from './createTicketEmbed.js';
import { PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export default {
  async execute(interaction, userTickets) {
    console.log('\n=========================================');
    console.log('🎫 OPEN PROCESS INITIATED');
    console.log('=========================================');

    // 1. INSTANTLY acknowledge the button to stop "Interaction Failed"
    await interaction.deferReply({ ephemeral: true });
    console.log('[Step 1] Interaction deferred.');

    try {
      // 2. Fetch Config FIRST to prevent crashes
      const ticketConfig = await TicketConfig.findOne({ where: { messageId: interaction.message.id } });
      if (!ticketConfig) {
        console.log('❌ Error: Config not found for this message.');
        return interaction.editReply({ content: 'Ticket system is not configured.' });
      }

      const user = interaction.user;
      const type = ticketConfig.type;

      // 3. THE MEMORY FIX: Include the type in the key!
      const ticketKey = `${interaction.guild.id}-${user.id}-${type}`;

      // 4. State & Database Checks
      console.log(`[Step 2] Checking memory and DB for existing ${type} tickets...`);
      if (userTickets[ticketKey]?.active) {
        console.log(`⚠️ User blocked: Memory lock active for ${type}.`);
        return interaction.editReply({ content: `You already have an open ${type} ticket in this server.` });
      }

      const existingTicket = await Ticket.findOne({
        where: { authorId: user.id, guildId: interaction.guild.id, resolved: false, type: type },
      });

      if (existingTicket) {
        console.log(`⚠️ User blocked: DB record exists for ${type}.`);
        return interaction.editReply({ content: `You already have an open ${type} ticket in this server.` });
      }

      // 5. Lock Memory (Instantly prevents users from double-clicking the button)
      userTickets[ticketKey] = { active: true, type: type };
      console.log(`✅ Memory: Locked for key ${ticketKey}`);

      // 6. Build Permissions
      console.log('[Task A] Setting up permissions...');
      const roleIds = JSON.parse(ticketConfig.roles || '[]');
      const permissionOverwrites = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Hide from public
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, // Allow User
        ...roleIds.map(id => ({
          id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        })), // Allow Staff
      ];

      // 7. Create Channel
      console.log('[Task B] Creating Discord channel...');
      const channel = await interaction.guild.channels.create({
        name: `${type}-pending`, // Temporary name until we get the DB ID
        parent: ticketConfig.parentId,
        permissionOverwrites: permissionOverwrites,
      });
      console.log(`✅ Channel created: ${channel.id}`);

      // 8. Setup Embed & Buttons
      console.log('[Task C] Sending initial ticket message...');
      const embed = createTicketEmbed({ user, channelId: channel.id, createdAt: new Date() });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close').setLabel('Close 🔏').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
      );

      // Ping the user so they see the channel immediately
      const ticketMsg = await channel.send({ content: `Welcome <@${user.id}>!`, embeds: [embed], components: [row] });
      console.log('✅ Ticket message sent.');

      // 9. Database Creation
      console.log('[Task D] Creating Database record...');
      const ticket = await Ticket.create({
        authorId: user.id,
        channelId: channel.id,
        guildId: interaction.guild.id,
        resolved: false,
        ticketMsgId: ticketMsg.id,
        claimed: false,
        closerReq: false,
        type: type, // Ensure type is saved to DB!
      });
      console.log(`✅ DB Record created with ID: ${ticket.ticketId}`);

      // 10. Mod Logs
      console.log('[Task E] Updating Mod Logs...');
      if (ticketConfig.getDataValue('logs') && ticketConfig.getDataValue('logsChannelId')) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle(`🎫 New Ticket: ${type}`)
              .setColor('#77B255')
              .addFields(
                { name: 'Opened by:', value: `<@${user.id}>`, inline: true },
                { name: 'Channel:', value: `<#${channel.id}>`, inline: true },
                { name: 'Status:', value: 'Opened ✅', inline: true },
                // 👇 Add this line back in!
                { name: 'Claimed by:', value: 'Not claimed 🟡', inline: true },
              )
              .setTimestamp();

            const log = await logsChannel.send({ embeds: [logEmbed] });
            await ticket.update({ logId: log.id });
            console.log('✅ Logs sent successfully.');
          }
        } catch (err) {
          console.log('⚠️ Logs Error:', err.message);
        }
      } else {
        console.log('⏭️ Logs skipped (disabled or no channel set).');
      }

      // 11. Rename Channel (Non-blocking so it doesn't hang if Discord limits us)
      console.log('[Task F] Renaming channel to match ticket ID...');
      const ticketIdStr = String(ticket.ticketId).padStart(4, '0');
      channel
        .edit({ name: `${type}-${ticketIdStr}` })
        .then(() => console.log(`✅ Channel renamed to ${type}-${ticketIdStr}`))
        .catch(e => console.log(`⚠️ Channel rename delayed (Rate Limit):`, e.message));

      // 12. Final Success Message
      await interaction.editReply({ content: `Your ticket has been created! ✅ <#${channel.id}>` });

      console.log('\n🎉 ========================================= 🎉');
      console.log('       OPEN SEQUENCE FULLY COMPLETE');
      console.log('🎉 ========================================= 🎉\n');
    } catch (error) {
      console.error('❌ CRITICAL ERROR during ticket creation:', error);

      // THE SAFETY NET: If the bot crashes, wipe the memory lock so the user isn't stuck forever.
      try {
        const ticketConfigFallback = await TicketConfig.findOne({ where: { messageId: interaction.message.id } });
        if (ticketConfigFallback) {
          const fallbackKey = `${interaction.guild.id}-${interaction.user.id}-${ticketConfigFallback.type}`;
          if (userTickets[fallbackKey]) delete userTickets[fallbackKey];
          console.log(`🧹 Safety Net: Cleared memory lock for ${fallbackKey} due to crash.`);
        }
      } catch (e) {
        /* silent catch */
      }

      await interaction
        .editReply({ content: 'An error occurred while creating your ticket. Please try again later.' })
        .catch(() => null);
    }
  },
};
