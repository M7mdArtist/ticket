export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
      }
    }
  },
};
