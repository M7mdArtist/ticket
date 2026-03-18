import userTickets from '../../userTickets.js';
import reOpen from './utils/reOpen.js';

export default {
  customId: 'reOpen',
  async execute(interaction) {
    reOpen.execute(interaction, userTickets);
  },
};
