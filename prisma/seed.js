const prisma = require("../src/prisma");
const bcrypt = require("bcrypt");

(async () => {
	await prisma.$connect();
	const users = [{ username: "admin", password: "password", rfid: "12345678", fullname: " Administrator" }];

	for (const user of users) {
		const hashPassword = bcrypt.hashSync(user.password, 10);
		await prisma.user.create({
			data: {
				username: user.username,
				password: hashPassword,
				rfid: user.rfid,
				fullname: user.fullname,
			},
		});
	}

	console.log("Berhasil membuat user");

	await prisma.$disconnect();
})();
