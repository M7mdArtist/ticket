export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // --- Slash Commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client);
      }

      // --- Buttons ---
      if (interaction.isButton()) {
        const button = client.buttons.get(interaction.customId);
        if (!button) return;
        await button.execute(interaction, client);
      }
    } catch (err) {
      console.error(`❌ Error handling interaction:`, err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error executing this interaction.',
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: 'There was an error executing this interaction.',
        });
      }
    }
  },
};
