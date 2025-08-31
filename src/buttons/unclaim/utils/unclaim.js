import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });

      if (!ticketConfig) {
        return interaction.reply({ content: 'Ticket system is not configured.', ephemeral: true });
      }

      const roles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
      if (!isAllowed) {
        return interaction.reply({
          content: `You don't have permission to use this command`,
          ephemeral: true,
        });
      }

      if (ticket) {
        if (ticket.getDataValue('claimed') && ticket.getDataValue('claimerId') === interaction.user.id) {
          ticket.update({
            claimed: false,
            claimerId: null,
          });

          const ticketMsgId = ticket.getDataValue('ticketMsgId');
          const ticketMsg = await interaction.channel.messages.fetch(ticketMsgId);
          if (ticketMsg) {
            const ticketEmbed = ticketMsg?.embeds[0];

            // rebuild embed
            const newEmbed = new EmbedBuilder()
              .setTitle(ticketEmbed.title ?? null)
              .setDescription(ticketEmbed.description ?? null)
              .setColor('#FDCB58');

            if (ticketEmbed.footer) newEmbed.setFooter(ticketEmbed.footer);
            if (ticketEmbed.timestamp) newEmbed.setTimestamp(new Date(ticketEmbed.timestamp));

            // copy fields but replace claimed by
            ticketEmbed.fields?.forEach(field => {
              if (field.name === 'Claimed by')
                newEmbed.addFields({
                  name: 'Claimed by',
                  value: `<@${interaction.user.id}> Unclaimed the ticket 🟡`,
                  inline: field.inline,
                });
              else newEmbed.addFields(field);
            });

            await ticketMsg.edit({ embeds: [newEmbed] });
          }

          interaction.reply({ content: 'you have unclaimed this ticket', ephemeral: true });
          const logMsgId = ticket.getDataValue('logId');

          if (logMsgId) {
            try {
              const logsChannel = await interaction.guild.channels.fetch(ticketConfig.getDataValue('logsChannelId'));
              const logMsg = await logsChannel.messages.fetch(logMsgId);
              const oldEmbed = logMsg.embeds[0];

              if (oldEmbed) {
                // rebuild embed
                const newEmbed = new EmbedBuilder()
                  .setTitle(oldEmbed.title ?? null)
                  .setDescription(oldEmbed.description ?? null)
                  .setColor('#FDCB58');

                if (oldEmbed.footer) newEmbed.setFooter(oldEmbed.footer);
                if (oldEmbed.timestamp) newEmbed.setTimestamp(oldEmbed.timestamp);

                // copy fields but replace claimed by
                oldEmbed.fields?.forEach(field => {
                  if (field.name === 'claimed by:') {
                    newEmbed.addFields({
                      name: 'claimed by:',
                      value: `<@${interaction.user.id}> Unclaimed the ticket 🟡`,
                      inline: field.inline,
                    });
                  } else {
                    newEmbed.addFields(field);
                  }
                });

                await logMsg.edit({ embeds: [newEmbed] });
              }
            } catch (error) {
              console.error('Error while editing the embed "claim":', error);
            }
          }
        } else {
          interaction.reply({ content: 'you are not the claimer for this ticket', ephemeral: true });
        }
      } else {
        interaction.reply({ content: 'invalid channel or ticket is closed ❌', ephemeral: true });
      }
    } catch (error) {
      console.error('error while un-claiming the ticket', error);
    }
  },
};
