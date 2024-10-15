import * as dotenv from "dotenv";
import { Client } from "revolt.js";
import sqlite3 from "sqlite3";
dotenv.config();

const client = new Client();
const db = new sqlite3.Database("./database.db", (err) => {
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
    db.run(
      `INSERT OR IGNORE INTO config (serverId, pingThreshold, warnThreshold) VALUES (?, ?, ?)`,
      [server.id, 3, 3],
      (err) => {
        if (err) {
          console.error("Error inserting config:", err);
          return;
        }
      },
    );

    // Get all members on each servers, and insert them into the database
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

client.on("serverDelete", (server) => {
  db.run(
    `DELETE FROM config WHERE serverId = ?; DELETE FROM users WHERE serverId = ? `,
    [server.id, server.id],
    (err) => {
      if (err) {
        console.error("Error deleting server data:", err);
        return;
      }
    },
  );
});

client.on("serverCreate", (server) => {
  db.run(
    `INSERT OR IGNORE INTO config (serverId, pingThreshold, warnThreshold) VALUES (?, ?, ?)`,
    [server.id, 3, 3],
    (err) => {
      if (err) {
        console.error("Error inserting config:", err);
        return;
      }
    },
  );

  // Get all members on each servers, and insert them into the database
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

client.on("messageCreate", (msg) => {
  if (msg.author.bot) {
    return;
  }

  // Command configuration
  if (msg.content.startsWith("ap!")) {
    const args = msg.content.slice(3).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "config") {
      if (args.length !== 2) {
        msg.channel.sendMessage(
          "Usage: ap! config `<pingThreshold|warnThreshold>` `<value>`",
        );
        return;
      }

      const [setting, value] = args;
      const numValue = parseInt(value);

      if (isNaN(numValue)) {
        msg.reply("Value must be a number.");
        return;
      }

      if (setting !== "pingThreshold" && setting !== "warnThreshold") {
        msg.reply("Invalid setting. Use 'pingThreshold' or 'warnThreshold'.");
        return;
      }

      db.run(
        `UPDATE config SET ${setting} = ? WHERE serverId = ?`,
        [numValue, msg.server.id],
        (err) => {
          if (err) {
            console.error("Error updating config:", err);
            msg.channel.sendMessage({
              embeds: [
                {
                  colour: "#FF0000",
                  title: "Anti MassPing Bot",
                  description: `Something went wrong while updating the ${setting} setting.\nPlease try again later.`,
                },
              ],
            });
            return;
          }
          msg.channel.sendMessage({
            embeds: [
              {
                colour: "#00FF00",
                title: "Anti MassPing Bot",
                description: `Successfully updated the ${setting} setting to ${numValue}.`,
              },
            ],
          });
        },
      );
    }
    return;
  }

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

            db.get(
              `SELECT pingThreshold FROM config WHERE serverId = ?`,
              [msg.server.id],
              (err, row2) => {
                if (row.warnCount >= row2.warnThreshold) {
                  msg.author.openDM().then((channel) => {
                    channel.sendMessage({
                      embeds: [
                        {
                          title: "Anti MassPing Bot",
                          description: `Seems like you've been warned too many times. You've been kicked from the server.\nYour warnings: ${warnCount + 1}`,
                        },
                      ],
                    });
                  });
                  msg.server.getMember(msg.author.id).kick();
                }
                if (newPingCount >= row2.pingThreshold) {
                  db.run(
                    `UPDATE users SET pingCount = 0, warnCount = warnCount + 1 WHERE id = ? AND serverId = ?`,
                    [msg.author.id, msg.server.id],
                    (err) => {
                      if (err) {
                        console.error("Error updating user data:", err);
                        return;
                      }

                      msg.author.openDM().then((channel) => {
                        db.get(
                          `SELECT pingThreshold FROM config WHERE serverId = ?`,
                          [msg.server.id],
                          (err, row) => {
                            if (err) {
                              console.error(
                                "Error retrieving pingThreshold:",
                                err,
                              );
                              return;
                            }
                            const pingThreshold = row ? row.pingThreshold : 3;
                            channel.sendMessage({
                              embeds: [
                                {
                                  title: "Anti MassPing Bot",
                                  description: `You've been warned due to pinging too many users...\nTry not to ping more than ${pingThreshold} users.\nYour warnings: ${warnCount + 1}`,
                                },
                              ],
                            });
                          },
                        );
                      });
                    },
                  );
                } else {
                  db.run(
                    `UPDATE users SET pingCount = ? WHERE id = ? AND serverId = ?`,
                    [0, msg.author.id, msg.server.id],
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
      },
    );
  }
});

client.loginBot(process.env.TOKEN).catch((err) => {
  console.log(err.message);
});
