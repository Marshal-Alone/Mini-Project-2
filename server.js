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
app.get("/board", (req, res) => res.sendFile(path.join(__dirname, "board.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "register.html")));

const PORT = process.env.PORT || 5050;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Initialize Socket.IO
const io = new Server(server);

// Track active rooms and users
const rooms = new Map();

io.on("connection", (socket) => {
	console.log("a user connected");

	// Handle room joining
	socket.on("joinRoom", ({ roomId, userName, userId }) => {
		socket.join(roomId);

		// Initialize room if it doesn't exist
		if (!rooms.has(roomId)) {
			rooms.set(roomId, {
				users: new Map(),
				password: null,
			});
		}

		const room = rooms.get(roomId);
		room.users.set(socket.id, { userName, userId });

		// Notify others in the room
		socket.to(roomId).emit("userJoined", { userName });

		// Send current room state to new user
		socket.emit("roomData", {
			users: Array.from(room.users.values()),
			isOwner: room.users.size === 1,
		});
	});

	// Handle share event
	socket.on("shareBoard", ({ roomId }) => {
		const room = rooms.get(roomId);
		if (room) {
			const shareLink = `${process.env.BASE_URL}/board?room=${roomId}`;
			socket.emit("shareLink", { shareLink });
		}
	});

	// Handle save event
	socket.on("saveBoard", ({ roomId, dataUrl }) => {
		// Here you would implement actual saving logic
		// For now, just acknowledge the save
		socket.emit("boardSaved", { success: true });
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		// Remove user from all rooms
		rooms.forEach((room, roomId) => {
			if (room.users.has(socket.id)) {
				room.users.delete(socket.id);
				if (room.users.size === 0) {
					rooms.delete(roomId);
				} else {
					io.to(roomId).emit("userLeft", {
						userName: room.users.get(socket.id).userName,
					});
				}
			}
		});
	});
});
