import TicketConfig from '../../../../database/models/TicketConfig.js';
import { EmbedBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.editReply({ content: 'Only the server owner 👑 can manage staff roles.' });
      }

      const role = interaction.options.getRole('role');
      let ticketConfig = await TicketConfig.findOne({
        where: { guildId: interaction.guild.id, type: 'Dynamic-Panel' },
      });

      if (!ticketConfig) return interaction.editReply({ content: '❌ System not configured.' });

      let rolesArr = JSON.parse(ticketConfig.roles || '[]');
      if (!rolesArr.includes(role.id)) {
        return interaction.editReply({ content: `❌ <@&${role.id}> is not a staff role.` });
      }

      // Update Database
      rolesArr = rolesArr.filter(id => id !== role.id);
      await ticketConfig.update({ roles: JSON.stringify(rolesArr) });

      // --- LOGGING LOGIC ---
      if (ticketConfig.logs && ticketConfig.logsChannelId) {
        const logChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🗑️ Staff Role Removed')
            .setDescription(`A staff role has been de-authorized.`)
            .addFields(
              { name: '👤 Action by', value: `<@${interaction.user.id}>`, inline: true },
              { name: '🛡️ Role Removed', value: `<@&${role.id}>`, inline: true },
              { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
            )
            .setColor('#A0041E') // Red for removal
            .setTimestamp()
            .setFooter({ text: 'System Configuration Audit' });

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

      await interaction.editReply({ content: `🗑️ Successfully removed <@&${role.id}> from staff roles.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error removing role.' });
    }
  },
};
