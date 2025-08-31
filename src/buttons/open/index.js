import createTicket from './utils/createTicket.js';
import userTickets from '../../userTickets.js';

export default {
  customId: 'open',
  async execute(interaction) {
    await createTicket.execute(interaction, userTickets);
  },
};
