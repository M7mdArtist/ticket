import { SlashCommandBuilder } from 'discord.js';
import add from './subcommands/add.js';
import remove from './subcommands/remove.js';
import list from './subcommands/list.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add ticket permission to a role')
        .addRoleOption(opt => opt.setName('role').setDescription('Choose the role').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove ticket permission from a role')
        .addRoleOption(opt => opt.setName('role').setDescription('Choose the role').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List all roles with ticket permission')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') return add.execute(interaction);
    if (sub === 'remove') return remove.execute(interaction);
    if (sub === 'list') return list.execute(interaction);
    return interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
  },
};
