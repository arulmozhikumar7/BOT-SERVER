const TelegramBot = require("node-telegram-bot-api");
const { Wit } = require("node-wit");
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const axios = require("axios");
const app = express();

const port = 3000;
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

const witClient = new Wit({
  accessToken: process.env.WIT_TOKEN,
});

const restaurantsData = [
  { name: "Restaurant A", route: "NH 44", location: "Chennai" },
  { name: "Restaurant B", route: "NH 44", location: "Madurai" },
  { name: "Restaurant C", route: "Main Road", location: "Chennai" },
  { name: "Restaurant D", route: "Highway 66", location: "Madurai" },
  { name: "Restaurant E", route: "NH 44", location: "Madurai" },
  { name: "Restaurant F", route: "NH 48", location: "Bangalore" },
  { name: "Restaurant G", route: "NH 83", location: "Madurai" },
  { name: "Restaurant H", route: "NH 38", location: "Madurai" },
  { name: "Restaurant I", route: "ECR", location: "Pondicherry" },
  { name: "Restaurant J", route: "NH 48", location: "Chennai" },
  { name: "Restaurant K", route: "NH 544", location: "Chennai" },
  { name: "Restaurant L", route: "NH 83", location: "Coimbatore" },
  { name: "Restaurant M", route: "NH 48", location: "Coimbatore" },
  { name: "Ashwin's Restaurant", route: "NH 45", location: "Perambalur" },
  { name: "Manoj Bhavan", route: "NH 45", location: "Mamandur" },
  { name: "Murugan Idly", route: "NH 45", location: "Maduranthakam" },
];

const city_routes = {
  Chennai: {
    Madurai: "NH 44",
    Coimbatore: "NH 544",
    Bangalore: "NH 48",
    Pondicherry: "ECR",
    Trichy: "NH 45",
  },
  Madurai: {
    Chennai: "NH 44",
    Coimbatore: "NH 83",
    Trichy: "NH 38",
  },
  Coimbatore: {
    Chennai: "NH 544",
    Madurai: "NH 83",
  },
  Trichy: {
    Chennai: "NH 45",
  },
};

app.use(bodyParser.json());

app.post("/handle-message", async (req, res) => {
  try {
    const { entities } = req.body;

    const startCityEntity = entities["start_city:start_city"];
    const endCityEntity = entities["end_city:end_city"];

    if (!startCityEntity || !endCityEntity) {
      throw new Error("Start city or end city not found in the message");
    }

    const startCity = startCityEntity[0].value;
    const endCity = endCityEntity[0].value;

    // Call function to find restaurants along the route
    const restaurants = findRestaurantsAlongRoute(startCity, endCity);

    res.json({ restaurants });
  } catch (error) {
    console.error("Error handling message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function findRestaurantsAlongRoute(startCity, endCity) {
  const route = city_routes[startCity][endCity];
  const restaurants = [];

  for (const restaurant of restaurantsData) {
    if (restaurant.route === route) {
      restaurants.push({
        name: restaurant.name,
        location: restaurant.location,
      });
    }
  }

  return restaurants;
}
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageText = callbackQuery.data;

  try {
    if (messageText === "select_another_route") {
      // If "select_another_route" option is selected, send route options again
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Chennai to Madurai",
                callback_data: "Chennai to Madurai",
              },
              { text: "Chennai to Trichy", callback_data: "Chennai to Trichy" },
            ],
            // Add more options here if needed
          ],
        },
      };
      bot.sendMessage(chatId, "Please choose another route:", options);
    } else {
      // Handle route selection logic here
      const witResponse = await witClient.message(messageText); // Send the message to Wit.ai
      // Extract start and end cities from Wit.ai response
      const startCityEntity = witResponse.entities["start_city:start_city"];
      const endCityEntity = witResponse.entities["end_city:end_city"];

      if (!startCityEntity || !endCityEntity) {
        throw new Error("Start city or end city not found in the message");
      }

      const startCity = startCityEntity[0].value;
      const endCity = endCityEntity[0].value;

      const response = await axios.post(
        "http://localhost:3000/handle-message",
        witResponse,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      const restaurants = data.restaurants;

      const responseMessage = restaurants
        .map((restaurant) => `${restaurant.name} (${restaurant.location})`)
        .join(", ");

      bot.sendMessage(
        chatId,
        `Restaurants between ${startCity} and ${endCity}: ${responseMessage}`
      );

      // Send "Select another route" button after displaying the result
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Select another route",
                callback_data: "select_another_route",
              },
            ],
          ],
        },
      };
      bot.sendMessage(chatId, "Select another route:", options);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    bot.sendMessage(chatId, "Please provide a valid route.");
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const message = msg.text;

  try {
    // Check if the message starts with '/'
    if (message.startsWith("/")) {
      // Handle command messages
      handleCommand(chatId, message);
    } else {
      // Handle normal text messages
      handleTextMessage(chatId, message);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    bot.sendMessage(chatId, "An error occurred while processing your message.");
  }
});

// Function to handle command messages
function handleCommand(chatId, message) {
  if (message === "/start") {
    sendRouteOptions(chatId);
  }
  // Add more command handling logic if needed
}

// Function to handle normal text messages
async function handleTextMessage(chatId, message) {
  try {
    const witResponse = await witClient.message(message); // Send the message to Wit.ai
    // Extract start and end cities from Wit.ai response
    const startCityEntity = witResponse.entities["start_city:start_city"];
    const endCityEntity = witResponse.entities["end_city:end_city"];

    if (!startCityEntity || !endCityEntity) {
      throw new Error("Start city or end city not found in the message");
    }

    const startCity = startCityEntity[0].value;
    const endCity = endCityEntity[0].value;

    const response = await axios.post(
      "http://localhost:3000/handle-message",
      witResponse,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;
    const restaurants = data.restaurants;

    const responseMessage = restaurants
      .map((restaurant) => `${restaurant.name} (${restaurant.location})`)
      .join(", ");

    bot.sendMessage(
      chatId,
      `Restaurants between ${startCity} and ${endCity}: ${responseMessage}`
    );

    // Send "Select another route" button after displaying the result
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Select another route",
              callback_data: "select_another_route",
            },
          ],
        ],
      },
    };
    bot.sendMessage(chatId, "Select another route:", options);
  } catch (error) {
    console.error("Error processing message:", error);
    bot.sendMessage(chatId, "Please provide a valid route.");
  }
}

// Function to send route options
function sendRouteOptions(chatId) {
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Chennai to Madurai", callback_data: "Chennai to Madurai" },
          { text: "Chennai to Trichy", callback_data: "Chennai to Trichy" },
        ],
        // Add more options here if needed
      ],
    },
  };
  bot.sendMessage(chatId, "Please choose a route:", options);
}

// Callback query handler
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageText = callbackQuery.data;

  try {
    if (messageText === "select_another_route") {
      sendRouteOptions(chatId);
    } else {
      // Handle route selection logic here
      await handleTextMessage(chatId, messageText);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    bot.sendMessage(chatId, "Please provide a valid route.");
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Chennai to Madurai", callback_data: "Chennai to Madurai" },
          { text: "Chennai to Trichy", callback_data: "Chennai to Trichy" },
        ],
        // Add more options here if needed
      ],
    },
  };
  bot.sendMessage(chatId, "Please choose a route:", options);
});

app.listen(port, () => {
  console.log(`Server is running on ${port} port.`);
});
