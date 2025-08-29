import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) return interaction.editReply({ content: 'Ticket system is not configured', ephemeral: true });

      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
      if (!isAllowed) return interaction.editReply({ content: 'You do not have permission to use this command❌' });

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id } });
      if (!ticket) return interaction.editReply({ content: 'This is not a ticket' });

      const isClaimed = ticket.getDataValue('claimed');
      if (!isClaimed) return interaction.editReply({ content: 'This ticket is not claimed.' });

      const claimerId = ticket.getDataValue('claimerId');
      if (claimerId !== interaction.user.id)
        return interaction.editReply({ content: 'You are not the claimer for this ticket' });

      const user = interaction.options.getMember('user');
      const hasRole = user.roles.cache.some(role => allowedRoles.includes(role.id));
      if (!hasRole) return interaction.editReply('User do not have permission to claim this ticket❌');
      if (hasRole) {
        ticket.update({
          claimed: true,
          claimerId: user.id,
        });
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const ticketMsg = messages.find(m => m.content.includes('🎫 This ticket was opened by'));

        if (!ticketMsg) {
          return interaction.editReply({
            content: 'Could not find the ticket message.',
            ephemeral: true,
          });
        }

        await ticketMsg.edit(
          `## 🎫 This ticket was opened by <@${ticket.authorId}> \n
           > 💾 Your ticket will be saved.
            \n React with this emoji 🔏 to close the ticket.\n
             Ticket transferred from <@${interaction.user.id}> To <@${user.id}>⚠️ `
        );
      }
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
              .setColor('#AB47BC');

            if (oldEmbed.footer) newEmbed.setFooter(oldEmbed.footer);
            if (oldEmbed.timestamp) newEmbed.setTimestamp(oldEmbed.timestamp);

            // copy fields but replace claimed by
            oldEmbed.fields?.forEach(field => {
              if (field.name === 'claimed by:') {
                newEmbed.addFields({
                  name: 'claimed by:',
                  value: `transferred from <@${interaction.user.id}> to <@${user.id}>🟣`,
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
        interaction.editReply('Ticket Transferred successfully ✅');
        interaction.followUp(`Ticket has been transferred⚠️\n<@${interaction.user.id}> => <@${user.id}>`);
      }
    } catch (err) {
      console.error('error while transferring the ticket❌', err);
    }
  },
};
