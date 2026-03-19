import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: true } });
      if (!ticket) return interaction.editReply({ content: 'No closed ticket found.' });

      // 1. Fetch Category & Global Config
      const categoryData = await TicketCategory.findOne({
        where: { guildId: interaction.guild.id, name: ticket.type },
      });
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      // 2. Permission Check (Using Dynamic-Panel roles)
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      if (!interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))) {
        return interaction.editReply({ content: 'Only staff can reopen tickets ❌' });
      }

      await ticket.update({ resolved: false, closeReq: false });

      // 3. Restore Permissions & Move Category
      const ticketChannel = interaction.channel;
      await ticketChannel.permissionOverwrites
        .edit(ticket.authorId, {
          [PermissionsBitField.Flags.ViewChannel]: true,
          [PermissionsBitField.Flags.SendMessages]: true,
          [PermissionsBitField.Flags.ReadMessageHistory]: true,
        })
        .catch(() => null);

      if (categoryData?.openCategoryId) {
        await ticketChannel.setParent(categoryData.openCategoryId, { lockPermissions: false }).catch(() => null);
      }

      // 4. Update Main Ticket Embed
      const ticketMsg = await ticketChannel.messages.fetch(ticket.ticketMsgId).catch(() => null);
      if (ticketMsg?.embeds[0]) {
        const restoredEmbed = EmbedBuilder.from(ticketMsg.embeds[0])
          .setColor('#77B255')
          .setFields(
            ticketMsg.embeds[0].fields.map(f => (f.name.includes('Status') ? { ...f, value: 'Opened ✅' } : f)),
          );

        const originalButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('claim').setLabel('🙋‍♂️ Claim').setStyle(ButtonStyle.Success),
        );
        await ticketMsg.edit({ embeds: [restoredEmbed], components: [originalButtons] }).catch(() => null);
      }

      // 👇 5. UPDATE LOG MESSAGE (Category Specific) 👇
      if (categoryData?.logs && categoryData.logsChannelId && ticket.logId) {
        const logChannel = await interaction.guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
        if (logChannel) {
          const logMsg = await logChannel.messages.fetch(ticket.logId).catch(() => null);
          if (logMsg) {
            const reOpenLog = EmbedBuilder.from(logMsg.embeds[0])
              .setColor('#77B255')
              .setFields(
                logMsg.embeds[0].fields.map(f => (f.name.includes('Status') ? { ...f, value: 'Reopened 🔓' } : f)),
              );
            await logMsg.edit({ embeds: [reOpenLog] }).catch(() => null);
          }
        }
      }

      await interaction.message.delete().catch(() => null);
      await interaction.editReply({ content: 'Ticket successfully reopened! 🔓' });
      await ticketChannel.send(`🔓 **Ticket Reopened** by <@${interaction.user.id}>`);
    } catch (error) {
      console.error(error);
    }
  },
};
