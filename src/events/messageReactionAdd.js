import client from '../clientLoader.js';
import userTickets from '../userTickets.js';
import createTicket from './actions/ticketActions/createTicket.js';
import closeTicket from './actions/ticketActions/closeTicket.js';

export default {
  name: 'messageReactionAdd', // required for loadEvents.js
  once: false, // optional
  execute: async (reaction, user, client) => {
    if (user.bot) return;

    if (reaction.emoji.name === '🎫') {
      await createTicket(reaction, user, userTickets);
    } else if (reaction.emoji.name === '🔏') {
      await closeTicket(reaction, user, userTickets);
    }
  },
};
