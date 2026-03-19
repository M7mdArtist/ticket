import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket || ticket.claimed) return interaction.editReply({ content: 'Ticket already claimed or invalid.' });

      // 1. Fetch Category & Config
      const categoryData = await TicketCategory.findOne({
        where: { guildId: interaction.guild.id, name: ticket.type },
      });
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      if (!interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))) {
        return interaction.editReply({ content: 'You do not have permission to claim tickets.' });
      }

      await ticket.update({ claimed: true, claimerId: interaction.user.id });

      // 2. Update Main Message Embed
      const ticketMsg = await interaction.channel.messages.fetch(ticket.ticketMsgId).catch(() => null);
      if (ticketMsg) {
        const claimedEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
          .setColor('#226699')
          .setFields(
            ticketMsg.embeds[0].fields.map(f => {
              if (f.name.includes('Claimed by')) return { ...f, value: `<@${interaction.user.id}> ☑️` };
              if (f.name.includes('Status')) return { ...f, value: 'Processing ⚙️' };
              return f;
            }),
          );

        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('unclaim').setLabel('🔓 Unclaim').setStyle(ButtonStyle.Secondary),
        );
        await ticketMsg.edit({ embeds: [claimedEmbed], components: [newRow] });
      }

      // 👇 3. UPDATE LOG MESSAGE (The Fix) 👇
      if (categoryData?.logs && categoryData.logsChannelId && ticket.logId) {
        const logChannel = await interaction.guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
        if (logChannel) {
          const logMsg = await logChannel.messages.fetch(ticket.logId).catch(() => null);
          if (logMsg) {
            const updatedLog = EmbedBuilder.from(logMsg.embeds[0])
              .setColor('#226699')
              .setFields(
                logMsg.embeds[0].fields.map(f => {
                  if (f.name.includes('Claimed by')) return { ...f, value: `<@${interaction.user.id}>` };
                  if (f.name.includes('Status')) return { ...f, value: 'Processing ⚙️' };
                  return f;
                }),
              );
            await logMsg.edit({ embeds: [updatedLog] });
          }
        }
      }

      await interaction.editReply({ content: 'Ticket claimed! ☑️' });
      await interaction.channel.send({ content: `🙋‍♂️ This ticket is now being handled by <@${interaction.user.id}>.` });
    } catch (e) {
      console.error(e);
    }
  },
};
