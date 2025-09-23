import TicketConfig from '../../../../database/models/TicketConfig.js';

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
        return interaction.reply({
          content: 'Role is already added❌',
          ephemeral: true,
        });
      }

      rolesArr.push(role.id);

      await TicketConfig.update({ roles: JSON.stringify(rolesArr) }, { where: { guildId: interaction.guild.id } });

      return interaction.reply({ content: `Added ${role.name} to ticket roles✅`, ephemeral: true });
    } catch (error) {
      console.error('Error adding role:', error);
      return interaction.reply({ content: 'There was an error while adding the role❌', ephemeral: true });
    }
  },
};
