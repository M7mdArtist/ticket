import { EmbedBuilder } from 'discord.js';
import transcripts from '../../../utils/transcripts.js';

export default {
  async execute(interaction, ticket, ticketConfig) {
    if (!ticketConfig) {
      return interaction.editReply('Ticket configuration not found for this server.');
    }

    if (!ticket) {
      return interaction.editReply('No ticket was found for this channel.');
    }

    const roles = JSON.parse(ticketConfig.getDataValue('roles'));
    const isAllowed = interaction.member.roles.cache.some(role => roles.includes(role.id));
    if (!isAllowed) {
      return interaction.editReply(`You don't have permission to use this command`);
    }

    if (interaction.channel.id !== ticket.getDataValue('channelId')) {
      return interaction.editReply('This is not a valid ticket channel.');
    }
    await transcripts.execute(interaction.channel, ticket, ticketConfig, interaction.channel.guild);
    await interaction.editReply('OK!');
    await interaction.channel.send(`Deleting this ticket\nby a command from: <@${interaction.user.id}>`);

    if (ticketConfig && ticket.getDataValue('logId')) {
      try {
        const logsChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId);
        const logMsg = await logsChannel.messages.fetch(ticket.getDataValue('logId'));
        const embed = logMsg.embeds[0];

        if (embed) {
          const newEmbed = new EmbedBuilder().setTitle(embed.title).setColor('#A0041E');
          if (embed.fields) {
            embed.fields.forEach(field => {
              newEmbed.addFields(
                field.name === 'status:' ? { name: 'status:', value: 'Closed 🔏', inline: field.inline } : field
              );
            });
          }
          await logMsg.edit({ embeds: [newEmbed] });
        }
      } catch (err) {
        console.error('Failed to update log message:', err);
      }
    }
    ticket.update({ resolved: true });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  },
};
