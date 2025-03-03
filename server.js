console.log("-------------------STARTING SERVER-------------------");

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const User = require("./models/User");
const Board = require("./models/Board");
const bcrypt = require("bcryptjs");

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

// Store room data
const rooms = {};

// Authentication middleware
const authenticateToken = (req, res, next) => {
	const token = req.cookies.token || req.headers["authorization"]?.split(" ")[1];

	if (!token) return res.status(401).json({ error: "Access denied" });

	try {
		const verified = jwt.verify(token, process.env.JWT_SECRET);
		req.user = verified;
		next();
	} catch (error) {
		res.status(400).json({ error: "Invalid token" });
	}
};

// Auth routes
app.post("/api/register", async (req, res) => {
	try {
		const { fullName, email, password } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({ email });

		if (existingUser) {
			return res.status(400).json({ error: "User already exists" });
		}

		// Hash password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Create new user
		const user = await User.create({
			fullName,
			email,
			password: hashedPassword,
		});

		// Create token
		const token = jwt.sign(
			{ id: user._id, email: user.email, name: user.fullName },
			process.env.JWT_SECRET,
			{ expiresIn: "1d" }
		);

		// Set cookie
		res.cookie("token", token, {
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 1 day
		});

		res.status(201).json({
			message: "User registered successfully",
			user: {
				id: user._id,
				name: user.fullName,
				email: user.email,
			},
			token,
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

app.post("/api/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		// Get user
		const user = await User.findOne({ email });

		if (!user) {
			return res.status(400).json({ error: "Invalid email or password" });
		}

		// Check password
		const validPassword = await bcrypt.compare(password, user.password);
		if (!validPassword) {
			return res.status(400).json({ error: "Invalid email or password" });
		}

		// Create token
		const token = jwt.sign(
			{ id: user._id, email: user.email, name: user.fullName },
			process.env.JWT_SECRET,
			{ expiresIn: "1d" }
		);

		// Set cookie
		res.cookie("token", token, {
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 1 day
		});

		res.status(200).json({
			message: "Login successful",
			user: {
				id: user._id,
				name: user.fullName,
				email: user.email,
			},
			token,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

app.post("/api/logout", (req, res) => {
	res.clearCookie("token");
	res.status(200).json({ message: "Logged out successfully" });
});

app.get("/api/user", authenticateToken, (req, res) => {
	res.status(200).json({ user: req.user });
});

// Board routes
app.post("/api/boards", authenticateToken, async (req, res) => {
	try {
		const { name } = req.body;
		const userId = req.user.id;

		// Generate a unique room ID
		const roomId = uuidv4();
		console.log("ROOM ID = ", roomId);
		// Create board
		const board = await Board.create({
			name,
			roomId,
			createdBy: userId,
		});
		console.log("BOARD = ", board);
		res.status(201).json({
			message: "Board created successfully",
			board,
			roomId,
		});
	} catch (error) {
		console.error("Board creation error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

app.get("/api/boards", authenticateToken, async (req, res) => {
	try {
		const userId = req.user.id;
		console.log("USER ID = ", userId);
		// Get boards
		const boards = await Board.find({ createdBy: userId });

		res.status(200).json({ boards });
	} catch (error) {
		console.error("Get boards error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Socket.io connection handling
io.on("connection", (socket) => {
	console.log("A user connected:", socket.id);

	// Join a room
	socket.on("joinRoom", async ({ roomId, userName, userId }) => {
		console.log(`User ${userName} (${userId}) attempting to join room ${roomId}`);

		// Create room if it doesn't exist
		if (!rooms[roomId]) {
			rooms[roomId] = {
				users: {},
				history: [],
			};
		}

		// Add user to room
		const socketId = socket.id;
		const userColor = getRandomColor();
		const userInitial = userName.charAt(0).toUpperCase();

		rooms[roomId].users[socketId] = {
			id: socketId,
			userId: userId || socketId, // Use provided userId or fallback to socket.id
			name: userName,
			color: userColor,
			initial: userInitial,
		};

		// Join the room
		socket.join(roomId);
		socket.roomId = roomId;

		console.log(`Room ${roomId} now has ${Object.keys(rooms[roomId].users).length} users`);

		// Send current users and drawing history to the new user
		socket.emit("roomData", {
			users: Object.values(rooms[roomId].users),
			history: rooms[roomId].history,
		});

		// Notify all clients in the room about the new user
		io.to(roomId).emit("userJoined", rooms[roomId].users[socketId]);

		// Update user count
		io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);

		console.log(`User ${userName} joined room ${roomId}`);
	});

	// Handle drawing events
	socket.on("drawEvent", (data) => {
		// Broadcast the drawing or erasing event to all other users in the room
		socket.to(socket.roomId).emit("drawEvent", data);
	});

	// Handle clear canvas event
	socket.on("clearCanvas", async () => {
		const roomId = socket.roomId;

		if (roomId && rooms[roomId]) {
			// Clear history
			rooms[roomId].history = [];

			// Broadcast to all other users in the room
			socket.to(roomId).emit("clearCanvas");
		}
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		const roomId = socket.roomId;

		if (roomId && rooms[roomId] && rooms[roomId].users[socket.id]) {
			// Get user data before removing
			const userData = rooms[roomId].users[socket.id];

			// Remove user from room
			delete rooms[roomId].users[socket.id];

			// Notify all clients in the room
			io.to(roomId).emit("userLeft", userData);

			// Update user count
			io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);

			console.log(`User ${userData.name} left room ${roomId}`);
			console.log(`Room ${roomId} now has ${Object.keys(rooms[roomId].users).length} users`);

			// Save history before cleaning up empty rooms
			if (Object.keys(rooms[roomId].users).length === 0) {
				// Save history to database before deleting room
				try {
					Board.updateOne({ roomId }, { history: rooms[roomId].history }).then(() => {
						delete rooms[roomId];
						console.log(`Room ${roomId} saved to database and deleted from memory (empty)`);
					});
				} catch (err) {
					console.error("Error saving board history before cleanup:", err);
					delete rooms[roomId];
				}
			}
		}

		console.log("User disconnected:", socket.id);
	});
});

// Generate a random color for user avatar
function getRandomColor() {
	const colors = [
		"#4f46e5",
		"#0891b2",
		"#7c3aed",
		"#c026d3",
		"#db2777",
		"#e11d48",
		"#ea580c",
		"#d97706",
		"#65a30d",
		"#16a34a",
		"#059669",
	];
	return colors[Math.floor(Math.random() * colors.length)];
}

// Routes
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/board", (req, res) => {
	res.sendFile(path.join(__dirname, "board.html"));
});

app.get("/login", (req, res) => {
	res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/register", (req, res) => {
	res.sendFile(path.join(__dirname, "register.html"));
});

// Start server
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
