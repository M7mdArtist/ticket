import { ChannelType } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import Ticket from '../../../../database/models/Ticket.js';

export default {
  async execute(interaction, category) {
    // const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
    // if (!ticketConfig)
    //   return interaction.editReply({ content: 'No ticket configuration found for this server.', ephemeral: true });
    // if (!ticketConfig.getDataValue('roles') || ticketConfig.getDataValue('roles') === '[]')
    //   return interaction.editReply({ content: 'No roles are set to manage tickets❌', ephemeral: true });
    // const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
    // const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    // if (!isAllowed) {
    //   return interaction.editReply({
    //     content: `You don't have permission to use this command`,
    //     ephemeral: true,
    //   });
    // }

    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: 'Category channel not found or invalid in the config.' });
    }

    // Fetch all text channels in the specified category
    const channels = interaction.guild.channels.cache.filter(
      ch => ch.parentId === category.id && ch.type === ChannelType.GuildText
    );

    if (!channels.size) {
      return interaction.editReply({ content: 'No text channels found in this category.' });
    }

    // Register each channel as a ticket
    let created = 0;
    for (const channel of channels.values()) {
      // Check if ticket already exists
      const exists = await Ticket.findOne({ where: { channelId: channel.id } });
      if (!exists) {
        const channelName = channel.name.toLowerCase();
        const isClosed = channelName.includes('closed');
        const messages = await channel.messages.fetch({ after: '0', limit: 1 });
        const msg = messages.first();
        if (!msg) continue; // Skip empty channels

        let authorId = null;
        if (msg.embeds.length) {
          const openedByField = msg.embeds[0].fields?.find(f => f.name === 'Opened by');
          if (openedByField) {
            authorId = openedByField.value.replace(/[<@!>]/g, '');
          }
        }
        await Ticket.create({
          //   ticketId: channelName.replace(/\D/g, ''),
          guildId: interaction.guild.id,
          channelId: channel.id,
          resolved: isClosed,
          ticketMsgId: msg.id,
          authorId: authorId,
          claimed: false,
          claimerId: null,
          logId: null,
          closeReq: isClosed,
        });
        created++;
      }
    }

    return interaction.editReply({
      content: `Registered ${created} channel(s) as tickets in the database.`,
    });
  },
};
