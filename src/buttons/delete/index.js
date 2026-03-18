import userTickets from '../../userTickets.js';
import command from './utils/delete.js';

export default {
  customId: 'delete',
  async execute(interaction) {
    command.execute(interaction, userTickets);
  },
};
