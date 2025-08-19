import Ticket from '../../../database/models/Ticket.js';
import TicketConfig from '../../../database/models/TicketConfig.js';
import { PermissionsBitField, EmbedBuilder } from 'discord.js';

export default async function createTicket(reaction, user, userTickets) {
  await reaction.users.remove(user.id).catch(console.error);

  if (userTickets[user.id]?.active) {
    user.send('You already have an open ticket.');
    return;
  }
  userTickets[user.id] = { active: true };

  const ticketConfig = await TicketConfig.findOne({ where: { messageId: reaction.message.id } });
  if (!ticketConfig) return;

  const existingTicket = await Ticket.findOne({ where: { authorId: user.id, resolved: false } });
  if (existingTicket) {
    user.send('You already have an open ticket.');
    return;
  }

  clearTimeout(userTickets[user.id].timeout);

  userTickets[user.id].timeout = setTimeout(async () => {
    const roleIds = JSON.parse(ticketConfig.roles || '[]');
    const permissions = roleIds.map(id => ({
      allow: [PermissionsBitField.Flags.ViewChannel],
      id,
    }));

    const channel = await reaction.message.guild.channels.create({
      name: 'ticket',
      parent: ticketConfig.parentId,
      permissionOverwrites: [
        { deny: [PermissionsBitField.Flags.ViewChannel], id: reaction.message.guild.id },
        { allow: [PermissionsBitField.Flags.ViewChannel], id: user.id },
        ...permissions,
      ],
    });

    const ticketMsg = await channel.send(
      `## 🎫 This ticket was opened by ${user} \n > 💾 Your ticket will be saved. \n React with this emoji 🔏 to close the ticket.\n Ticket claimed by: not claimed`
    );
    await ticketMsg.react('🔏');

    const ticket = await Ticket.create({
      authorId: user.id,
      channelId: channel.id,
      guildId: reaction.message.guild.id,
      resolved: false,
      closedMessageId: ticketMsg.id,
      claimed: false,
    });

    if (ticketConfig.getDataValue('logs') === true) {
      const logsChannelId = ticketConfig.getDataValue('logsChannelId');
      const logsChannel = await reaction.message.guild.channels.fetch(logsChannelId);

      const logEmbed = new EmbedBuilder()
        .setTitle(`<#${channel.id}>`)
        .setColor('#77B255')
        .addFields(
          { name: 'opened by:', value: `<@${user.id}>`, inline: true },
          { name: 'claimed by:', value: 'not claimed', inline: true },
          { name: 'status:', value: 'opened ✅', inline: true }
        );

      const log = await logsChannel.send({ embeds: [logEmbed] });
      ticket.update({
        logId: log.id,
      });
    } else {
      console.log('there is no log configure');
    }

    const ticketId = String(ticket.ticketId).padStart(4, '0');
    await channel.edit({ name: `ticket-${ticketId}` });
  }, 2000);
}
