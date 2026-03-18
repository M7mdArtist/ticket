import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // 1. Verify Ticket
      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) {
        return interaction.editReply({ content: '❌ You can only use this command inside an active ticket.' });
      }

      // 2. Scan Permissions
      const overwrites = interaction.channel.permissionOverwrites.cache;
      const addedUsers = [];

      overwrites.forEach(overwrite => {
        // Look for users (type 1) who have ViewChannel allowed, and filter out the bot itself and the ticket creator
        if (
          overwrite.type === 1 &&
          overwrite.allow.has('ViewChannel') &&
          overwrite.id !== ticket.authorId &&
          overwrite.id !== interaction.client.user.id
        ) {
          addedUsers.push(`<@${overwrite.id}>`);
        }
      });

      // 3. Build the UI
      const embed = new EmbedBuilder()
        .setTitle('👥 Users in this Ticket')
        .setColor('#2b2d31')
        .setDescription(
          `**Ticket Creator:** <@${ticket.authorId}>\n\n` +
            `**Added Users:**\n${addedUsers.length > 0 ? addedUsers.join('\n') : '*No extra users added.*'}`,
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in user list:', error);
      await interaction.editReply({ content: '❌ An error occurred while fetching the user list.' }).catch(() => null);
    }
  },
};
