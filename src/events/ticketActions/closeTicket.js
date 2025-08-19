import Ticket from '../../../database/models/Ticket.js';
import TicketConfig from '../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';

export default async function closeTicket(reaction, user, userTickets) {
  const ticket = await Ticket.findOne({
    where: { channelId: reaction.message.channel.id, resolved: false },
  });
  if (!ticket) return;

  const ticketConfig = await TicketConfig.findOne({ where: { guildId: reaction.message.guild.id } });

  const msg = await reaction.message.channel.send('Are you sure you want to close this ticket?');
  await msg.react('✅');
  await msg.react('❌');

  const filter = (r, u) => ['✅', '❌'].includes(r.emoji.name) && !u.bot;
  const collector = msg.createReactionCollector({ filter, time: 15000, max: 1 });

  collector.on('collect', async r => {
    if (r.emoji.name === '❌') return reaction.message.channel.send('Closing canceled');
    if (r.emoji.name === '✅') {
      await reaction.message.channel.send('Closing ticket...');
      await reaction.message.channel.permissionOverwrites.edit(ticket.authorId, { ViewChannel: false });
      await ticket.update({ resolved: true, closedMessageId: reaction.message.id });

      userTickets[ticket.authorId].active = false;
      userTickets[ticket.authorId].timeout && clearTimeout(userTickets[ticket.authorId].timeout);

      const ticketChannel = reaction.message.channel;
      await ticketChannel.edit({ name: `${ticketChannel.name}-closed` });

      // Update log embed if configured
      if (ticketConfig && ticket.getDataValue('logId')) {
        const logsChannel = await reaction.message.guild.channels.fetch(ticketConfig.logsChannelId);
        const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId'));
        const embed = logMsg.embeds[0];
        const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor('#A0041E');
        embed.fields.forEach(field => {
          newEmbed.addFields(
            field.name === 'status:' ? { name: 'status:', value: 'Closed 🔏', inline: field.inline } : field
          );
        });
        await logMsg.edit({ embeds: [newEmbed] });
      }

      await reaction.message.channel.send('Ticket closed successfully 🤙');
    }
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      const editedMsg = await msg.edit('Ticket confirmation timed out. Closing canceled.');
      setTimeout(() => editedMsg.delete().catch(() => {}), 5000);
    }
  });
}
