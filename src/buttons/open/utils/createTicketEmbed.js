import { EmbedBuilder } from 'discord.js';

export function createTicketEmbed({
  user,
  channelId,
  status = 'Opened ✅',
  claimedBy = 'Not claimed 🟡',
  createdAt = new Date(),
}) {
  return new EmbedBuilder()
    .setTitle(`🎫 Ticket | <#${channelId}>`)
    .setDescription(`Hello <@${user.id}>, your ticket has been created! Here is everything you need to know:`)
    .addFields(
      { name: 'Opened by', value: `<@${user.id}>`, inline: true },
      { name: 'Ticket ID', value: `<#${channelId}>`, inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Claimed by', value: claimedBy, inline: true },
      { name: 'Date Created', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:f>`, inline: true },
      {
        name: 'Instructions',
        value:
          '• Please describe your issue clearly.\n' +
          '• Staff will respond as soon as possible.\n' +
          '• Click the close button to request to close the ticket.\n\n' +
          '• To see who can help you, use the command `/role list`',
      },
    )
    .setColor('#77B255')
    .setFooter({ text: 'Ticket System' })
    .setTimestamp(createdAt);
}
