import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';
import { EmbedBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply();

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id } });
      if (!ticket) return interaction.editReply({ content: 'No ticket record found.' });

      // 1. Fetch Configs
      const categoryData = await TicketCategory.findOne({
        where: { guildId: interaction.guild.id, name: ticket.type },
      });
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      // 2. Permission Check
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      if (!interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))) {
        return interaction.editReply({ content: 'Only staff can delete tickets ❌' });
      }

      await interaction.editReply({ content: '🧨 Ticket will be permanently deleted in **5 seconds**...' });

      // 👇 3. UPDATE LOG MESSAGE (Category Specific) 👇
      if (categoryData?.logs && categoryData.logsChannelId && ticket.logId) {
        try {
          const logsChannel = await interaction.guild.channels.fetch(categoryData.logsChannelId).catch(() => null);
          if (logsChannel) {
            const logMsg = await logsChannel.messages.fetch(ticket.logId).catch(() => null);
            if (logMsg) {
              const deleteLog = EmbedBuilder.from(logMsg.embeds[0])
                .setColor('#000000') // Black for deletion
                .setFields(
                  logMsg.embeds[0].fields.map(f => (f.name.includes('Status') ? { ...f, value: 'Deleted 🗑️' } : f)),
                );
              await logMsg.edit({ embeds: [deleteLog] }).catch(() => null);
            }
          }
        } catch (err) {
          console.log('Log update failed during deletion');
        }
      }

      // 4. Wipe Database Record
      await ticket.destroy();

      // 5. Cleanup Discord
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
      }, 5000);
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: 'An error occurred.' }).catch(() => null);
    }
  },
};
