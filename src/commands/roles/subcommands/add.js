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

      if (!ticketConfig) return interaction.editReply({ content: '❌ Run `/panel` first.' });

      let rolesArr = JSON.parse(ticketConfig.roles || '[]');
      if (rolesArr.includes(role.id)) {
        return interaction.editReply({ content: `✅ <@&${role.id}> is already a staff role.` });
      }

      // Update Database
      rolesArr.push(role.id);
      await ticketConfig.update({ roles: JSON.stringify(rolesArr) });

      // --- LOGGING LOGIC ---
      if (ticketConfig.logs && ticketConfig.logsChannelId) {
        const logChannel = await interaction.guild.channels.fetch(ticketConfig.logsChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🔐 Staff Role Added')
            .setDescription(`A new staff role has been authorized for the ticket system.`)
            .addFields(
              { name: '👤 Action by', value: `<@${interaction.user.id}>`, inline: true },
              { name: '🛡️ Role Added', value: `<@&${role.id}>`, inline: true },
              { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
            )
            .setColor('#77B255')
            .setTimestamp()
            .setFooter({ text: 'System Configuration Audit' });

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

      await interaction.editReply({ content: `✅ Successfully added <@&${role.id}> to staff roles.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error adding role.' });
    }
  },
};
