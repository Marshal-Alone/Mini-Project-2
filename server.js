require("dotenv").config();
const express = require("express");
const path = require("path");
const User = require("./models/User");
const mongoose = require("mongoose");
const { rmSync } = require("fs");
const { Server } = require("socket.io");

// Connect to MongoDB
mongoose
	.connect(
		"mongodb+srv://trylaptop2024:R4EzWcdNzD9Xf3OW@whiteboard-db.s3oct.mongodb.net/whiteboards"
	)
	.then(() => {
		console.log("Connected to MongoDB");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
	});

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Simple auth routes
app.post("/api/register", async (req, res) => {
	try {
		const { fullName, email, password } = req.body;
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ error: "User already exists" });
		}
		const user = await User.create({ fullName, email, password });
		res.status(201).json({
			user: { id: user._id, name: user.fullName, email: user.email },
		});
	} catch (error) {
		res.status(500).json({ error: "Registration failed" });
	}
});

app.post("/api/login", async (req, res) => {
	// try {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json({ error: "Email and password are required" });
	}
	res.status(200).json({
		success: true,
		message: "Login successful",
		redirectUrl: "/index.html",
		user: { id: user._id, name: user.fullName, email: user.email },
	});
	// 	const { email, password } = req.body;
	// 	if (!email || !password) {
	// 		return res.status(400).json({ error: "Email and password are required" });
	// 	}
	// 	const user = await User.findOne({ email });
	// 	if (!user || password !== user.password) {
	// 		return res.status(400).json({ error: "Invalid credentials" });
	// 	}
	// 	res.status(200).json({
	// 		user: { id: user._id, name: user.fullName, email: user.email },
	// 	});
	// } catch (error) {
	// 	res.status(500).json({ error: "Login failed" });
	// }
});

// Basic routes
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
// app.get("/board", (req, res) => res.sendFile(path.join(__dirname, "board.html")));
app.get("/board", (req, res) =>
	res.redirect(
		"http://localhost:5050/board.html?room=xn2q1s4onzh&name=Enter%20your%20room%20name..."
	)
);
rmSync;
app.get("/login", (req, res) => res.render("index.html")); // app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/register", (req, res) => res.render("index.html"));
// app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "register.html")));

const PORT = process.env.PORT || 5050;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Initialize Socket.IO
const io = new Server(server);

io.on("connection", (socket) => {
	console.log("a user connected");

	socket.on("disconnect", () => {
		console.log("user disconnected");
	});
});
