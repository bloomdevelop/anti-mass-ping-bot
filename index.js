import { Client } from "revolt.js";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Client();

client.once("ready", () => {
  console.log("Ready!");
});

client.on("messageCreate", (message) => {
  let matchCount = 0;
  const matches = message.content.matchAll(/<@!?([A-Z0-9]+)>/gm);

  // Gets all matches and count how many pings are there in a message content
  for (const match in matches) {
    matchCount++;
    console.log(`${matchCount} matches has been found!`);
  }

  if (matchCount > 5) {
    message.delete();
  }
  matchCount = 0;
});

client.loginBot(process.env.TOKEN);
