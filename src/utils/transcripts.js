import * as dht from 'discord-html-transcripts';

export async function createHtmlTranscript(channel) {
  // Generate transcript
  const attachment = await dht.createTranscript(channel, {
    limit: -1, // fetch ALL messages
    returnBuffer: false, // return as attachment file
    fileName: `${channel.name}-transcript.html`,
  });

  return attachment;
}
