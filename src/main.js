const http = require("http");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const { PORT, ioConfig, corsConfig } = require("./config");
const websocket = require("./websocket");
const controller = require("./controller");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, ioConfig);

websocket(io);

app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);
app.use(express.static("public"));
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async (_, response) => response.status(200).json({ success: true, message: "Hello", data: null }));
app.post("/login", async (request, response) => await controller.login(request, response, io));
app.get("/me", async (request, response) => await controller.me(request, response, io));
app.get("/sensor", async (request, response) => await controller.get(request, response, io));
app.post("/sensor", async (request, response) => await controller.add(request, response, io));
app.post("/pdf", async (request, response) => await controller.pdf(request, response, io));

server.listen(PORT, async () => {
	console.log(`Server running on: http://localhost:${PORT}`);
});
