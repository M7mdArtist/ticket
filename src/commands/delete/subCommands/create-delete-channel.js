import { SlashCommandBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import TicketConfig from '../../../../database/models/TicketConfig.js';

export default {
  async execute(interaction) {
    try {
      // Fetch ticket config
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });
      if (!ticketConfig) {
        return interaction.editReply({
          content: 'Ticket system not configured.\nUse **/setup** first.',
          ephemeral: true,
        });
      }

      if (!ticketConfig.getDataValue('roles') || ticketConfig.getDataValue('roles') === '[]')
        return interaction.reply({ content: 'No roles are set to manage tickets❌', ephemeral: true });

      // Get allowed roles
      const roles = JSON.parse(ticketConfig.getDataValue('roles'));
      const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
      if (!isAllowed) return interaction.editReply(`You don't have permission to use this command`);

      // Check if delete channel already exists
      if (ticketConfig.deleteTicketsChannel) {
        return interaction.editReply({
          content: 'There is already a delete channel!',
          ephemeral: true,
        });
      }

      // Get the category to create the channel in
      const category = interaction.options.getChannel('category');
      if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply({ content: 'Invalid category selected.', ephemeral: true });
      }

      // Fetch role objects
      const roleObjects = [];
      for (const roleId of roles) {
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) continue;
        roleObjects.push(role);
      }

      // Create the delete channel
      const deleteChannel = await interaction.guild.channels.create({
        name: 'delete-closed-tickets',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          ...roleObjects.map(role => ({
            id: role.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          })),
        ],
      });

      // Send info message in the delete channel
      await deleteChannel.send('Use **/delete** to delete all closed tickets.');

      // Update ticket config
      await ticketConfig.update({
        deleteTicketsChannel: true,
        deleteTicketsChannelId: deleteChannel.id,
      });

      await interaction.editReply({
        content: `Delete channel created successfully: <#${deleteChannel.id}>`,
        ephemeral: true,
      });

      console.log('Delete channel created:', deleteChannel.id);
    } catch (error) {
      console.error('Error creating delete channel:', error);
      if (!interaction.replied) {
        await interaction.editReply({ content: 'Failed to create delete channel.', ephemeral: true });
      }
    }
  },
};
