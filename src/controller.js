const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const PDFDocument = require("pdfkit-table");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("./config");
const schema = require("./schema");
const prisma = require("./prisma");

const controller = {
	login: async (request, response, io) => {
		try {
			const body = schema.login.safeParse(request.body);
			if (!body.success) {
				return response.status(400).json({ success: false, message: body.error.errors[0].message, data: null });
			}
			const { username, password } = body.data;
			if (!username || !password) {
				return response.status(400).json({ success: false, message: "Username dan password salah", data: null });
			}
			const user = await prisma.user.findFirst({
				where: { username },
				select: {
					id: true,
					username: true,
					password: true,
					fullname: true,
				},
			});
			if (!user) {
				return response.status(400).json({ success: false, message: "Username dan password salah", data: null });
			}
			const isMatchPassword = await bcrypt.compare(password, user.password);
			if (!isMatchPassword) {
				return response.status(400).json({ success: false, message: "Username dan password salah", data: null });
			}
			const token = jwt.sign(
				{
					id: user.id,
					username: user.username,
					fullname: user.fullname,
				},
				config.JWT_SECRET,
				{ expiresIn: config.JWT_EXPIRES_IN },
			);
			return response.status(200).json({ success: true, message: "Berhasil login", data: { token } });
		} catch (error) {
			return response.status(500).json({ success: true, message: error.message, data: null });
		}
	},

	me: async (request, response, io) => {
		const defaultResponse = { authenticated: false, user: null };
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: defaultResponse });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true, rfid: true },
			});
			if (!user) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: defaultResponse });
			}
			return response.status(200).json({ success: true, message: "Berhasil mengambil data user", data: { authenticated: true, user } });
		} catch (error) {
			return response.status(500).json({ success: false, message: error.message, data: defaultResponse });
		}
	},

	get: async (request, response, io) => {
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true },
			});
			if (!user) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const sensors = await prisma.sensor.findMany({
				take: config.TAKE,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					status: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							fullname: true,
							rfid: true,
						},
					},
				},
			});
			const sensorsMap = sensors.map((item) => ({
				id: item.id,
				createdAt: item.createdAt,
				status: item.status === "TERBUKA" ? "Terbuka" : "Tertutup",
				user: {
					id: item.user.id,
					fullname: item.user.fullname,
					rfid: item.user.rfid,
				},
			}));
			if (io) {
				io.emit("sensor", sensorsMap);
			}
			return response.status(200).json({ success: true, message: "Berhasil mengambil data sensor", data: sensorsMap });
		} catch (error) {
			return response.status(500).json({ success: false, message: error.message, data: null });
		}
	},

	add: async (request, response, io) => {
		try {
			const body = schema.add.safeParse(request.body);
			if (!body.success) {
				return response.status(400).json({ success: false, message: body.error.errors[0].message, data: null });
			}
			const { rfid } = body.data;
			if (!rfid) {
				return response.status(400).json({ success: false, message: "RFID salah", data: null });
			}
			const user = await prisma.user.findFirst({
				where: { rfid },
				select: { id: true },
			});
			if (!user) {
				return response.status(400).json({ success: false, message: "RFID salah", data: null });
			}
			const now = new Date();
			const utcHour = now.getUTCHours();
			const hourUTC7 = (utcHour + 7) % 24;
			const isSiang = hourUTC7 >= 6 && hourUTC7 < 18;

			if (!isSiang) {
				return response.status(200).json({ success: false, message: "Waktu sudah malam", data: null });
			}

			const sensor = await prisma.sensor.findFirst({
				orderBy: { createdAt: "desc" },
				select: { status: true },
			});

			const createdSensor = await prisma.sensor.create({
				data: {
					status: !sensor ? "TERBUKA" : sensor.status === "TERBUKA" ? "TERTUTUP" : "TERBUKA",
					userId: user.id,
				},
			});

			if (!createdSensor) return response.status(400).json({ success: false, message: "Gagal menambah data", data: null });

			const sensors = await prisma.sensor.findMany({
				take: config.TAKE,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					status: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							fullname: true,
							rfid: true,
						},
					},
				},
			});

			const sensorsMap = sensors.map((item) => ({
				id: item.id,
				createdAt: item.createdAt,
				status: item.status === "TERBUKA" ? "Terbuka" : "Tertutup",
				user: {
					id: item.user.id,
					fullname: item.user.fullname,
					rfid: item.user.rfid,
				},
			}));

			if (io) {
				io.emit("sensor", sensorsMap);
			}

			return response.status(200).json({
				success: true,
				message: "Berhasil menambah data",
				data: {
					status: createdSensor.status,
					time: createdSensor.createdAt,
					user: {
						id: createdSensor.id,
						rfid,
					},
				},
			});
		} catch (error) {
			return response.status(500).json({ success: true, message: error.message, data: null });
		}
	},

	pdf: async (request, response, io) => {
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true },
			});
			if (!user) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}

			const body = schema.pdf.safeParse(request.body);
			if (!body.success) {
				return response.status(400).json({
					success: false,
					message: body.error.errors[0].message,
					data: null,
				});
			}

			const { status, bulan, tahun } = body.data;

			const doc = new PDFDocument();
			const randomNumber1 = Date.now();
			const randomNumber2 = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
			const filename = `${randomNumber1}-${randomNumber2}.pdf`;

			const folderPath = path.join(__dirname, "pdf");
			const filePath = path.join(folderPath, filename);

			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath, { recursive: true });
			}

			const start = new Date(tahun, bulan - 1, 1);
			const end = new Date(tahun, bulan, 0, 23, 59, 59, 999);

			const sensors = await prisma.sensor.findMany({
				where: {
					status: status === "terbuka" ? "TERBUKA" : status === "tertutup" ? "TERTUTUP" : { in: ["TERBUKA", "TERTUTUP"] },
					createdAt: {
						gte: start,
						lte: end,
					},
				},
				select: {
					id: true,
					status: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							fullname: true,
							rfid: true,
						},
					},
				},
			});

			const sensorsMap = sensors.map((item) => ({
				id: item.id,
				createdAt: item.createdAt,
				tanggal: `${new Date(item.createdAt).toLocaleString("id-ID", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				})} WIB`,
				status: item.status === "TERBUKA" ? "Terbuka" : "Tertutup",
				user: {
					id: item.user.id,
					fullname: item.user.fullname,
					rfid: item.user.rfid,
				},
			}));

			await new Promise((resolve, reject) => {
				const stream = fs.createWriteStream(filePath);
				doc.pipe(stream);

				const pageWidth = doc.page.width;

				const title = "Riwayat Buka/Tutup Gerbang TK";
				const subtitle = "TK Tadika Mesra";
				const notfound = "Riwayat Tidak Tersedia";

				const titleWidth = doc.widthOfString(title);
				const subtitleWidth = doc.widthOfString(subtitle);
				const notfoundWidth = doc.widthOfString(notfound);

				doc
					.font("Helvetica-Bold")
					.fontSize(14)
					.text(title, (pageWidth - titleWidth) / 2, 50);
				doc
					.font("Helvetica")
					.fontSize(12)
					.text(subtitle, (pageWidth - subtitleWidth) / 2, 68);

				if (!sensorsMap.length) {
					doc
						.font("Helvetica-Oblique")
						.fontSize(14)
						.fillColor("#333333")
						.text(notfound, (pageWidth - notfoundWidth) / 2, 320);
				} else {
					doc.table(
						{
							headers: ["No", "Tanggal", "Status", "Nama User", "RFID"],
							rows: sensorsMap.map((item, index) => [index + 1, item.tanggal, item.status, item.user.fullname, item.user.rfid]),
						},
						{
							x: 50,
							y: 120,
							width: pageWidth - 100,
							columnSpacing: 10,
							columnsSize: [30, 140, 70, 160, 100],
							prepareHeader: () => {
								doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333").strokeColor("#333333");
							},
							prepareRow: (row, i, rectRow, rowIndex) => {
								doc.font("Helvetica").fontSize(10).fillColor("#000000").strokeColor("#333333");
							},
							border: true,
							padding: [4, 8, 4, 8],
						},
					);
				}

				doc.end();

				stream.on("finish", resolve);
				stream.on("error", reject);
			});

			const fileBuffer = await fsp.readFile(filePath);
			const base64 = fileBuffer.toString("base64");

			return response.status(200).json({
				success: true,
				message: "Berhasil membuat PDF",
				data: {
					filename,
					path: filePath,
					base64: `data:application/pdf;base64,${base64}`,
				},
			});
		} catch (error) {
			return response.status(500).json({
				success: false,
				message: error.message,
				data: null,
			});
		}
	},

	users: async (request, response, io) => {
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true },
			});
			if (!user || user.username !== "admin") {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const users = await prisma.user.findMany({
				where: { username: { not: "admin" } },
				orderBy: { id: "asc" },
			});
			const usersMap = users.map((item) => ({
				id: item.id,
				username: item.username,
				fullname: item.fullname,
				rfid: item.rfid,
			}));
			return response.status(200).json({
				success: true,
				message: "Berhasil mengambil data user",
				data: {
					users: usersMap,
				},
			});
		} catch (error) {
			return response.status(500).json({
				success: false,
				message: error.message,
				data: null,
			});
		}
	},

	register: async (request, response, io) => {
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true },
			});
			if (!user || user.username !== "admin") {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const body = schema.register.safeParse(request.body);
			if (!body.success) {
				return response.status(400).json({ success: false, message: body.error.errors[0].message, data: null });
			}
			const { username, password, rfid, fullname } = body.data;
			const userExist = await prisma.user.findFirst({
				where: {
					OR: [{ username }, { rfid }, { fullname }],
				},
				select: { id: true },
			});
			if (userExist) {
				return response.status(400).json({ success: false, message: "User sudah ada", data: null });
			}
			const hashPassword = await bcrypt.hash(password, 10);
			const createdUser = await prisma.user.create({
				data: { username, fullname, rfid, password: hashPassword },
			});
			if (!createdUser) {
				return response.status(400).json({ success: false, message: "Gagal membuat user", data: null });
			}
			return response.status(200).json({
				success: true,
				message: "Berhasil membuat user",
				data: {
					id: createdUser.id,
					username: createdUser.username,
					fullname: createdUser.fullname,
					rfid: createdUser.rfid,
				},
			});
		} catch (error) {
			return response.status(500).json({
				success: false,
				message: error.message,
				data: null,
			});
		}
	},

	delete: async (request, response, io) => {
		try {
			const token = request.headers.authorization?.split(" ")[1];
			if (!token) {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const decoded = jwt.verify(token, config.JWT_SECRET);
			const user = await prisma.user.findFirst({
				where: { id: decoded.id, username: decoded.username },
				select: { id: true, username: true, fullname: true },
			});
			if (!user || user.username !== "admin") {
				return response.status(401).json({ success: false, message: "Token tidak valid", data: null });
			}
			const body = schema.delete.safeParse(request.body);
			if (!body.success) {
				return response.status(400).json({ success: false, message: body.error.errors[0].message, data: null });
			}
			const { id } = body.data;
			const userExist = await prisma.user.findFirst({
				where: { id },
				select: { id: true },
			});
			if (!userExist) {
				return response.status(400).json({ success: false, message: "User tidak ada", data: null });
			}
			const TRANSACTION = await prisma.$transaction(async (database) => {
				const deletedSensors = await database.sensor.deleteMany({
					where: { userId: userExist.id },
				});
				const deletedUser = await database.user.delete({
					where: { id: userExist.id },
				});
				return { deletedSensors, deletedUser };
			});
			if (!TRANSACTION.deletedUser) {
				return response.status(400).json({ success: false, message: "Gagal menghapus user", data: null });
			}
			return response.status(200).json({
				success: true,
				message: "Berhasil menghapus user",
				data: {
					id: TRANSACTION.deletedUser.id,
				},
			});
		} catch (error) {
			return response.status(500).json({
				success: false,
				message: error.message,
				data: null,
			});
		}
	},
};

module.exports = controller;
