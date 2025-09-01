import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import transcriptHandler from '../../../utils/transcripts.js';

export default {
  async execute(interaction, userTickets) {
    try {
      const ticket = await Ticket.findOne({
        where: { channelId: interaction.channel.id, resolved: false },
      });
      if (!ticket) return interaction.reply({ content: 'No active ticket found in this channel.', ephemeral: true });

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) return interaction.reply({ content: 'Ticket system is not configured.', ephemeral: true });

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed = member.roles.cache.some(role => allowedRoles.includes(role.id));

      // User request to close
      if (!isAllowed) {
        if (!ticket.closeReq) {
          await ticket.update({ closeReq: true });
          await interaction.reply({
            content: `You requested to close the ticket. An admin will handle it.`,
            ephemeral: true,
          });
          await interaction.channel.send(`<@${interaction.user.id}> requested to close the ticket`);
        } else {
          await interaction.reply({ content: `You already requested to close the ticket.`, ephemeral: true });
        }
        return;
      }

      // Admin confirmation buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirmClose').setLabel('✅ Confirm').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancelClose').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: 'Are you sure you want to close this ticket?',
        components: [row],
        ephemeral: true,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => ['confirmClose', 'cancelClose'].includes(i.customId) && i.user.id === interaction.user.id,
        time: 15000,
        max: 1,
      });

      collector.on('collect', async i => {
        try {
          // Disable buttons immediately
          await i.update({ components: [] });

          if (i.customId === 'cancelClose') {
            await i.followUp({ content: 'Closing canceled ❌', ephemeral: true });
            return;
          }

          if (i.customId === 'confirmClose') {
            const ticketChannel = interaction.channel;

            await i.followUp({ content: 'Closing ticket...', ephemeral: true });

            // Hide channel from user
            await ticketChannel.permissionOverwrites.edit(ticket.authorId, { ViewChannel: false });
            await ticket.update({ resolved: true, closedMessageId: interaction.id });

            const ticketKey = `${interaction.guild.id}-${ticket.authorId}`;

            // Clear userTickets
            if (userTickets[ticketKey]) {
              userTickets[ticketKey].active = false;
              userTickets[ticketKey].timeout && clearTimeout(userTickets[ticketKey].timeout);
            }

            await ticketChannel.edit({ name: `${ticketChannel.name}-closed` });

            // Generate transcript
            await transcriptHandler.execute(ticketChannel, ticket, ticketConfig, interaction.guild);

            // Update original ticket embed
            const ticketMsgId = ticket.getDataValue('ticketMsgId');
            const ticketMsg = await ticketChannel.messages.fetch(ticketMsgId).catch(() => null);
            if (ticketMsg) {
              const ticketEmbed = ticketMsg.embeds[0];
              const newEmbed = new EmbedBuilder()
                .setTitle(ticketEmbed.title ?? null)
                .setDescription(ticketEmbed.description ?? null)
                .setColor('#A0041E');

              if (ticketEmbed.footer) newEmbed.setFooter(ticketEmbed.footer);
              if (ticketEmbed.timestamp) newEmbed.setTimestamp(new Date(ticketEmbed.timestamp));

              ticketEmbed.fields?.forEach(field => {
                if (field.name.toLowerCase() === 'status')
                  newEmbed.addFields({ name: 'Status', value: 'Closed 🔏', inline: field.inline });
                else newEmbed.addFields(field);
              });

              await ticketMsg.edit({ embeds: [newEmbed] });
            }

            // Update log embed if configured
            if (ticketConfig && ticket.getDataValue('logId')) {
              try {
                const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId);
                const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId'));
                const embed = logMsg.embeds[0];
                const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor('#A0041E');
                embed.fields.forEach(field => {
                  newEmbed.addFields(
                    field.name.toLowerCase() === 'status:'
                      ? { name: 'status:', value: 'Closed 🔏', inline: field.inline }
                      : field
                  );
                });
                await logMsg.edit({ embeds: [newEmbed] });
              } catch (err) {
                console.log('Failed to update log embed:', err);
              }
            }

            // DM ticket author
            try {
              const author = await interaction.guild.members.fetch(ticket.authorId);
              await author.send(`Your ticket <#${ticketChannel.id}> has been closed by <@${interaction.user.id}>.`);
            } catch (err) {
              console.log('Failed to DM ticket author:', err);
            }

            await ticketChannel.send('Ticket closed successfully 🤙');
          }
        } catch (err) {
          console.error(err);
        }
      });

      collector.on('end', async collected => {
        if (collected.size === 0) {
          await interaction.editReply({
            content: 'Ticket confirmation timed out. Closing canceled.',
            components: [],
          });
        }
      });
    } catch (error) {
      console.error(error);
    }
  },
};
