import { PermissionsBitField } from 'discord.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');

      // --- LOGIC FOR GLOBAL SYSTEM ---
      if (type === 'Dynamic-Panel') {
        const ticketConfig = await TicketConfig.findOne({
          where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
        });
        if (!ticketConfig)
          return interaction.editReply({ content: '❌ System not initialized. Please run `/panel` first.' });

        await ticketConfig.update({ logs: true, logsChannelId: channel.id });
        return interaction.editReply({
          content: `✅ **Global System Logs** have been set to <#${channel.id}>. Role changes will now be logged here!`,
        });
      }

      // --- LOGIC FOR CATEGORIES ---
      const ticketCat = await TicketCategory.findOne({ where: { guildId: interaction.guild.id, name: type } });
      if (!ticketCat) return interaction.editReply({ content: `❌ Category **${type}** not found.` });

      await ticketCat.update({ logs: true, logsChannelId: channel.id });
      await interaction.editReply({ content: `✅ Logs for **${type}** tickets set to <#${channel.id}>.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ An error occurred.' });
    }
  },
};
