import userTickets from '../../userTickets.js';
import close from './utils/close.js';

export default {
  customId: 'close',
  async execute(interaction) {
    close.execute(interaction, userTickets);
  },
};
