import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      if (interaction.user.id !== interaction.guild.ownerId)
        return interaction.reply({ content: 'Only server owner👑 can use this command', ephemeral: true });
      const role = interaction.options.getRole('role');
      if (!role) {
        return interaction.reply({
          content: 'Invalid role provided❌',
          ephemeral: true,
        });
      }

      // Fetch the ticket config for the guild
      const ticketConfig = await TicketConfig.findOne({ where: { guildId: interaction.guild.id } });

      if (!ticketConfig) {
        return interaction.reply({ content: 'Setup the ticket system first❌', ephemeral: true });
      }
      let replyMsg = '⏳ Adding role...';
      await interaction.reply({ content: replyMsg, ephemeral: true });

      // Parse roles array from DB or initialize as empty array
      let rolesArr = [];
      if (ticketConfig.roles) {
        try {
          rolesArr = Array.isArray(ticketConfig.roles) ? ticketConfig.roles : JSON.parse(ticketConfig.roles);
        } catch {
          rolesArr = [];
        }
      }

      if (rolesArr.includes(role.id)) {
        replyMsg += `\n✅Role is already added`;
        return interaction.editReply({
          content: replyMsg,
          ephemeral: true,
        });
      }

      rolesArr.push(role.id);

      await TicketConfig.update({ roles: JSON.stringify(rolesArr) }, { where: { guildId: interaction.guild.id } });

      replyMsg += `\nAdded ${role.name} to ticket roles✅`;
      interaction.editReply({ content: replyMsg, ephemeral: true });
      if (!ticketConfig.logs) {
        replyMsg += `\n⚠️ Enable logs to get notified when a role is added`;
        return interaction.editReply({ content: replyMsg, ephemeral: true });
      }
      if (ticketConfig.logs) {
        const logsChannelId = ticketConfig.logsChannelId;
        if (!logsChannelId) return;
        const logsChannel = interaction.guild.channels.cache.get(logsChannelId);
        if (!logsChannel) return;
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('Role Added Successfully')
          .setDescription(
            `**User:** ${interaction.user.tag}\n**Role Added:** <@&${role.id}>\n\nTo view all available roles, use \`/roles list\``
          )
          .setTimestamp()
          .setFooter({ text: 'Role Management' });
        logsChannel.send({ embeds: [embed] });
        replyMsg += `\n✅Logged the action in <#${logsChannelId}>`;
        return interaction.editReply({ content: replyMsg, ephemeral: true });
      }
    } catch (error) {
      console.error('Error adding role:', error);
      return interaction.reply({ content: 'There was an error while adding the role❌', ephemeral: true });
    }
  },
};
