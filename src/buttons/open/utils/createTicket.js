import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { createTicketEmbed } from './createTicketEmbed.js';
import { PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export default {
  async execute(interaction, userTickets) {
    const user = interaction.user;

    // Check if user already has active ticket
    if (userTickets[user.id]?.active) {
      await interaction.reply({
        content: 'You already have an open ticket.',
        ephemeral: true,
      });
      return;
    }

    // Check if ticket system is configured
    const ticketConfig = await TicketConfig.findOne({ where: { messageId: interaction.message.id } });
    if (!ticketConfig) return;

    // Check if user already has unresolved ticket
    const existingTicket = await Ticket.findOne({ where: { authorId: user.id, resolved: false } });
    if (existingTicket) {
      await interaction.reply({
        content: 'You already have an open ticket.',
        ephemeral: true,
      });
      return;
    }

    // Mark user as active immediately
    userTickets[user.id] = { active: true };

    const roleIds = JSON.parse(ticketConfig.roles || '[]');
    const permissions = roleIds.map(id => ({
      allow: [PermissionsBitField.Flags.ViewChannel],
      id,
    }));

    await interaction.reply({ content: '🎫 Your ticket is being created...', ephemeral: true });

    // Create channel instantly
    const channel = await interaction.guild.channels.create({
      name: 'ticket',
      parent: ticketConfig.parentId,
      permissionOverwrites: [
        { deny: [PermissionsBitField.Flags.ViewChannel], id: interaction.guild.id },
        { allow: [PermissionsBitField.Flags.ViewChannel], id: user.id },
        ...permissions,
      ],
    });

    const embed = createTicketEmbed({
      user: interaction.user,
      channelId: channel.id,
      createdAt: new Date(),
    });

    const close = new ButtonBuilder().setCustomId('close').setLabel('Close 🔏').setStyle(ButtonStyle.Danger);
    const claim = new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Primary);
    const unclaim = new ButtonBuilder().setCustomId('unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(close, claim, unclaim);
    const ticketMsg = await channel.send({ embeds: [embed], components: [row] });

    const ticket = await Ticket.create({
      authorId: user.id,
      channelId: channel.id,
      guildId: interaction.guild.id,
      resolved: false,
      ticketMsgId: ticketMsg.id,
      claimed: false,
      closerReq: false,
    });

    if (ticketConfig.getDataValue('logs') === true) {
      const logsChannelId = ticketConfig.getDataValue('logsChannelId');
      const logsChannel = await interaction.guild.channels.fetch(logsChannelId);

      const logEmbed = new EmbedBuilder()
        .setTitle(`<#${channel.id}>`)
        .setColor('#77B255')
        .addFields(
          { name: 'Opened by:', value: `<@${user.id}>`, inline: true },
          { name: 'Claimed by:', value: 'Not claimed', inline: true },
          { name: 'Status:', value: 'Opened ✅', inline: true }
        );

      const log = await logsChannel.send({ embeds: [logEmbed] });
      await ticket.update({ logId: log.id });
    } else {
      console.log('There is no log configured');
    }

    const ticketId = String(ticket.ticketId).padStart(4, '0');
    await channel.edit({ name: `ticket-${ticketId}` });

    await interaction.editReply({ content: `Your ticket has been created ✅ <#${channel.id}>` });
  },
};
