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

// Connect to MongoDB
connectDB();

mongoose
	.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/collaboard", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		retryWrites: true,
		w: 'majority'
	})
	.then(() => {
		console.log("");
		console.log("Connected to MongoDB");
	})
	.catch((err) => console.error("Could not connect to MongoDB", err));

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
	origin: process.env.NODE_ENV === 'production' 
		? ['https://collaborative-whiteboard-z8ai.onrender.com', 'https://online-whiteboard-mini-project.netlify.app']
		: ['http://localhost:3000', '*'], // Allow localhost:3000 and all origins in development
	methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
	credentials: true,
	preflightContinue: false,
	optionsSuccessStatus: 204
};

// Apply CORS middleware before other middleware
app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (process.env.NODE_ENV === 'development' || corsOptions.origin.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin || '*');
	}
	res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(','));
	res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
	
	// Handle preflight requests
	if (req.method === 'OPTIONS') {
		return res.status(corsOptions.optionsSuccessStatus).end();
	}
	
	next();
});

const io = new Server(server, {
	cors: corsOptions,
	pingTimeout: 60000, // Increase ping timeout
	pingInterval: 25000, // Increase ping interval
	transports: ['websocket', 'polling'], // Prefer WebSocket
	allowEIO3: true, // Allow Engine.IO v3 clients
	path: '/socket.io/', // Explicit path
	serveClient: false, // Don't serve client files
	connectTimeout: 45000, // Connection timeout
	upgradeTimeout: 30000, // Upgrade timeout
	perMessageDeflate: {
		threshold: 1024, // Only compress messages larger than 1KB
	},
	httpCompression: true
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files in development only
if (process.env.NODE_ENV !== 'production') {
	app.use(express.static(path.join(__dirname, "../frontend")));
}

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
			console.log(`Registration attempt with existing email: ${email}`);
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
		console.log(`Looking for board with code: ${code}`);

		if (!code || !/^\d{6}$/.test(code)) {
			console.log("Invalid board code format");
			return res.status(400).json({ error: "Invalid board code format. Must be 6 digits." });
		}

		// Get all boards (ideally you would have a more efficient lookup)
		const boards = await Board.find({});
		console.log(`Found ${boards.length} boards to check against code ${code}`);

		if (boards.length === 0) {
			console.log("No boards exist in the database");
			return res.status(404).json({ error: "No boards found in the system" });
		}

		// Find the board with the matching code
		// We'll compute the 6-digit code for each board and check for a match
		console.log("Checking each board for matching code:");
		let validBoardsCount = 0;

		for (const board of boards) {
			// Skip boards with missing roomId
			if (!board.roomId) {
				console.log(`Skipping board with id ${board._id} - missing roomId`);
				continue;
			}

			validBoardsCount++;

			try {
				// Use the utility function to generate code
				const boardCode = generateSixDigitCode(board.roomId);
				console.log(`Board "${board.name}" (roomId: ${board.roomId}) has code: ${boardCode}`);

				if (boardCode === code) {
					// Found the matching board
					console.log(`MATCH FOUND! Returning board with roomId: ${board.roomId}`);
					return res.status(200).json({
						roomId: board.roomId,
						name: board.name,
					});
				}
			} catch (err) {
				console.error(`Error generating code for board ${board._id}:`, err);
				// Continue to next board
			}
		}

		// If no board found with that code
		console.log(
			`No board found with code: ${code} after checking ${validBoardsCount} valid boards`
		);
		return res.status(404).json({ error: "Board not found with this code" });
	} catch (error) {
		console.error("Error finding board by code:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Performance monitoring and optimization
const performanceMetrics = {
	lastCleanup: Date.now(),
	cleanupInterval: 5 * 60 * 1000, // 5 minutes
	eventCounts: {},
	maxEventsPerSecond: 100,
	throttleDelay: 1000 // 1 second
};

// Cleanup function to prevent memory leaks
const cleanupInactiveRooms = () => {
	const now = Date.now();
	const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

	for (const roomId in rooms) {
		const room = rooms[roomId];
		let hasActiveUsers = false;

		for (const socketId in room.users) {
			const user = room.users[socketId];
			if (now - user.lastActive < inactiveThreshold) {
				hasActiveUsers = true;
				break;
			}
		}

		if (!hasActiveUsers) {
			delete rooms[roomId];
			console.log(`Cleaned up inactive room: ${roomId}`);
		}
	}

	performanceMetrics.lastCleanup = now;
};

// Event throttling to prevent overload
const throttleEvents = (socket, eventType) => {
	const now = Date.now();
	const key = `${socket.id}-${eventType}`;
	
	if (!performanceMetrics.eventCounts[key]) {
		performanceMetrics.eventCounts[key] = {
			count: 0,
			lastReset: now
		};
	}

	const metrics = performanceMetrics.eventCounts[key];
	
	if (now - metrics.lastReset >= 1000) {
		metrics.count = 0;
		metrics.lastReset = now;
	}

	metrics.count++;

	if (metrics.count > performanceMetrics.maxEventsPerSecond) {
		return true; // Throttle this event
	}

	return false; // Allow this event
};

// Regular cleanup interval
setInterval(cleanupInactiveRooms, performanceMetrics.cleanupInterval);

// Socket.io connection handling
// Socket.io optimization settings
io.engine.pingInterval = 25000; // Increased ping interval
io.engine.pingTimeout = 60000; // Increased timeout
io.engine.maxHttpBufferSize = 1e8; // Increased buffer size for large messages

// Configure socket middleware for performance
io.use(async (socket, next) => {
	socket.setMaxListeners(20); // Increase max listeners
	next();
});

io.on("connection", (socket) => {
	// Set custom socket options for better performance
	socket.conn.on("packet", (packet) => {
		if (packet.type === "ping") socket.conn.packetsFn = []; // Clear packet buffer on ping
	});

	// Optimize room joining
	socket.on("joinRoom", async ({ roomId, userName, userId, password, hasLocalAuth }) => {
		try {
			// Batch database operations
			const [board, existingUsers] = await Promise.all([
				Board.findOne({ roomId }),
				Object.values(rooms[roomId]?.users || {})
			]);

			// Quick validation
			if (board?.isPasswordProtected && !hasLocalAuth) {
				if (!password || password !== board.password) {
					socket.emit("passwordRequired", { roomId });
					return;
				}
			}

			// Optimize room data structure
			if (!rooms[roomId]) {
				rooms[roomId] = {
					users: {},
					authorizedUsers: [],
					lastSync: Date.now()
				};
			}

			// Handle reconnection efficiently
			const existingSocketId = userId ? 
				Object.keys(rooms[roomId].users).find(id => 
					rooms[roomId].users[id].userId === userId
				) : null;

			if (existingSocketId && existingSocketId !== socket.id) {
				delete rooms[roomId].users[existingSocketId];
			}

			// Add user with optimized data structure
			rooms[roomId].users[socket.id] = {
				id: socket.id,
				userId: userId || socket.id,
				name: userName,
				color: getRandomColor(),
				initial: userName.charAt(0).toUpperCase(),
				lastActive: Date.now()
			};

			// Join room and set properties
			socket.join(roomId);
			socket.roomId = roomId;

			// Send initial room data efficiently
			const roomData = {
				users: Object.values(rooms[roomId].users),
				history: board?.history || [],
				lastSync: rooms[roomId].lastSync
			};

			socket.emit("roomData", roomData);
			socket.to(roomId).emit("userJoined", rooms[roomId].users[socket.id]);
			socket.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);

		} catch (error) {
			console.error("Error joining room:", error);
			socket.emit("error", { message: "Error joining room" });
		}
	});

	// Optimize drawing event handling
	socket.on("drawEvent", async (data) => {
		if (throttleEvents(socket, "drawEvent")) {
			socket.emit("throttleWarning", {
				message: "Drawing events are being throttled to maintain performance"
			});
			return;
		}

		const roomId = socket.roomId;
		if (!roomId) return;

		// Add timestamp and optimize data structure
		data.timestamp = data.timestamp || Date.now();
		data.senderId = socket.id;

		// Broadcast efficiently
		socket.to(roomId).emit("drawEvent", data);

		// Batch database updates
		try {
			await Board.updateOne(
				{ roomId },
				{
					$push: { 
						history: {
							$each: [data],
							$slice: -1000 // Keep last 1000 events
						}
					},
					$set: { 
						updatedAt: Date.now(),
						lastSync: Date.now()
					}
				}
			);

			// Update room's last sync time
			if (rooms[roomId]) {
				rooms[roomId].lastSync = Date.now();
			}
		} catch (error) {
			console.error("Error saving drawing event:", error);
		}
	});

	// Optimize board sync
	socket.on("requestBoardSync", async ({ roomId }) => {
		if (!roomId) return;

		try {
			const board = await Board.findOne({ roomId }).select({ 
				history: 1,
				lastSync: 1
			});

			if (board) {
				socket.emit("boardSync", {
					history: board.history,
					lastSync: board.lastSync
				});
			}
		} catch (error) {
			console.error("Error syncing board:", error);
		}
	});

	// Handle disconnection efficiently
	socket.on("disconnect", async () => {
		const roomId = socket.roomId;
		if (!roomId || !rooms[roomId]) return;

		const userInfo = rooms[roomId].users[socket.id];
		delete rooms[roomId].users[socket.id];

		if (userInfo) {
			io.to(roomId).emit("userLeft", {
				id: socket.id,
				name: userInfo.name
			});
			io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);
		}

		// Clean up empty rooms
		if (Object.keys(rooms[roomId].users).length === 0) {
			delete rooms[roomId];
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
			console.log("Test user created:", testEmail);
		}
	} catch (error) {
		console.error("Error creating test user:", error);
	}
};

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
