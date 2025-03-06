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
const mongoose = require('mongoose');

// Connect to MongoDB
connectDB();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collaboard', {
	useNewUrlParser: true,
	useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB', err));

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

		console.log("\n=== Registration attempt ===");
		console.log("Email:", email);

		// Check if user already exists
		const existingUser = await User.findOne({ email });
		console.log("Existing user found:", existingUser ? "Yes" : "No");

		if (existingUser) {
			return res.status(400).json({ error: "User already exists" });
		}

		// Create new user (password will be hashed by the pre-save middleware)
		const user = await User.create({
			fullName,
			email,
			password, // Pass the plain password, let the model handle hashing
		});

		console.log("User created with ID:", user._id);
		console.log("Saved hash in database:", user.password);
		console.log("=== End Registration ===\n");

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

		console.log("\n=== Login attempt ===");
		console.log("Email:", email);
		
		// Get user
		const user = await User.findOne({ email });
		console.log("User found:", user ? "Yes" : "No");
		
		if (!user) {
			return res.status(400).json({ error: "Invalid email or password" });
		}

		console.log("User ID:", user._id);
		console.log("Input password:", password);
		console.log("Stored hash:", user.password);
		
		// Check password
		const validPassword = await bcrypt.compare(password, user.password);
		console.log("Password match result:", validPassword);
		console.log("=== End Login ===\n");
		
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

// Add this new route to find board by 6-digit code
app.get("/api/boards/code/:code", async (req, res) => {
	try {
		const { code } = req.params;
		
		// Get all boards (ideally you would have a more efficient lookup)
		const boards = await Board.find({});
		
		// Find the board with the matching code
		// We'll compute the 6-digit code for each board and check for a match
		for (const board of boards) {
			// Use the same algorithm as in board.js to generate the code
			let numericValue = 0;
			const roomId = board.roomId;
			
			for (let i = 0; i < roomId.length; i++) {
				numericValue += roomId.charCodeAt(i);
			}
			
			const boardCode = (numericValue % 900000 + 100000).toString();
			
			if (boardCode === code) {
				// Found the matching board
				return res.status(200).json({
					roomId: board.roomId,
					name: board.name
				});
			}
		}
		
		// If no board found with that code
		return res.status(404).json({ error: "Board not found" });
	} catch (error) {
		console.error("Error finding board by code:", error);
		res.status(500).json({ error: "Server error" });
	}
});

// Socket.io connection handling
io.on("connection", (socket) => {
	console.log("A user connected:", socket.id);

	// Join a room
	socket.on("joinRoom", async ({ roomId, userName, userId, password, hasLocalAuth }) => {
		console.log(`User ${userName} (${userId}) attempting to join room ${roomId}`);

		try {
			const boardForAuth = await Board.findOne({ roomId });
			
			if (boardForAuth && boardForAuth.isPasswordProtected) {
				const isOwner = userId && boardForAuth.createdBy === userId;
				const isAuthorized = rooms[roomId]?.authorizedUsers?.includes(userId || socket.id);

				if (!isOwner && !isAuthorized && !hasLocalAuth) {
					if (!password || password !== boardForAuth.password) {
						socket.emit('passwordRequired', { roomId });
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
					authorizedUsers: []
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
				console.log(`User ${userName} reconnected with new socket. Replacing old socket.`);
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
			let board = await Board.findOne({ roomId });
			
			if (!board) {
				board = new Board({
					roomId,
					name: roomId, // Default name is the roomId
					history: [],
					createdBy: userId || socketId
				});
				await board.save();
			}

			// Send board history from database to the new user
			socket.emit("roomData", {
				users: Object.values(rooms[roomId].users),
				history: board.history
			});

			// Notify all clients about the new user
			io.to(roomId).emit("userJoined", rooms[roomId].users[socketId]);
			io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);

			console.log(`User ${userName} joined room ${roomId}`);
		} catch (error) {
			console.error("Error joining room:", error);
			socket.emit('error', { message: 'Error joining room' });
		}
	});

	// Check password for a room
	socket.on('checkRoomPassword', async ({ roomId, password }) => {
		try {
			const board = await Board.findOne({ roomId });
			
			if (!board) {
				socket.emit('passwordCheckResult', { 
					success: false, 
					message: 'Room not found' 
				});
				return;
			}
			
			if (!board.isPasswordProtected) {
				socket.emit('passwordCheckResult', { 
					success: true, 
					message: 'No password required' 
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
				
				socket.emit('passwordCheckResult', { 
					success: true, 
					message: 'Password correct' 
				});
			} else {
				socket.emit('passwordCheckResult', { 
					success: false, 
					message: 'Incorrect password' 
				});
			}
		} catch (error) {
			console.error('Error checking room password:', error);
			socket.emit('passwordCheckResult', { 
				success: false, 
				message: 'Error checking password' 
			});
		}
	});
	
	// Set room password
	socket.on('setRoomPassword', async ({ roomId, password }) => {
		try {
			// Get board info
			const board = await Board.findOne({ roomId });
			
			if (!board) {
				socket.emit('error', { message: 'Board not found' });
				return;
			}
			
			// Update password
			board.isPasswordProtected = true;
			board.password = password;
			await board.save();
			
			// Notify other users in the room that the room now requires a password
			socket.to(roomId).emit('roomPasswordUpdated', true);
			
			console.log(`Password set for room: ${roomId}`);
		} catch (error) {
			console.error('Error setting room password:', error);
			socket.emit('error', { message: 'Error setting password' });
		}
	});
	
	// Remove room password
	socket.on('removeRoomPassword', async ({ roomId }) => {
		try {
			// Get board info
			const board = await Board.findOne({ roomId });
			
			if (!board) {
				socket.emit('error', { message: 'Board not found' });
				return;
			}
			
			// Remove password
			board.isPasswordProtected = false;
			board.password = '';
			await board.save();
			
			// Clear authorized users list
			if (rooms[roomId] && rooms[roomId].authorizedUsers) {
				rooms[roomId].authorizedUsers = [];
			}
			
			// Notify other users in the room
			socket.to(roomId).emit('roomPasswordUpdated', false);
			
			console.log(`Password removed for room: ${roomId}`);
		} catch (error) {
			console.error('Error removing room password:', error);
			socket.emit('error', { message: 'Error removing password' });
		}
	});

	// When a user is fully connected to a room
	socket.on("userReady", async ({ roomId }) => {
		try {
			// Get board info from database
			const boardInfo = await Board.findOne({ roomId });
			
			// Send password status
			if (boardInfo) {
				socket.emit('roomPasswordStatus', boardInfo.isPasswordProtected);
				
				// Send if user is owner
				const userId = rooms[roomId].users[socket.id].userId;
				const isOwner = userId && boardInfo.createdBy === userId;
				socket.emit('userRights', { isOwner });
			}
		} catch (error) {
			console.error("Error in userReady:", error);
		}
	});
	
	// Handle drawing events - moved out of userReady
	socket.on("drawEvent", async (data) => {
		const roomId = socket.roomId;

		// Broadcast to other users in the room
		socket.to(roomId).emit("drawEvent", data);

		// Save to database
		try {
			if (roomId) {
				await Board.updateOne(
					{ roomId },
					{ 
						$push: { history: data },
						$set: { updatedAt: Date.now() }
					}
				);
			}
		} catch (error) {
			console.error('Error saving drawing event:', error);
		}
	});

	// Handle clear canvas event - moved out of userReady
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
							updatedAt: Date.now()
						}
					}
				);
				console.log(`Board ${roomId} cleared by ${socket.id}`);
			} catch (error) {
				console.error('Error clearing board history:', error);
			}
		}
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);
		
		// Find which room this socket was in
		const roomId = socket.roomId;
		if (roomId && rooms[roomId] && rooms[roomId].users) {
			// Get user info before removing
			const userInfo = rooms[roomId].users[socket.id];
			
			// Remove user from room
			delete rooms[roomId].users[socket.id];
			
			// Notify other users with more information
			if (userInfo) {
				io.to(roomId).emit("userLeft", {
					id: socket.id,
					name: userInfo.name || "Unknown User"
				});
			} else {
				io.to(roomId).emit("userLeft", {
					id: socket.id,
					name: "Unknown User"
				});
			}
			
			io.to(roomId).emit("userCount", Object.keys(rooms[roomId].users).length);
			
			// If room is empty, clean up (but don't delete from DB)
			if (Object.keys(rooms[roomId].users).length === 0) {
				delete rooms[roomId];
				console.log(`Room ${roomId} is now empty and removed from memory`);
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
