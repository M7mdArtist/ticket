import { ChannelType, PermissionsBitField } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const categoryId = interaction.options.getChannel('category').id;
      const type = interaction.options.getString('type');

      // 1. Fetch config using the specific ticket type!
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id, type: type } });

      if (!ticketConfig) {
        return interaction.editReply({ content: `No ticket system configured for type: **${type}** ❌` });
      }

      // 2. Permission Check (Allows Staff OR Server Admins)
      const allowedRoles = JSON.parse(ticketConfig.getDataValue('roles') || '[]');
      const isAllowed =
        interaction.member.roles.cache.some(role => allowedRoles.includes(role.id)) ||
        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

      if (!isAllowed) {
        return interaction.editReply({ content: 'You do not have permission to use this command ❌' });
      }

      // 3. Create Channel
      const logsChannel = await interaction.guild.channels.create({
        name: `${type.toLowerCase()}-logs`, // Names it cleanly like "support-logs"
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });

      // 4. Update Database
      await ticketConfig.update({
        logs: true,
        logsChannelId: logsChannel.id,
      });

      await interaction.editReply({
        content: `Created a logs channel <#${logsChannel.id}> for **${type}** tickets ✅`,
      });
    } catch (error) {
      console.error('Error while creating logs channel', error);
      await interaction.editReply({ content: 'An error occurred while creating the logs channel.' }).catch(() => null);
    }
  },
};
