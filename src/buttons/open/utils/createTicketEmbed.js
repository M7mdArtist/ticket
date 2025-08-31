import { EmbedBuilder } from 'discord.js';

export function createTicketEmbed({
  user,
  channelId,
  status = 'Opened ✅',
  claimedBy = 'Not claimed',
  createdAt = new Date(),
}) {
  return new EmbedBuilder()
    .setTitle(`🎫 <#${channelId}>`)
    .setDescription(`Hello <@${user.id}>, your ticket has been created! Here’s everything you need to know:`)
    .addFields(
      { name: 'Opened by', value: `<@${user.id}>`, inline: true },
      { name: 'Ticket ID', value: `<#${channelId}>`, inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Claimed by', value: claimedBy, inline: true },
      { name: 'Date Created', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:f>`, inline: true }, // Discord timestamp
      {
        name: 'Instructions',
        value:
          '• Please describe your issue clearly.\n' +
          '• Staff will respond as soon as possible.\n' +
          '• Click the close button to request to close the ticket',
      }
    )
    .setColor('#77B255')
    .setFooter({ text: 'Ticket System' })
    .setTimestamp(createdAt); // also sets the footer timestamp
}
