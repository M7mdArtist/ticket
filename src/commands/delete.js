import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import TicketConfig from '../../database/models/TicketConfig.js';
import Ticket from '../../database/models/Ticket.js';

export default {
  data: new SlashCommandBuilder().setName('delete').setDescription('Delete all closed tickets'),

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

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id },
      });
      if (!ticketConfig) {
        return interaction.editReply({
          content: 'Ticket system not configured for this server.',
        });
      }

      const ticket = await Ticket.findOne({ where: { channelId: interaction.channel.id } });
      if (ticket) {
        const roles = JSON.parse(ticketConfig.getDataValue('roles'));
        const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
        if (!isAllowed) {
          return interaction.reply({
            content: `You don't have permission to use this command`,
            ephemeral: true,
          });
        } else {
          await interaction.editReply('OK!');
          await interaction.channel.send(`deleting this ticket\nby a command from: <@${interaction.user.id}>`);

          if (ticketConfig && ticket.getDataValue('logId')) {
            const logsChannel = await interaction.channel.guild.channels.fetch(ticketConfig.logsChannelId);
            const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId'));
            const embed = logMsg.embeds[0];
            const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor('#A0041E');
            embed.fields.forEach(field => {
              newEmbed.addFields(
                field.name === 'status:' ? { name: 'status:', value: 'Closed 🔏', inline: field.inline } : field
              );
            });
            await logMsg.edit({ embeds: [newEmbed] });
          }

          setTimeout(() => {
            interaction.channel.delete();
          }, 5000);

          return;
        }
      }

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
    } catch (error) {
      console.error('Error in delete command:', error);
      await interaction.editReply({
        content: 'An error occurred while deleting tickets.',
      });
    }
  },
};
