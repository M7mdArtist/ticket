import { SlashCommandBuilder } from 'discord.js';
import add from './subCommands/add.js';
import remove from './subCommands/remove.js';
import list from './subCommands/list.js';

export default {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Manage extra users in a ticket')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option => option.setName('user').setDescription('The user to add').setRequired(true)),
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option => option.setName('user').setDescription('The user to remove').setRequired(true)),
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List all extra users added to this ticket')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') return add.execute(interaction);
    if (sub === 'remove') return remove.execute(interaction);
    if (sub === 'list') return list.execute(interaction);
  },
};
