import { SlashCommandBuilder } from 'discord.js';
import claim from './subCommands/claim.js';
import unclaim from './subCommands/unclaim.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket Management')
    .addSubcommand(sub => sub.setName('claim').setDescription('Claim the ticket'))
    .addSubcommand(sub => sub.setName('unclaim').setDescription('unclaim the ticket')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'claim') return claim.execute(interaction);
    if (sub === 'unclaim') return unclaim.execute(interaction);
  },
};
