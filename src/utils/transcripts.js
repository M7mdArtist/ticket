import * as dht from 'discord-html-transcripts';

/**
 * Generate and send a transcript
 * @param {import("discord.js").TextChannel} ticketChannel
 * @param {Object} ticket Ticket DB row
 * @param {Object} ticketConfig TicketConfig DB row
 * @param {import("discord.js").Guild} guild
 */
export default {
  async execute(ticketChannel, ticket, ticketConfig, guild) {
    try {
      // Generate HTML transcript
      const transcript = await dht.createTranscript(ticketChannel, {
        limit: -1,
        returnBuffer: false,
        fileName: `${ticketChannel.name}-transcript.html`,
      });

      // Send transcript to logs channel if configured
      if (ticketConfig && ticketConfig.logsChannelId) {
        try {
          const logsChannel = await guild.channels.fetch(ticketConfig.logsChannelId);
          await logsChannel.send({
            content: `📑 Transcript for ticket **${ticketChannel.name}**`,
            files: [transcript],
          });
        } catch (err) {
          console.error('Failed to send transcript to logs channel:', err);
        }
      }

      // DM the ticket creator
      try {
        const ticketOwner = await guild.members.fetch(ticket.authorId);
        await ticketOwner.send({
          content: `📑 Here’s the transcript for your ticket **${ticketChannel.name}**`,
          files: [transcript],
        });
      } catch (err) {
        console.error("Couldn't DM the ticket creator:", err);
      }
    } catch (err) {
      console.error('Transcript generation failed:', err);
    }
  },
};
