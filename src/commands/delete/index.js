import { SlashCommandBuilder, ChannelType } from 'discord.js';
import TicketConfig from '../../../database/models/TicketConfig.js';
import Ticket from '../../../database/models/Ticket.js';
import deleteTicket from './subCommands/deleteTicket.js';
import createChannel from './subCommands/create-delete-channel.js';
import setChannel from './subCommands/set-delete-channel.js';
import stop from './subCommands/stop-delete-channel.js';
import closedTicket from './subCommands/deleteClosedTickets.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete all closed tickets')
    .addSubcommand(sub =>
      sub
        .setName('create-channel')
        .setDescription('Creates a channel to delete all closed tickets')
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Choose the category to create the channel in.')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('set-channel')
        .setDescription('sets the delete channel for an existing channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Chose the channel. "leave blank for this channel"')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub => sub.setName('stop-delete-channel').setDescription('Stops the delete closed ticket channel.'))
    .addSubcommand(sub =>
      sub.setName('closed-tickets').setDescription('Deletes all the closed ticket. Use it in the delete channel')
    )
    .addSubcommand(sub => sub.setName('ticket').setDescription('Delete the current ticket')),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id } });

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id },
      });
      if (!ticketConfig) {
        return interaction.editReply({
          content: 'Ticket system not configured for this server.',
        });
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'create-channel') return createChannel.execute(interaction);
      if (sub === 'set-channel') return setChannel.execute(interaction);
      if (sub === 'stop') return stop.execute(interaction);
      if (sub === 'ticket') return deleteTicket.execute(interaction, ticket, ticketConfig);
      if (sub === 'closed-tickets') return closedTicket.execute(interaction, ticketConfig);
    } catch (error) {
      console.error('Error in delete command:', error);
      await interaction.editReply({
        content: 'An error occurred while deleting tickets.',
      });
    }
  },
};
