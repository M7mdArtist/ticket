import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      // Find ticket for the current channel
      const ticket = await Ticket.findOne({
        where: {
          channelId: interaction.channel.id,
          resolved: false,
          claimed: false,
        },
      });

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isAllowed) {
        return interaction.reply({
          content: `You don't have permission to use this command`,
          ephemeral: true,
        });
      }

      if (!ticket) {
        return interaction.reply({
          content: 'This is not a valid ticket channel or the ticket is already closed/claimed',
          ephemeral: true,
        });
      }

      const ticketMsgId = ticket.getDataValue('ticketMsgId');
      const ticketMsg = await interaction.channel.messages.fetch(ticketMsgId);
      if (ticketMsg) {
        const ticketEmbed = ticketMsg?.embeds[0];

        // rebuild embed
        const newEmbed = new EmbedBuilder()
          .setTitle(ticketEmbed.title ?? null)
          .setDescription(ticketEmbed.description ?? null)
          .setColor('#226699');

        if (ticketEmbed.footer) newEmbed.setFooter(ticketEmbed.footer);
        if (ticketEmbed.timestamp) newEmbed.setTimestamp(new Date(ticketEmbed.timestamp));

        // copy fields but replace claimed by
        ticketEmbed.fields?.forEach(field => {
          if (field.name === 'Claimed by')
            newEmbed.addFields({
              name: 'Claimed by',
              value: `<@${interaction.user.id}> ☑️`,
              inline: field.inline,
            });
          else newEmbed.addFields(field);
        });

        await ticketMsg.edit({ embeds: [newEmbed] });
      }
      // find the ticket message in channel
      //   const messages = await interaction.channel.messages.fetch({ limit: 10 });
      //   const ticketMsg = messages.find(m => m.content.includes('🎫 This ticket was opened by'));

      //   if (!ticketMsg) {
      //     return interaction.reply({
      //       content: 'Could not find the ticket message.',
      //       ephemeral: true,
      //     });
      //   }

      //   await ticketMsg.edit(
      //     `## 🎫 This ticket was opened by <@${ticket.authorId}> \n > 💾 Your ticket will be saved. \n React with this emoji 🔏 to close the ticket.\n Ticket claimed by: ${interaction.user}`
      //   );

      await ticket.update({
        claimed: true,
        claimerId: interaction.user.id,
      });

      // update logs embed if exists
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
              .setColor('#226699');

            if (oldEmbed.footer) newEmbed.setFooter(oldEmbed.footer);
            if (oldEmbed.timestamp) newEmbed.setTimestamp(oldEmbed.timestamp);

            // copy fields but replace claimed by
            oldEmbed.fields?.forEach(field => {
              if (field.name === 'claimed by:') {
                newEmbed.addFields({
                  name: 'claimed by:',
                  value: `<@${interaction.user.id}> ☑️`,
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

      await interaction.reply({
        content: 'You have claimed this ticket!',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error claiming ticket:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: 'An error occurred while claiming the ticket.',
          ephemeral: true,
        });
      }
    }
  },
};
