import { SlashCommandBuilder } from 'discord.js';
import claim from './subCommands/claim.js';
import unclaim from './subCommands/unclaim.js';
import transfer from './subCommands/transfer.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket Management')
    .addSubcommand(sub => sub.setName('claim').setDescription('Claim the ticket'))
    .addSubcommand(sub => sub.setName('unclaim').setDescription('unclaim the ticket'))
    .addSubcommand(sub =>
      sub
        .setName('transfer')
        .setDescription('transfer the ticket to other admin')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Who do you want to transfer the ticket to').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'claim') return claim.execute(interaction);
    if (sub === 'unclaim') return unclaim.execute(interaction);
    if (sub === 'transfer') return transfer.execute(interaction);
  },
};
