import fs from 'fs';
import path from 'path';

export async function loadEvents(client) {
  const eventsPath = path.resolve('./src/events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = (await import(`file://${filePath}`)).default;

    if (!event || !event.name || !event.execute) {
      console.warn(`Event file ${file} is missing required properties.`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}
