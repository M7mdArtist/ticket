import TicketConfig from '../../../database/models/TicketConfig.js';

export default async function deleteMessage(message) {
  if (message.author.bot || message.channel.type === 'DM') return;

  try {
    const ticketConfig = await TicketConfig.findOne({
      where: { deleteTicketsChannelId: message.channel.id },
    });

    if (!ticketConfig) {
      console.log('there is no ticket config for this channel');
      return;
    }

    if (message.channel.id === ticketConfig.deleteTicketsChannelId) {
      await message.delete().catch(console.error);
    }
  } catch (error) {
    console.error('error in message delete handler', error);
  }
}
