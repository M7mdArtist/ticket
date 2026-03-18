import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';
import transcriptHandler from '../../../utils/transcripts.js';

export default {
  async execute(interaction, userTickets) {
    try {
      // 1. Instantly defer to prevent "Interaction Failed"
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({
        where: { channelId: interaction.channel.id, resolved: false },
      });
      if (!ticket) return interaction.editReply({ content: 'No active ticket found in this channel.' });

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: ticket.type },
      });
      if (!ticketConfig) return interaction.editReply({ content: 'Ticket system is not configured.' });

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isAllowed) {
        if (!ticket.closeReq) {
          await ticket.update({ closeReq: true });
          await interaction.editReply({ content: `You requested to close the ticket. Staff will handle it.` });
          await interaction.channel.send(`<@${interaction.user.id}> requested to close the ticket`);
        } else {
          await interaction.editReply({ content: `You already requested to close the ticket.` });
        }
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirmClose').setLabel('✅ Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancelClose').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary),
      );

      // 2. Attach collector directly to the response message, NOT the channel
      const response = await interaction.editReply({
        content: 'Are you sure you want to close this ticket?',
        components: [row],
      });

      const collector = response.createMessageComponentCollector({
        filter: i => ['confirmClose', 'cancelClose'].includes(i.customId) && i.user.id === interaction.user.id,
        time: 15000,
        max: 1,
      });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          await interaction.editReply({ components: [] }).catch(() => null);

          if (i.customId === 'cancelClose') {
            await i.followUp({ content: 'Closing canceled ❌', ephemeral: true });
            return;
          }

          if (i.customId === 'confirmClose') {
            const ticketChannel = interaction.channel;
            await i.followUp({ content: 'Processing closure...', ephemeral: true }).catch(() => null);

            // --- Database ---
            await ticket.update({ resolved: true, closedMessageId: i.id });

            // --- Memory Wipe (Using Ticket Type) ---
            const ticketKey = `${interaction.guild.id}-${ticket.authorId}-${ticket.type}`;
            if (userTickets[ticketKey]) {
              if (userTickets[ticketKey].timeout) clearTimeout(userTickets[ticketKey].timeout);
              delete userTickets[ticketKey];
            }

            // --- Permissions (Non-blocking) ---
            ticketChannel.permissionOverwrites
              .edit(ticket.authorId, {
                [PermissionsBitField.Flags.ViewChannel]: false,
              })
              .catch(() => null);

            // --- Rename (Non-blocking: Crucial to bypass the 10-minute rate limit freeze) ---
            ticketChannel.edit({ name: `${ticketChannel.name}-closed` }).catch(() => null);

            // --- Transcript ---
            try {
              await transcriptHandler.execute(ticketChannel, ticket, ticketConfig, interaction.guild);
            } catch (e) {
              console.error('Transcript Error:', e);
            }

            // --- Update Main Embed ---
            const ticketMsgId = ticket.getDataValue('ticketMsgId');
            const ticketMsg = await ticketChannel.messages.fetch(ticketMsgId).catch(() => null);
            if (ticketMsg?.embeds[0]) {
              const newEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
                .setColor('#A0041E')
                .setFields(
                  ticketMsg.embeds[0].fields.map(f =>
                    f.name.toLowerCase() === 'status' ? { ...f, value: 'Closed 🔏' } : f,
                  ),
                );
              await ticketMsg.edit({ embeds: [newEmbed] }).catch(() => null);
            }

            // --- Update Logs ---
            if (ticketConfig.getDataValue('logs') && ticket.getDataValue('logId') && ticketConfig.logsChannelId) {
              try {
                const logsChannel = await interaction.guild.channels
                  .fetch(ticketConfig.logsChannelId)
                  .catch(() => null);
                if (logsChannel) {
                  const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId')).catch(() => null);
                  if (logMsg?.embeds[0]) {
                    const logEmbed = EmbedBuilder.from(logMsg.embeds[0])
                      .setColor('#A0041E')
                      .setFields(
                        logMsg.embeds[0].fields.map(f =>
                          f.name.toLowerCase() === 'status:' ? { ...f, value: 'Closed 🔏' } : f,
                        ),
                      );
                    await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
                  }
                }
              } catch (err) {
                console.log('Log update failed');
              }
            }

            try {
              const author = await interaction.guild.members.fetch(ticket.authorId);
              await author.send(`Your ticket <#${ticketChannel.id}> has been closed by <@${interaction.user.id}>.`);
            } catch (err) {
              /* ignore */
            }

            // --- Final Message & Restored Buttons ---
            const afterClosing = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('reOpen').setLabel('🔁 Reopen').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('delete').setLabel('🔴 Delete').setStyle(ButtonStyle.Danger),
            );

            await ticketChannel.send({
              content: 'Ticket closed successfully 🤙',
              components: [afterClosing],
            });
          }
        } catch (err) {
          console.error(err);
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction
            .editReply({ content: 'Ticket confirmation timed out. Closing canceled.', components: [] })
            .catch(() => null);
        }
      });
    } catch (error) {
      console.error(error);
    }
  },
};
