import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket || !ticket.claimed) return interaction.editReply({ content: 'This ticket is not claimed.' });

      const categoryData = await TicketCategory.findOne({
        where: { guildId: interaction.guild.id, name: ticket.type },
      });

      await ticket.update({ claimed: false, claimerId: null });

      // Update Main Message
      const ticketMsg = await interaction.channel.messages.fetch(ticket.ticketMsgId).catch(() => null);
      if (ticketMsg) {
        const unclaimedEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
          .setColor('#77B255')
          .setFields(
            ticketMsg.embeds[0].fields.map(f => {
              if (f.name.includes('Claimed by')) return { ...f, value: 'Not claimed 🟡' };
              if (f.name.includes('Status')) return { ...f, value: 'Opened ✅' };
              return f;
            }),
          );

        const resetRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('claim').setLabel('🙋‍♂️ Claim').setStyle(ButtonStyle.Success),
        );
        await ticketMsg.edit({ embeds: [unclaimedEmbed], components: [resetRow] });
      }

      // 👇 UPDATE LOG MESSAGE 👇
      if (categoryData?.logs && categoryData.logsChannelId && ticket.logId) {
        const logChannel = await interaction.guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
        if (logChannel) {
          const logMsg = await logChannel.messages.fetch(ticket.logId).catch(() => null);
          if (logMsg) {
            const updatedLog = EmbedBuilder.from(logMsg.embeds[0])
              .setColor('#77B255')
              .setFields(
                logMsg.embeds[0].fields.map(f => {
                  if (f.name.includes('Claimed by')) return { ...f, value: 'Not claimed 🟡' };
                  if (f.name.includes('Status')) return { ...f, value: 'Opened ✅' };
                  return f;
                }),
              );
            await logMsg.edit({ embeds: [updatedLog] });
          }
        }
      }

      await interaction.editReply({ content: 'Ticket unclaimed 🟡' });
    } catch (e) {
      console.error(e);
    }
  },
};
