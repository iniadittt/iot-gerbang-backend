const { z } = require("zod");

const schema = {
	login: z.object({
		username: z.string().min(1, { message: "Username harus diisi" }),
		password: z.string().min(8, { message: "Password minimal 8 karakter" }),
	}),
	add: z.object({
		rfid: z.string().min(8, { message: "RFID minimal 8 karakter" }),
	}),
	pdf: z.object({
		status: z.enum(["terbuka", "tertutup", "semua"]).optional().default("semua"),
		bulan: z.number().min(1).max(12).positive(),
		tahun: z.number().min(1900).max(2100).positive(),
	}),
	register: z.object({
		username: z.string().min(1, { message: "Username harus diisi" }),
		password: z.string().min(8, { message: "Password minimal 8 karakter" }),
		rfid: z.string().min(1, { message: "RFID harus diisi" }),
		fullname: z.string().min(1, { message: "Nama lengkap harus diisi" }),
	}),
	delete: z.object({
		id: z.number().positive().min(1, { message: "Id harus diisi" }),
	}),
};

module.exports = schema;
