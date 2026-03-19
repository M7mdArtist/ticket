import TicketCategory from '../../../../database/models/TicketCategory.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.editReply({ content: 'Only the server owner can manage categories ❌' });
      }

      const name = interaction.options.getString('name');

      // Find and delete the record
      const deletedCount = await TicketCategory.destroy({
        where: { guildId: interaction.guild.id, name: name },
      });

      if (deletedCount === 0) {
        return interaction.editReply({ content: `❌ Could not find a category named **${name}**.` });
      }

      await interaction.editReply({ content: `🗑️ Successfully removed **${name}** from the database!` });
    } catch (error) {
      console.error('Error removing category:', error);
      await interaction.editReply({ content: '❌ An error occurred while removing the category.' }).catch(() => null);
    }
  },
};
