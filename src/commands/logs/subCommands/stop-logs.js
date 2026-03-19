import { PermissionsBitField } from 'discord.js';
import TicketCategory from '../../../../database/models/TicketCategory.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString('type');
      const ticketCat = await TicketCategory.findOne({ where: { guildId: interaction.guild.id, name: type } });
      const panelConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      if (!ticketCat || !ticketCat.logs) {
        return interaction.editReply({ content: `Logs are not enabled for **${type}**.` });
      }

      const allowedRoles = JSON.parse(panelConfig?.getDataValue('roles') || '[]');
      if (
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
        !interaction.member.roles.cache.some(r => allowedRoles.includes(r.id))
      ) {
        return interaction.editReply({ content: 'No permission. ❌' });
      }

      await ticketCat.update({ logs: false, logsChannelId: null });

      await interaction.editReply({ content: `Logging stopped for **${type}** 🛑` });
    } catch (error) {
      console.error(error);
    }
  },
};
