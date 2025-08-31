import unclaim from './utils/unclaim.js';
export default {
  customId: 'unclaim',
  async execute(interaction) {
    unclaim.execute(interaction);
  },
};
