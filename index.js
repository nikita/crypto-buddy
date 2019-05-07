require("dotenv").config();

const request = require("request-promise");
const Discord = require("discord.js");
const client = new Discord.Client();

const {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  BOT_PREFIX,
  BOT_INTERVAL,
  NODE_ENV
} = process.env;

const symbols = ["XBTUSD", "ETHUSD"];
var alerts = [];

const BitMexApi =
  "https://www.bitmex.com/api/v1/trade/bucketed?binSize=1m&partial=true&count=100&reverse=true";

const getCoins = async () => {
  const options = {
    url: BitMexApi,
    json: true
  };
  try {
    const r = await request(options);

    let prices = [];

    for (let i = 0; i < r.length; i++) {
      const coin = r[i];
      const symbol = coin["symbol"];
      const price = coin["close"];
      let obj = { symbol, price };

      if (symbols.indexOf(symbol) > -1) {
        prices.push(obj);
      }
    }
    return prices;
  } catch {
    return false;
  }
};

const addAlert = coin => {
  const { symbol, price, type } = coin;
  if (symbols.indexOf(symbol) > -1) {
    alerts.push(coin);
    console.log(alerts);
    return true;
  } else {
    return false;
  }
};

const alertUser = (coin, alert) => {
  const { symbol, price } = coin;
  const alert_type = alert["type"];
  const alert_price = alert["price"];
  try {
    const embed = new Discord.RichEmbed()
      .setAuthor("CryptoBuddy", "https://i.imgur.com/lm8s41J.png")
      .setTitle(
        symbol +
          (alert_type
            ? " crossed (above) " + `$${alert_price}`
            : " crossed (below) " + `$${alert_price}`)
      )
      .addField("Symbol", `${symbol}`)
      .addField("Price", `$${price}`)
      /*
       * Alternatively, use "#00AE86", [0, 174, 134] or an integer number.
       */
      .setColor(0x00ae86)
      .setFooter("@Unverified", "http://i.imgur.com/w1vhFSR.png")
      /*
       * Takes a Date object, defaults to current date.
       */
      .setTimestamp();
    /*
      .addField("Inline Field", "They can also be inline.", true);
    */
    client.channels.get(DISCORD_CHANNEL_ID).send(embed);
    var index = alerts.indexOf(alert);
    if (index !== -1) alerts.splice(index, 1);
  } catch {
    return false;
  }
};

const checkAlerts = async () => {
  const coins = await getCoins();

  console.log("CHECKING!");
  console.log(alerts);

  for (_coin in coins) {
    let coin = coins[_coin];

    for (_alert in alerts) {
      let alert = alerts[_alert];
      if (coin["symbol"] == alert["symbol"]) {
        if (
          (alert["type"] && coin["price"] >= alert["price"]) ||
          (!alert["type"] && coin["price"] <= alert["price"])
        ) {
          await alertUser(coin, alert);
        }
      }
    }
  }
};

client.on("ready", () => {
  // This event will run if the bot starts, and logs in, successfully.
  console.log(
    `Bot has started, with ${client.users.size} users, in ${
      client.channels.size
    } channels of ${client.guilds.size} guilds.`
  );
  // Example of changing the bot's playing game to something useful. `client.user` is what the
  // docs refer to as the "ClientUser".
  client.user.setActivity(`${client.users.size} users`, { type: "WATCHING" });

  // tick once on startup
  checkAlerts();
  setInterval(checkAlerts, BOT_INTERVAL * 1000);
});

client.on("guildCreate", guild => {
  // This event triggers when the bot joins a guild.
  console.log(
    `New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${
      guild.memberCount
    } members!`
  );
  client.user.setActivity(`${client.users.size} users`, { type: "WATCHING" });
});

client.on("guildDelete", guild => {
  // this event triggers when the bot is removed from a guild.
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
  client.user.setActivity(`${client.users.size} users`, { type: "WATCHING" });
});

client.on("message", async message => {
  // It's good practice to ignore other bots. This also makes your bot ignore itself
  // and not get into a spam loop (we call that "botception").
  if (message.author.bot) return;

  // Also good practice to ignore any message that does not start with our prefix,
  // which is set in the configuration file.
  if (message.content.indexOf(BOT_PREFIX) !== 0) return;

  // Here we separate our "command" name, and our "arguments" for the command.
  // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
  // command = say
  // args = ["Is", "this", "the", "real", "life?"]
  const args = message.content
    .slice(BOT_PREFIX.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    // Calculates ping between sending a message and editing it, giving a nice round-trip latency.
    // The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
    const m = await message.channel.send("Ping?");
    m.edit(
      `Pong! Latency is ${m.createdTimestamp -
        message.createdTimestamp}ms. API Latency is ${Math.round(
        client.ping
      )}ms`
    );
  }

  if (command === "alert") {
    const symbol = args[0];
    const type = args[1].toLowerCase() == "below" ? 0 : 1;
    const price = args[2];

    if (!symbol || !args[1] || !price) {
      return message.channel.send(
        "Incorrect syntax, please check !commands for more information."
      );
    }

    if (addAlert({ symbol, type, price })) {
      await message.channel.send(
        `Successfully added alert for ${symbol} at ${price}`
      );
    } else {
      await message.channel.send(
        `Failed to add alert for ${symbol} at ${price}`
      );
    }
  }
});

client.login(DISCORD_TOKEN);
