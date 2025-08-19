import deleteMessage from './actions/deleteMessage.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    await deleteMessage(message);
  },
};
