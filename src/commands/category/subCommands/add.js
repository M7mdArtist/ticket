import TicketCategory from '../../../../database/models/TicketCategory.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Only allow the server owner or admins to run this
      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.editReply({ content: 'Only the server owner can manage categories ❌' });
      }

      const name = interaction.options.getString('name');
      const openCategory = interaction.options.getChannel('open_category');
      const closedCategory = interaction.options.getChannel('closed_category');
      const description = interaction.options.getString('description') || 'Click here to open a ticket';
      const emoji = interaction.options.getString('emoji') || '🎫';

      // Check if a category with this name already exists
      const existing = await TicketCategory.findOne({ where: { guildId: interaction.guild.id, name: name } });
      if (existing) {
        return interaction.editReply({ content: `❌ A category named **${name}** already exists!` });
      }

      // Save to database
      await TicketCategory.create({
        guildId: interaction.guild.id,
        name: name,
        description: description,
        emoji: emoji,
        openCategoryId: openCategory.id,
        closedCategoryId: closedCategory.id,
      });

      await interaction.editReply({
        content: `✅ Successfully added **${name}** to the database!\n\n*(Note: You will need to run the new \`/panel\` command to update the live dropdown menu).*`,
      });
    } catch (error) {
      console.error('Error adding category:', error);
      await interaction.editReply({ content: '❌ An error occurred while adding the category.' }).catch(() => null);
    }
  },
};
