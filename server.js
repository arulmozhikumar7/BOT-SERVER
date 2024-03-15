const TelegramBot = require("node-telegram-bot-api");
const { Wit } = require("node-wit");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

const token =
  process.env.TOKEN || "7162726619:AAFQiddZOWqbO7Wpnos9vLYyTQ2P0rNmcwM";
const bot = new TelegramBot(token, { polling: true });

const witClient = new Wit({
  accessToken: process.env.WIT_TOKEN || "G4MP7RBM7IEDJQFM3PUGKF5X3XMTSQC6",
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

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const message = msg.text;

  try {
    const witResponse = await witClient.message(message);

    const startCityEntity = witResponse.entities["start_city:start_city"];
    const endCityEntity = witResponse.entities["end_city:end_city"];

    if (!startCityEntity || !endCityEntity) {
      throw new Error("Start city or end city not found in the message");
    }

    const startCity = startCityEntity[0].value;
    const endCity = endCityEntity[0].value;

    const response = await fetch("http://localhost:3000/handle-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(witResponse),
    });

    const data = await response.json();
    const restaurants = data.restaurants;

    const responseMessage = restaurants
      .map((restaurant) => `${restaurant.name} (${restaurant.location})`)
      .join(", ");
    bot.sendMessage(
      chatId,
      `Restaurants between ${startCity} and ${endCity}: ${responseMessage}`
    );
  } catch (error) {
    console.error("Error processing message:", error);
    bot.sendMessage(chatId, "Please Provide a valid route.");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});