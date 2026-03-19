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

      // 2. Permission Check (Targets the GLOBAL staff roles)
      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });
      const allowedRoles = JSON.parse(ticketConfig?.getDataValue('roles') || '[]');

      const isStaff =
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

      if (!isStaff) {
        return interaction.editReply({ content: '❌ Only staff can add users to tickets.' });
      }

      // 3. Prevent adding bots or the creator
      if (targetUser.bot) return interaction.editReply({ content: '❌ You cannot add bots to a ticket.' });
      if (targetUser.id === ticket.authorId)
        return interaction.editReply({ content: '❌ The creator is already here!' });

      // 4. Update Permissions
      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        [PermissionsBitField.Flags.ViewChannel]: true,
        [PermissionsBitField.Flags.SendMessages]: true,
        [PermissionsBitField.Flags.ReadMessageHistory]: true,
      });

      await interaction.editReply({ content: `✅ Successfully added <@${targetUser.id}> to the ticket.` });
    } catch (error) {
      console.error('Error in user add:', error);
      await interaction.editReply({ content: '❌ An error occurred.' });
    }
  },
};
