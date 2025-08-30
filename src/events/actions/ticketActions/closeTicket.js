import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';
import * as dht from 'discord-html-transcripts';

export default async function closeTicket(reaction, user, userTickets) {
  const ticket = await Ticket.findOne({
    where: { channelId: reaction.message.channel.id, resolved: false },
  });
  if (!ticket) return;

  const closeReq = ticket.getDataValue('closeReq');
  const ticketConfig = await TicketConfig.findOne({ where: { guildId: reaction.message.guild.id } });

  const member = await reaction.message.guild.members.fetch(user.id);
  const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
  const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

  if (!isAllowed && !closeReq) {
    await reaction.message.channel.send(`<@${user.id}> requested to close the ticket`);
    await ticket.update({ closeReq: true });
    return;
  }

  if (isAllowed) {
    const msg = await reaction.message.channel.send('Are you sure you want to close this ticket?');
    await msg.react('✅');
    await msg.react('❌');

    const filter = (r, u) => ['✅', '❌'].includes(r.emoji.name) && !u.bot;
    const collector = msg.createReactionCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async r => {
      if (r.emoji.name === '❌') return reaction.message.channel.send('Closing canceled');

      if (r.emoji.name === '✅') {
        const ticketChannel = reaction.message.channel;

        await reaction.message.channel.send('Closing ticket...');
        await ticketChannel.permissionOverwrites.edit(ticket.authorId, { ViewChannel: false });
        await ticket.update({ resolved: true, closedMessageId: reaction.message.id });

        userTickets[ticket.authorId].active = false;
        userTickets[ticket.authorId].timeout && clearTimeout(userTickets[ticket.authorId].timeout);

        await ticketChannel.edit({ name: `${ticketChannel.name}-closed` });

        // Generate HTML transcript
        const transcript = await dht.createTranscript(ticketChannel, {
          limit: -1,
          returnBuffer: false,
          fileName: `${ticketChannel.name}-transcript.html`,
        });

        // Send transcript to logs channel if configured
        if (ticketConfig && ticketConfig.logsChannelId) {
          try {
            const logsChannel = await reaction.message.guild.channels.fetch(ticketConfig.logsChannelId);
            await logsChannel.send({
              content: `📑 Transcript for ticket **${ticketChannel.name}**`,
              files: [transcript],
            });
          } catch (err) {
            console.log('Failed to send transcript to logs channel:', err);
          }
        }

        // DM the ticket creator
        try {
          const ticketOwner = await reaction.message.guild.members.fetch(ticket.authorId);
          await ticketOwner.send({
            content: `📑 Here’s the transcript for your ticket **${ticketChannel.name}**`,
            files: [transcript],
          });
        } catch (err) {
          console.log("Couldn't DM the ticket creator:", err);
        }

        // Update log embed if configured
        if (ticketConfig && ticket.getDataValue('logId')) {
          try {
            const logsChannel = await reaction.message.guild.channels.fetch(ticketConfig.logsChannelId);
            const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId'));
            const embed = logMsg.embeds[0];
            const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor('#A0041E');
            embed.fields.forEach(field => {
              newEmbed.addFields(
                field.name.toLowerCase() === 'status:'
                  ? { name: 'status:', value: 'Closed 🔏', inline: field.inline }
                  : field
              );
            });
            await logMsg.edit({ embeds: [newEmbed] });
          } catch (err) {
            console.log('Failed to update log embed:', err);
          }
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
}
