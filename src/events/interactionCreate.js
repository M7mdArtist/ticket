export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Error executing ${interaction.commandName}:`, err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: 'There was an error executing this command.',
        });
      }
    }
  },
};
