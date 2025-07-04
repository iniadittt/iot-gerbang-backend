const dotenv = require("dotenv");

dotenv.config();

const PORT = process.env.PORT || 9000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const TAKE = 50;

const ioConfig = {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
};

const corsConfig = {
	origin: "*",
	methods: ["GET", "POST", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

module.exports = {
	PORT,
	JWT_SECRET,
	JWT_EXPIRES_IN,
	TAKE,
	ioConfig,
	corsConfig,
};
