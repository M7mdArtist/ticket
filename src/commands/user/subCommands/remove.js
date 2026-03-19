import { PermissionsBitField } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user');

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) return interaction.editReply({ content: '❌ Use this inside an active ticket.' });

      // Permission Check (Targets GLOBAL staff roles)
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');

      const isStaff =
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isStaff) return interaction.editReply({ content: '❌ Only staff can remove users.' });

      if (targetUser.id === ticket.authorId) {
        return interaction.editReply({ content: '❌ You cannot remove the ticket creator.' });
      }

      await interaction.channel.permissionOverwrites.delete(targetUser.id);
      await interaction.editReply({ content: `⛔ Removed <@${targetUser.id}> from the ticket.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error removing user.' });
    }
  },
};
