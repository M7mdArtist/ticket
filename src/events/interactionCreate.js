export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // --- Slash Commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client.userTickets);
      }

      // --- Buttons ---
      if (interaction.isButton()) {
        const button = client.buttons.get(interaction.customId);
        if (!button) return;
        await button.execute(interaction, client.userTickets);
      }

      // --- Select Menus (Dropdowns) ---
      if (interaction.isStringSelectMenu()) {
        // 🛠️ DEBUG: See if the bot detects the click
        console.log(`🔎 [Interaction] Menu Clicked: ${interaction.customId}`);

        const menu = client.selectMenus.get(interaction.customId);

        if (!menu) {
          console.log(`❌ [Error] No logic found for customId: "${interaction.customId}"`);
          return;
        }

        await menu.execute(interaction, client.userTickets);
      }

      // --- Auto Complete ---
      if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(error);
        }
      }
    } catch (err) {
      console.error(`❌ [Interaction Error]:`, err);

      const errorMsg = 'There was an error executing this interaction.';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => null);
      } else {
        await interaction.editReply({ content: errorMsg }).catch(() => null);
      }
    }
  },
};
