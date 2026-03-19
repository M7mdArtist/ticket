import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      const rolesArr = JSON.parse(ticketConfig?.roles || '[]');

      if (rolesArr.length === 0) {
        return interaction.editReply({ content: '⚠️ No staff roles have been configured yet.' });
      }

      // Convert IDs to Mentions
      const roleMentions = rolesArr.map(id => `• <@&${id}> (\`${id}\`)`).join('\n');

      const listEmbed = new EmbedBuilder()
        .setTitle('📋 Authorized Staff Roles')
        .setDescription('The following roles have permission to claim, close, and manage tickets:\n\n' + roleMentions)
        .setColor('#5865F2')
        .setFooter({ text: 'Use /role add to add more' });

      await interaction.editReply({ embeds: [listEmbed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error fetching role list.' });
    }
  },
};
