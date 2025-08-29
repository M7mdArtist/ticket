import { EmbedBuilder, ChannelType } from 'discord.js';

export default {
  async deleteClosedTickets(guild, categoryId, searchText) {
    try {
      const category = guild.channels.cache.get(categoryId);
      if (!category || category.type !== ChannelType.GuildCategory) {
        return console.log('Invalid category ID or not a category channel');
      }

      const channels = guild.channels.cache.filter(
        channel =>
          channel.parentId === categoryId && channel.type === ChannelType.GuildText && channel.name.includes(searchText)
      );

      let deleteCount = 0;
      for (const [id, channel] of channels) {
        try {
          await channel.delete();
          deleteCount++;
          console.log(`Deleted Channel: ${channel.name}, total: ${deleteCount}`);
        } catch (error) {
          console.error(`Failed delete channel ${channel.name}:`, error);
        }
      }
      return deleteCount;
    } catch (error) {
      console.error('Error in deleteClosedTickets:', error);
    }
  },
  async execute(interaction, ticketConfig) {
    if (!ticketConfig.getDataValue('deleteTicketsChannel')) {
      return interaction.editReply('Delete closed ticket channel is not configured yet.');
    } else if (interaction.channel.id !== ticketConfig.getDataValue('deleteTicketsChannelId')) {
      return interaction.editReply({
        content: 'This command can only be used in the delete-closed-tickets channel.',
      });
    }

    await interaction.editReply({
      content: '⏳ Deleting closed tickets...',
    });

    const deleteCount = await this.deleteClosedTickets(
      interaction.guild,
      ticketConfig.getDataValue('parentId'),
      'closed'
    );

    if (!deleteCount) {
      await interaction.editReply({
        content: 'There are no closed tickets to delete.',
      });
    } else {
      const unixNow = Math.floor(Date.now() / 1000);

      const deleteEmbed = new EmbedBuilder()
        .setTitle('Delete Info')
        .addFields(
          { name: 'Deleted:', value: `${deleteCount} tickets`, inline: true },
          { name: 'Used by:', value: `${interaction.user}`, inline: true },
          { name: 'Date:', value: `<t:${unixNow}:D>`, inline: true }
        );

      await interaction.editReply({
        content: '✅ All closed tickets deleted successfully',
      });
      await interaction.channel.send({ embeds: [deleteEmbed] });
    }
  },
};
