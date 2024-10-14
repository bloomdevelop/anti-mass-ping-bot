import * as dotenv from "dotenv";
import { Client } from "revolt.js";
import sqlite3 from "sqlite3";
dotenv.config();

const client = new Client();
const db = new sqlite3.Database("./users.db", (err) => {
  if (err) {
    console.error(
      "Something went wrong while creating a database.\n",
      err.message,
    );
  }
});

client.once("ready", () => {
  console.log("Ready!");
  client.servers.forEach((server) => {
    server
      .fetchMembers()
      .then((members) => {
        members.members.forEach((member) => {
          console.log(`Member found: ${member.user.username}`);
          db.run(`INSERT OR IGNORE INTO users (id, serverId) VALUES (?,?)`, [
            member.user.id,
            server.id,
          ]);
        });
      })
      .catch((error) => {
        console.error(`Error fetching members for server ${server.id}:`, error);
      });
  });
});

client.on("messageCreate", (msg) => {
  if (msg.mentionIds && msg.mentionIds.length > 0) {
    // First, ensure the user exists in the database
    db.run(
      `INSERT OR IGNORE INTO users (id, serverId, pingCount, warnCount) VALUES (?, ?, 0, 0)`,
      [msg.author.id, msg.server.id],
      (err) => {
        if (err) {
          console.error("Error inserting user:", err);
          return;
        }

        // Now retrieve current pingCount and warnCount
        db.get(
          `SELECT pingCount, warnCount FROM users WHERE id = ? AND serverId = ?`,
          [msg.author.id, msg.server.id],
          (err, row) => {
            if (err) {
              console.error("Error retrieving user data:", err);
              return;
            }

            let { pingCount, warnCount } = row;
            const newPingCount = pingCount + msg.mentionIds.length;

            if (newPingCount >= 3) {
              // Reset pingCount and increment warnCount
              db.run(
                `UPDATE users SET pingCount = 0, warnCount = warnCount + 1 WHERE id = ? AND serverId = ?`,
                [msg.author.id, msg.server.id],
                (err) => {
                  if (err) {
                    console.error("Error updating user data:", err);
                    return;
                  }

                  msg.author.openDM().then((channel) => {
                    channel.sendMessage({
                      embeds: [
                        {
                          title: "Anti MassPing Bot",
                          description: `You've been warned due to pinging too many users...\nTry not to ping more than 3.\nYour warnings: ${warnCount + 1}`,
                        },
                      ],
                    });
                  });
                },
              );
            } else {
              // Just update pingCount
              db.run(
                `UPDATE users SET pingCount = ? WHERE id = ? AND serverId = ?`,
                [newPingCount, msg.author.id, msg.server.id],
                (err) => {
                  if (err) {
                    console.error("Error updating pingCount:", err);
                  }
                },
              );
            }
          },
        );
      },
    );
  }
});

client.loginBot(process.env.TOKEN).catch((err) => {
  console.log(err.message);
});
