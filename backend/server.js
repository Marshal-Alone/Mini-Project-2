// Suppress punycode deprecation warning
process.removeAllListeners('warning');

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
const mongoose = require("mongoose");

// Connect to MongoDB with optimized settings and connection pooling
connectDB();

mongoose
	.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/collaboard", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		retryWrites: true,
		w: 'majority',
		maxPoolSize: 10,
		socketTimeoutMS: 45000,
		serverSelectionTimeoutMS: 30000,
		// Connection optimization
		keepAlive: true,
		keepAliveInitialDelay: 300000
	})
	.then(() => {
		console.log("");
		console.log("Connected to MongoDB");
		console.log("MONGODB_URI:", process.env.MONGODB_URI);
	})
	.catch((err) => console.error("Could not connect to MongoDB", err));

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO without CORS and with localhost only
const io = new Server(server, {
	transports: ['websocket', 'polling'],
	cors: {
		origin: "http://localhost:5050",
		methods: ["GET", "POST"]
	}
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files directly
app.use(express.static(path.join(__dirname, "../frontend")));

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

		// Validate input
		if (!fullName || !email || !password) {
			return res.status(400).json({ error: "All fields are required" });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({ error: "Please enter a valid email address" });
		}

		// Validate password length
		if (password.length < 8) {
			return res.status(400).json({ error: "Password must be at least 8 characters long" });
		}

		// Check if user already exists using findOne (more reliable than try-catch for duplicates)
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			//console.log(`Registration attempt with existing email: ${email}`);
			return res
				.status(409)
				.json({ error: "This email is already registered. Please try logging in instead." });
		}

		// Create new user with plain password
		// (it will be hashed by the User model's pre-save middleware)
		const user = new User({
			fullName,
			email,
			password,
		});

		await user.save();

		// Create JWT token
		const token = jwt.sign(
			{ id: user._id, email: user.email, name: user.fullName },
			process.env.JWT_SECRET || "fallback_secret",
			{ expiresIn: "24h" }
		);

		// Log new registration
		console.log(`New user registered: ${email}`);

		// Return user details and token
		res.status(201).json({
			token,
			user: {
				id: user._id,
				name: user.fullName,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);

		// Check specifically for MongoDB duplicate key error
		if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
			return res
				.status(409)
				.json({ error: "This email is already registered. Please try logging in instead." });
		}

		res.status(500).json({ error: "Registration failed. Please try again later." });
	}
});

app.post("/api/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		// Validate input
		if (!email || !password) {
			return res.status(400).json({ error: "Email and password are required" });
		}

		// Find user by email
		const user = await User.findOne({ email });

		// Check if user exists
		if (!user) {
			return res.status(401).json({ error: "Invalid email or password" });
		}

		// Compare passwords
		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			// Log failed login attempt
			console.log(`Failed login attempt for email: ${email}`);
			return res.status(401).json({ error: "Invalid email or password" });
		}

		// Create JWT token
		const token = jwt.sign(
			{ id: user._id, email: user.email, name: user.fullName },
			process.env.JWT_SECRET || "fallback_secret",
			{ expiresIn: "24h" }
		);

		// Log successful login
		console.log(`User logged in: ${email}`);

		// Return user details and token
		res.status(200).json({
			token,
			user: {
				id: user._id,
				name: user.fullName,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "Login failed. Please try again later." });
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
		
		// Create board
		const board = await Board.create({
			name,
			roomId,
			createdBy: userId,
		});
		
		console.log(`User ${req.user.name} created new board: ${name}`);
		
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
		
		// Get boards
		const boards = await Board.find({ createdBy: userId });

		res.status(200).json({ boards });
	} catch (error) {
		console.error("Get boards error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Delete a board
app.delete("/api/boards/:roomId", authenticateToken, async (req, res) => {
	try {
		const { roomId } = req.params;
		const userId = req.user.id;

		// Find the board first to verify ownership
		const board = await Board.findOne({ roomId });
		
		if (!board) {
			return res.status(404).json({ error: "Board not found" });
		}
		
		// Verify the user is the owner of the board
		if (board.createdBy !== userId) {
			return res.status(403).json({ error: "You do not have permission to delete this board" });
		}
		
		// Delete the board
		await Board.deleteOne({ roomId });
		
		res.status(200).json({ message: "Board deleted successfully" });
	} catch (error) {
		console.error("Board deletion error:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Utility function to generate 6-digit code - MUST match the client implementation exactly
function generateSixDigitCode(roomId) {
	// Check if roomId is null or undefined
	if (!roomId) {
		console.log("Warning: Attempted to generate code for undefined or null roomId");
		return "000000"; // Return a default code for null/undefined roomIds
	}

	// Simple hash function to generate a numeric code from a string
	let numericValue = 0;
	for (let i = 0; i < roomId.length; i++) {
		numericValue += roomId.charCodeAt(i);
	}

	// Ensure it's exactly 6 digits by using modulo and padding
	let sixDigitCode = ((numericValue % 900000) + 100000).toString();
	return sixDigitCode;
}

// Add this new route to find board by 6-digit code
app.get("/api/boards/code/:code", async (req, res) => {
	try {
		const { code } = req.params;
		//console.log(`Looking for board with code: ${code}`);

		if (!code || !/^\d{6}$/.test(code)) {
			console.log("Invalid board code format");
			return res.status(400).json({ error: "Invalid board code format. Must be 6 digits." });
		}

		// Optimized approach: Use an in-memory cache for codes
		if (!global.boardCodeCache) {
			global.boardCodeCache = new Map();
		}

		// Check if code is in cache
		if (global.boardCodeCache.has(code)) {
			const cachedBoard = global.boardCodeCache.get(code);
			// Verify board still exists and hasn't changed
			const board = await Board.findOne({ roomId: cachedBoard.roomId });
			if (board) {
				return res.status(200).json({
					roomId: board.roomId,
					name: board.name,
				});
			} else {
				// Board was deleted, remove from cache
				global.boardCodeCache.delete(code);
			}
		}

		// Optimization: Query only necessary fields and limit the result set
		const boards = await Board.find({}, { roomId: 1, name: 1 }).limit(1000);

		if (boards.length === 0) {
			return res.status(404).json({ error: "No boards found in the system" });
		}

		// Build or refresh cache while searching
		for (const board of boards) {
			if (!board.roomId) continue;

			try {
				const boardCode = generateSixDigitCode(board.roomId);
				// Add to cache
				global.boardCodeCache.set(boardCode, {
					roomId: board.roomId,
					name: board.name
				});

				if (boardCode === code) {
					return res.status(200).json({
						roomId: board.roomId,
						name: board.name,
					});
				}
			} catch (err) {
				console.error(`Error generating code for board ${board._id}:`, err);
			}
		}

		return res.status(404).json({ error: "Board not found with this code" });
	} catch (error) {
		console.error("Error finding board by code:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Add a function to periodically refresh the code cache
function refreshBoardCodeCache() {
	setTimeout(async () => {
		try {
			// Clear existing cache
			global.boardCodeCache = new Map();
			
			// Rebuild cache
			const boards = await Board.find({}, { roomId: 1, name: 1 });
			for (const board of boards) {
				if (!board.roomId) continue;
				try {
					const boardCode = generateSixDigitCode(board.roomId);
					global.boardCodeCache.set(boardCode, {
						roomId: board.roomId,
						name: board.name
					});
				} catch (err) {
					console.error(`Cache refresh: Error generating code for board ${board._id}:`, err);
				}
			}
			console.log(`Board code cache refreshed with ${global.boardCodeCache.size} entries`);
		} catch (error) {
			console.error("Error refreshing board code cache:", error);
		}
		
		// Schedule next refresh (every 10 minutes)
		refreshBoardCodeCache();
	}, 10 * 60 * 1000); // 10 minutes
}

// Initialize the cache on server start
refreshBoardCodeCache();

// Socket.io connection handling
// Socket.io optimization settings
io.engine.pingInterval = 1000; // Reduced ping interval for faster reconnects
io.engine.pingTimeout = 2000; // Shorter timeout

// Configure socket middleware for performance
io.use(async (socket, next) => {
	socket.setMaxListeners(20); // Increase max listeners for better event handling
	next();
});

io.on("connection", (socket) => {
	console.log("A user connected:", socket.id);

	socket.on("joinRoom", async ({ roomId, userName, userId, password, hasLocalAuth }) => {
		let roomName;
		try {
			const board = await Board.findOne({ roomId });
			roomName = board ? board.name : roomId;
		} catch (error) {
			roomName = roomId;
		}

		try {
			const boardForAuth = await Board.findOne({ roomId });

			if (boardForAuth && boardForAuth.isPasswordProtected) {
				const isOwner = !!(userId && boardForAuth.createdBy === userId);
				const isAuthorized = rooms[roomId]?.authorizedUsers?.includes(userId || socket.id);

				if (!isOwner && !isAuthorized && !hasLocalAuth) {
					if (!password || password !== boardForAuth.password) {
						socket.emit("passwordRequired", { roomId });
						return;
					}

					if (userId) {
						if (!rooms[roomId]) rooms[roomId] = { users: {}, authorizedUsers: [] };
						rooms[roomId].authorizedUsers.push(userId);
					}
				}
			}

			// Add user to room in memory
			if (!rooms[roomId]) {
				rooms[roomId] = {
					users: {},
					authorizedUsers: [],
				};
			}

			// Check if this userId is already in the room with a different socket
			let existingSocketId = null;
			if (userId) {
				for (const socketId in rooms[roomId].users) {
					if (rooms[roomId].users[socketId].userId === userId) {
						existingSocketId = socketId;
						break;
					}
				}
			}

			// If user exists with different socket ID, remove the old entry
			if (existingSocketId && existingSocketId !== socket.id) {
				//console.log(`User ${userName} reconnected with new socket.`);
				delete rooms[roomId].users[existingSocketId];
			}

			// Add user details
			const socketId = socket.id;
			const userColor = getRandomColor();
			const userInitial = userName.charAt(0).toUpperCase();

			rooms[roomId].users[socketId] = {
				id: socketId,
				userId: userId || socketId,
				name: userName,
				color: userColor,
				initial: userInitial,
			};

			// Join the room
			socket.join(roomId);
			socket.roomId = roomId;

			// Find or create board in the database
			let board = await Board.findOne({ roomId }).select({
				history: 1,
				name: 1,
				roomId: 1,
				createdBy: 1,
			});

			if (!board) {
				//console.log(`Creating new board for room ${roomId}`);
				board = new Board({
					roomId,
					name: roomId, // Default name is the roomId
					history: [],
					createdBy: userId || socketId,
				});
				await board.save();
			}

			// Send board history from database to the new user
			socket.emit("roomData", {
				users: Object.values(rooms[roomId].users),
				history: board.history || [],
			});
			
			// Check and notify if user is the owner
			const isOwner = !!(userId && board.createdBy === userId);
			socket.emit("userRights", { isOwner });

			// Notify all clients about the new user
			io.to(roomId).emit("userJoined", rooms[roomId].users[socketId]);
			io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);
			
			//console.log(`User ${userName} joined board "${roomName}"`);
		} catch (error) {
			console.error("Error joining room:", error);
			socket.emit("error", { message: "Error joining room" });
		}
	});

	// Check password for a room
	socket.on("checkRoomPassword", async ({ roomId, password }) => {
		try {
			const board = await Board.findOne({ roomId });

			if (!board) {
				socket.emit("passwordCheckResult", {
					success: false,
					message: "Room not found",
				});
				return;
			}

			if (!board.isPasswordProtected) {
				socket.emit("passwordCheckResult", {
					success: true,
					message: "No password required",
				});
				return;
			}

			const passwordMatches = password === board.password;

			if (passwordMatches) {
				// Add to authorized users
				if (!rooms[roomId]) {
					rooms[roomId] = { users: {}, authorizedUsers: [] };
				}

				if (!rooms[roomId].authorizedUsers) {
					rooms[roomId].authorizedUsers = [];
				}

				rooms[roomId].authorizedUsers.push(socket.id);

				socket.emit("passwordCheckResult", {
					success: true,
					message: "Password correct",
				});
			} else {
				socket.emit("passwordCheckResult", {
					success: false,
					message: "Incorrect password",
				});
			}
		} catch (error) {
			console.error("Error checking room password:", error);
			socket.emit("passwordCheckResult", {
				success: false,
				message: "Error checking password",
			});
		}
	});

	// Set room password
	socket.on("setRoomPassword", async ({ roomId, password }) => {
		try {
			// Get board info
			const board = await Board.findOne({ roomId });

			if (!board) {
				socket.emit("error", { message: "Board not found" });
				return;
			}

			// Update password
			board.isPasswordProtected = true;
			board.password = password;
			await board.save();

			// Notify other users in the room that the room now requires a password
			socket.to(roomId).emit("roomPasswordUpdated", true);
		} catch (error) {
			console.error("Error setting room password:", error);
			socket.emit("error", { message: "Error setting password" });
		}
	});

	// Remove room password
	socket.on("removeRoomPassword", async ({ roomId }) => {
		try {
			// Get board info
			const board = await Board.findOne({ roomId });

			if (!board) {
				socket.emit("error", { message: "Board not found" });
				return;
			}

			// Remove password
			board.isPasswordProtected = false;
			board.password = "";
			await board.save();

			// Clear authorized users list
			if (rooms[roomId] && rooms[roomId].authorizedUsers) {
				rooms[roomId].authorizedUsers = [];
			}

			// Notify other users in the room
			socket.to(roomId).emit("roomPasswordUpdated", false);
		} catch (error) {
			console.error("Error removing room password:", error);
			socket.emit("error", { message: "Error removing password" });
		}
	});

	// When a user is fully connected to a room
	socket.on("userReady", async ({ roomId }) => {
		try {
			// Get board info from database
			const boardInfo = await Board.findOne({ roomId });
			
			if (boardInfo) {
				// Get user ID from the room users
				const userId = rooms[roomId]?.users[socket.id]?.userId;
				
				// Send password status
				socket.emit("roomPasswordStatus", boardInfo.isPasswordProtected);

				// Check and send if user is owner
				const isOwner = !!(userId && boardInfo.createdBy === userId);
				socket.emit("userRights", { isOwner });
			} else {
				//console.log(`Board not found for roomId: ${roomId}`);
			}
		} catch (error) {
			console.error("Error in userReady:", error);
		}
	});

	// Handle drawing events with image support
	socket.on("drawEvent", async (data) => {
		const roomId = socket.roomId;

		// Add timestamp if not present
		if (!data.timestamp) {
			data.timestamp = Date.now();
		}

		// Handle image data optimization
		if (data.tool === 'image') {
			try {
				const board = await Board.findOne({ roomId });
				if (board) {
					// Add the new image to the images array
					board.images = board.images || [];
					board.images.push({
						data: data.imageData,
						position: data.position || { x: 0, y: 0 },
						size: data.size || { width: 200, height: 200 },
						timestamp: data.timestamp
					});
					await board.save();
				}
			} catch (error) {
				console.error('Error saving image to database:', error);
				socket.emit('error', { message: 'Error saving image' });
				return;
			}
		}

		// Broadcast to other users in the room
		socket.to(roomId).emit("drawEvent", data);

		// Save to database
		try {
			if (roomId) {
				await Board.updateOne(
					{ roomId },
					{
						$push: { history: data },
						$set: { updatedAt: Date.now() },
					},
					{ new: true }
				);
			}
		} catch (error) {
			console.error("Error saving drawing event:", error);
			socket.emit("error", { message: "Failed to save drawing event" });
		}
	});

	// Handle clear canvas event
	socket.on("clearCanvas", async () => {
		const roomId = socket.roomId;

		if (roomId) {
			// Broadcast to all other users in the room
			socket.to(roomId).emit("clearCanvas");

			// Clear history in database
			try {
				await Board.updateOne(
					{ roomId },
					{
						$set: {
							history: [],
							updatedAt: Date.now(),
						},
					}
				);
				const userName = rooms[roomId]?.users[socket.id]?.name || "Unknown User";
				//console.log(`User ${userName} cleared board`);
			} catch (error) {
				console.error("Error clearing board history:", error);
			}
		}
	});

	// Handle board sync requests
	socket.on("requestBoardSync", async ({ roomId }) => {
		try {
			const board = await Board.findOne({ roomId }).select({ history: 1 });

			if (board && board.history) {
				// Send the full history back to the requesting client
				socket.emit("boardSync", {
					history: board.history,
				});
			} else {
				socket.emit("error", { message: "Board not found for sync" });
			}
		} catch (error) {
			console.error("Error syncing board:", error);
			socket.emit("error", { message: "Error syncing board" });
		}
	});
	
	// Add explicit ownership check handler
	socket.on("checkOwnership", async (data) => {
		try {
			const { roomId } = data;
			// Get user ID from the room users
			const userId = rooms[roomId]?.users[socket.id]?.userId;
			
			// Fetch the board from the database
			const board = await Board.findOne({ roomId });
			
			if (board) {
				// Ensure we have a boolean, not undefined or null
				const isOwner = !!(userId && board.createdBy === userId);
				socket.emit("userRights", { isOwner });
			} else {
				//console.log(`Board not found for ownership check: ${roomId}`);
				socket.emit("userRights", { isOwner: false });
			}
		} catch (err) {
			console.error("Error checking ownership:", err);
			socket.emit("userRights", { isOwner: false });
		}
	});

	// Handle disconnection
	socket.on("disconnect", async () => {
		console.log("User disconnected:", socket.id);
		const roomId = socket.roomId;
		if (!roomId || !rooms[roomId] || !rooms[roomId].users) return;
		
		const userName = rooms[roomId]?.users[socket.id]?.name || "Unknown User";
		//console.log(`User ${userName} disconnected`);

		// Get user info before removing
		const userInfo = rooms[roomId].users[socket.id];

		// Remove user from room
		delete rooms[roomId].users[socket.id];

		// Notify other users with more information
		if (userInfo) {
			io.to(roomId).emit("userLeft", {
				id: socket.id, // Always include the socket id
				name: userInfo.name || "Unknown User",
				userId: userInfo.userId || socket.id
			});
		} else {
			// If no user info, at least send the socket ID
			io.to(roomId).emit("userLeft", {
				id: socket.id,
				name: "Unknown User"
			});
		}

		io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);

		// If room is empty, clean up (but don't delete from DB)
		if (Object.keys(rooms[roomId].users).length === 0) {
			delete rooms[roomId];
			// Get board name if available
			try {
				const board = await Board.findOne({ roomId });
				const roomName = board ? board.name : roomId;
				//console.log(`Board "${roomName}" is now empty`);
			} catch (error) {
				//console.log(`Room ${roomId} is now empty`);
			}
		}
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
	res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/board", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/board.html"));
});

app.get("/login", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

app.get("/register", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/register.html"));
});

// Create test user if not exists
const createTestUser = async () => {
	try {
		const testEmail = "test@example.com";
		const testPassword = "password123";

		const existingUser = await User.findOne({ email: testEmail });
		if (!existingUser) {
			const user = new User({
				fullName: "Test User",
				email: testEmail,
				password: testPassword,
			});
			await user.save();
			//console.log("Test user created:", testEmail);
		}
	} catch (error) {
		console.error("Error creating test user:", error);
	}
};

// Start server on port 5050
// const PORT = 5050;

// Start server
const PORT = process.env.PORT || 5050;

// Function to check if port is in use
function isPortInUse(port) {
	return new Promise((resolve) => {
		const net = require("net");
		const server = net.createServer();

		server.once("error", (err) => {
			if (err.code === "EADDRINUSE") {
				resolve(true);
			} else {
				resolve(false);
			}
			server.close();
		});

		server.once("listening", () => {
			server.close();
			resolve(false);
		});

		server.listen(port);
	});
}

// Function to find and kill process using a specific port on Windows
function findAndKillProcessOnPort(port) {
	return new Promise((resolve) => {
		try {
			// Use execSync for synchronous execution
			const { execSync } = require("child_process");

			// Get all PIDs in one go
			const stdout = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();

			// Extract unique PIDs first
			const pids = new Set();
			const lines = stdout.trim().split("\n");

			for (const line of lines) {
				const parts = line.trim().split(/\s+/);
				const pid = parts[parts.length - 1];
				if (pid && !isNaN(parseInt(pid))) {
					pids.add(pid);
				}
			}

			// Now kill each unique PID
			let success = false;
			for (const pid of pids) {
				console.log(`Attempting to kill process ${pid}...`);
				try {
					execSync(`taskkill /F /PID ${pid}`);
					console.log(`Successfully killed process ${pid}`);
					success = true;
				} catch (killError) {
					console.warn(`Process ${pid} already terminated: ${killError.message}`);
				}
			}

			resolve(success);
		} catch (error) {
			if (error.message.includes("Command failed")) {
				console.warn("No processes found using port", port);
			} else {
				console.warn("Error:", error.message);
			}
			resolve(false);
		}
	});
}

// Start server with port checking - improved version
async function startServer() {
	let inUse = await isPortInUse(PORT);
	let attempts = 0;
	const maxAttempts = 3;

	while (inUse && attempts < maxAttempts) {
		attempts++;
		console.log(
			`Port ${PORT} is already in use. Attempting to kill the process... (Attempt ${attempts}/${maxAttempts})`
		);

		if (process.platform === "win32") {
			await findAndKillProcessOnPort(PORT);
		} else {
			// For Mac/Linux
			try {
				require("child_process").execSync(`lsof -i :${PORT} -t | xargs kill -9`);
				console.log(`Process using port ${PORT} was terminated`);
			} catch (error) {
				console.warn(`Could not kill process on port ${PORT}: ${error.message}`);
			}
		}

		// Wait for the port to be released
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check again if the port is still in use
		inUse = await isPortInUse(PORT);
	}

	if (inUse) {
		console.error(`Port ${PORT} is still in use after ${maxAttempts} attempts.`);
		console.error(`Please manually close the application using port ${PORT} and try again.`);
		process.exit(1);
	}

	// Start the server
	server.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);
		console.log("Performance optimizations enabled:");
		console.log("- WebSocket ping interval: 25s");
		console.log("- Event throttling: 100 events/second");
		console.log("- Room cleanup: every 5 minutes");
		console.log("- Inactive room timeout: 30 minutes");
	});

	// Handle any errors that might still occur
	server.on("error", (e) => {
		if (e.code === "EADDRINUSE") {
			console.error(`Failed to bind to port ${PORT}. The port is still in use.`);
			process.exit(1);
		} else {
			console.error("Server error:", e);
		}
	});
}

startServer();

// Add this new route to fetch images for a room
app.get("/api/boards/:roomId/images", async (req, res) => {
	try {
		const { roomId } = req.params;
		const board = await Board.findOne({ roomId }).select('images');
		if (board && board.images) {
			res.status(200).json({ images: board.images });
		} else {
			res.status(404).json({ error: "No images found for this board" });
		}
	} catch (error) {
		console.error("Error fetching images:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Add this new route to save images for a room
app.post("/api/boards/:roomId/images", async (req, res) => {
	try {
		const { roomId } = req.params;
		const { imageData, position, size, timestamp } = req.body;

		if (!imageData || !position || !size) {
			return res.status(400).json({ error: "Missing required image data" });
		}

		const board = await Board.findOne({ roomId });
		if (!board) {
			return res.status(404).json({ error: "Board not found" });
		}

		// Add the new image to the images array
		board.images = board.images || [];
		board.images.push({
			data: imageData,
			position,
			size,
			timestamp: timestamp || Date.now()
		});

		await board.save();
		res.status(200).json({ message: "Image saved successfully" });
	} catch (error) {
		console.error("Error saving image:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Add this new route to delete all images from a room
app.delete("/api/boards/:roomId/images", async (req, res) => {
	try {
		const { roomId } = req.params;
		const board = await Board.findOne({ roomId });
		
		if (!board) {
			return res.status(404).json({ error: "Board not found" });
		}

		// Clear the images array
		board.images = [];
		await board.save();
		
		res.status(200).json({ message: "Images cleared successfully" });
	} catch (error) {
		console.error("Error clearing images:", error);
		res.status(500).json({ error: "Server error" });
	}
});
