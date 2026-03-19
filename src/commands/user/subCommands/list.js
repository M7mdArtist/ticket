import { EmbedBuilder } from 'discord.js';
import Ticket from '../../../../database/models/Ticket.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id, resolved: false } });
      if (!ticket) return interaction.editReply({ content: '❌ No active ticket found here.' });

      const overwrites = interaction.channel.permissionOverwrites.cache;
      const addedUsers = [];

      overwrites.forEach(overwrite => {
        // type 1 = User. Filter out author and bot.
        if (
          overwrite.type === 1 &&
          overwrite.allow.has('ViewChannel') &&
          overwrite.id !== ticket.authorId &&
          overwrite.id !== interaction.client.user.id
        ) {
          addedUsers.push(`<@${overwrite.id}>`);
        }
      });

      const embed = new EmbedBuilder()
        .setTitle('👥 Ticket Access List')
        .setColor('#5865F2')
        .addFields(
          { name: '🎫 Creator', value: `<@${ticket.authorId}>`, inline: true },
          {
            name: '➕ Extra Users',
            value: addedUsers.length > 0 ? addedUsers.join('\n') : '*No extra users.*',
            inline: false,
          },
        )
        .setFooter({ text: 'Use /user add to invite others' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error fetching list.' });
    }
  },
};
