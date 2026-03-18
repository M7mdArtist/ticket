import { ChannelType } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';

export default {
  async execute(interaction, category, type, replyMsg) {
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: replyMsg + '\n❌ Category channel not found or invalid.' });
    }

    // 1. Fetch all text channels in the specified category
    const channels = interaction.guild.channels.cache.filter(
      ch => ch.parentId === category.id && ch.type === ChannelType.GuildText,
    );

    if (channels.size === 0) {
      return interaction.editReply({ content: replyMsg + '\n✅ No **old tickets** found in this category.' });
    }

    // 2. Pre-fetch existing tickets to avoid spamming the database in the loop
    const existingTickets = await Ticket.findAll({ where: { guildId: interaction.guild.id } });
    const existingChannelIds = new Set(existingTickets.map(t => t.channelId));

    let created = 0;
    let failed = 0;

    // 3. Loop through channels and register
    for (const channel of channels.values()) {
      // Skip if this channel is already in the database
      if (existingChannelIds.has(channel.id)) continue;

      try {
        const channelName = channel.name.toLowerCase();
        const isClosed = channelName.includes('closed');

        // Fetch the very first message sent in this channel
        const messages = await channel.messages.fetch({ after: '0', limit: 1 });
        const msg = messages.first();
        if (!msg) continue; // Skip entirely empty channels

        let authorId = null;
        if (msg.embeds.length > 0) {
          const openedByField = msg.embeds[0].fields?.find(f => f.name.toLowerCase() === 'opened by');
          if (openedByField) {
            authorId = openedByField.value.replace(/[<@!>]/g, '');
          }
        }

        // Fallback: If no author could be found, assign it to the bot to prevent DB null errors
        if (!authorId) authorId = interaction.client.user.id;

        // 4. Create Database Record
        await Ticket.create({
          guildId: interaction.guild.id,
          channelId: channel.id,
          resolved: isClosed,
          ticketMsgId: msg.id,
          authorId: authorId,
          claimed: false,
          claimerId: null,
          logId: null,
          closeReq: isClosed,
          type: type, // 👈 CRITICAL FIX: Save the type so your new memory logic works
        });

        created++;
      } catch (err) {
        console.error(`Failed to register old ticket #${channel.name}:`, err.message);
        failed++;
      }
    }

    // 5. Final Output Compilation
    replyMsg += `\n✅ Registered **${created}** old channel(s) as \`${type}\` tickets in the database.`;
    if (failed > 0) replyMsg += `\n⚠️ Failed to read **${failed}** channel(s) (Check bot permissions).`;
    replyMsg += '\n\n⚠️ **Do not forget to use `/role add` to assign staff to this ticket type!**';

    await interaction.editReply({ content: replyMsg }).catch(() => null);
  },
};
