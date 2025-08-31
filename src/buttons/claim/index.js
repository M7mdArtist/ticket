import claim from './utils/claim.js';
export default {
  customId: 'claim',
  async execute(interaction) {
    claim.execute(interaction);
  },
};
