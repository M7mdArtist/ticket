import { EmbedBuilder } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
    if (!ticketConfig)
      return interaction.reply({ content: 'Ticket system is not configured for this server.❌', ephemeral: true });

    let rolesArr = [];
    if (ticketConfig.roles) {
      try {
        rolesArr = Array.isArray(ticketConfig.roles) ? ticketConfig.roles : JSON.parse(ticketConfig.roles);
      } catch {
        rolesArr = [];
      }
    }

    if (rolesArr.length === 0) {
      const embed = new EmbedBuilder().setTitle('Roles List').setDescription('No roles found.').setColor('#ff0000');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const rolesList = rolesArr.map((roleId, index) => `${index + 1}. <@&${roleId}>`).join('\n');
    const embed = new EmbedBuilder().setTitle('Roles List').setDescription(rolesList).setColor('#00ff00');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
