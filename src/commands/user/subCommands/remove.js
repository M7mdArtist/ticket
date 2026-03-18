import { PermissionsBitField } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user');

      // 1. Verify Ticket
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) {
        return interaction.editReply({ content: '❌ You can only use this command inside an active ticket.' });
      }

      // 2. Permission Check
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: ticket.type } });
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');
      const isStaff = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
      //   const isAuthor = interaction.user.id === ticket.authorId;

      if (!isStaff) {
        return interaction.editReply({ content: '❌ Only staff can remove users.' });
      }

      // 3. Prevent removing the author
      if (targetUser.id === ticket.authorId) {
        return interaction.editReply({ content: '❌ You cannot remove the ticket creator from their own ticket.' });
      }

      // 4. Update Permissions (Delete their specific overwrite)
      await interaction.channel.permissionOverwrites.delete(targetUser.id);

      await interaction.editReply({ content: `⛔ Successfully removed <@${targetUser.id}> from the ticket.` });
    } catch (error) {
      console.error('Error in user remove:', error);
      await interaction.editReply({ content: '❌ An error occurred while removing the user.' }).catch(() => null);
    }
  },
};
