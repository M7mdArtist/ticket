import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import transcriptHandler from '../../../utils/transcripts.js';

export default {
  async execute(interaction, userTickets) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) return interaction.editReply({ content: 'No active ticket found.' });

      // 1. Fetch the specific Category Data for this ticket type
      const categoryData = await TicketCategory.findOne({
        where: { guildId: interaction.guild.id, name: ticket.type },
      });
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      // 2. Permission Check
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isAllowed) {
        if (!ticket.closeReq) {
          await ticket.update({ closeReq: true });
          await interaction.channel.send(
            `⚠️ <@${interaction.user.id}> requested to close the ticket. Staff will handle it.`,
          );
          return interaction.editReply({ content: 'Close request sent.' });
        }
        return interaction.editReply({ content: 'A close request is already pending.' });
      }

      // 3. Confirmation UI
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirmClose').setLabel('✅ Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancelClose').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary),
      );

      const response = await interaction.editReply({
        content: 'Are you sure you want to close this ticket?',
        components: [row],
      });
      const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 10000,
        max: 1,
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        if (i.customId === 'cancelClose') return interaction.editReply({ content: 'Cancelled.', components: [] });

        const ticketChannel = interaction.channel;
        await ticket.update({ resolved: true });

        // Memory Wipe
        const ticketKey = `${interaction.guild.id}-${ticket.authorId}-${ticket.type}`;
        delete userTickets[ticketKey];

        // Permissions: Hide from User & Remove added users
        await ticketChannel.permissionOverwrites
          .edit(ticket.authorId, { [PermissionsBitField.Flags.ViewChannel]: false })
          .catch(() => null);
        ticketChannel.permissionOverwrites.cache.forEach(async ov => {
          if (ov.type === 1 && ov.id !== ticket.authorId && ov.id !== interaction.client.user.id) {
            await ticketChannel.permissionOverwrites.delete(ov.id).catch(() => null);
          }
        });

        // 👇 DYNAMIC CATEGORY SHIFT 👇
        if (categoryData?.closedCategoryId) {
          await ticketChannel.setParent(categoryData.closedCategoryId, { lockPermissions: false }).catch(() => null);
        }

        // Update Embed Status
        const ticketMsg = await ticketChannel.messages.fetch(ticket.ticketMsgId).catch(() => null);
        if (ticketMsg?.embeds[0]) {
          const closedEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
            .setColor('#A0041E')
            .setFields(
              ticketMsg.embeds[0].fields.map(f => (f.name.includes('Status') ? { ...f, value: 'Closed 🔏' } : f)),
            );
          await ticketMsg.edit({ embeds: [closedEmbed], components: [] }).catch(() => null);
        }

        // Log Update & Transcript
        try {
          await transcriptHandler.execute(ticketChannel, ticket, ticketConfig, interaction.guild);
        } catch (e) {}
        if (categoryData?.logs && categoryData.logsChannelId && ticket.logId) {
          try {
            const logsChannel = await interaction.guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
            if (logsChannel) {
              const logMsg = await logsChannel.messages.fetch(ticket.logId).catch(() => null);
              if (logMsg) {
                const closedLog = EmbedBuilder.from(logMsg.embeds[0])
                  .setColor('#A0041E') // Red for closed
                  .setFields(
                    logMsg.embeds[0].fields.map(f => {
                      if (f.name.includes('Status')) return { ...f, value: 'Closed 🔏' };
                      return f;
                    }),
                  );
                await logMsg.edit({ embeds: [closedLog] });
              }
            }
          } catch (err) {
            console.log('Log update failed in close.js');
          }
        }

        await ticketChannel.send({
          content: 'Ticket closed successfully 🤙',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('reOpen').setLabel('🔁 Reopen').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('delete').setLabel('🔴 Delete').setStyle(ButtonStyle.Danger),
            ),
          ],
        });
      });
    } catch (e) {
      console.error(e);
    }
  },
};
