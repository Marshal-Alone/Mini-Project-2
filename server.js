require("dotenv").config();
const express = require("express");
const path = require("path");
const User = require("./models/User");
const mongoose = require("mongoose");

// Server timeout
const SERVER_TIMEOUT = 30000; // 30 seconds

// Connect to MongoDB with timeout
mongoose
	.connect(process.env.MONGODB_URI, {
		serverSelectionTimeoutMS: 5000,
		socketTimeoutMS: 45000,
	})
	.then(() => {
		console.log("Connected to MongoDB");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
		process.exit(1); // Exit if we can't connect to database
	});

const app = express();

// Add request timeout middleware
app.use((req, res, next) => {
	res.setTimeout(SERVER_TIMEOUT, () => {
		res.status(503).json({
			error: "Request timeout",
			requestId: req.id || "unknown",
		});
	});
	next();
});

// Updated middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get("/health", (req, res) => {
	const dbStatus = mongoose.connection.readyState === 1;
	res.status(dbStatus ? 200 : 503).json({
		status: dbStatus ? "healthy" : "unhealthy",
		timestamp: new Date().toISOString(),
		database: dbStatus ? "connected" : "disconnected",
	});
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
	console.error("Error occurred:", err);

	// Generate unique request ID if not exists
	const requestId = req.id || Math.random().toString(36).substring(7);

	// Handle different types of errors
	if (err instanceof mongoose.Error) {
		return res.status(503).json({
			error: "Database error",
			message: "Service temporarily unavailable",
			requestId,
		});
	}

	if (err.type === "entity.parse.failed") {
		return res.status(400).json({
			error: "Invalid request format",
			message: "Could not parse request data",
			requestId,
		});
	}

	// Default error response
	res.status(err.status || 500).json({
		error: "Internal server error",
		message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
		requestId,
	});
});

// Basic routes with proper error handling
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/board", (req, res) => {
	// Use relative path instead of hardcoded URL
	res.redirect("/board.html?room=default&name=MyRoom");
});

app.get("/login", (req, res) => {
	res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/register", (req, res) => {
	res.sendFile(path.join(__dirname, "register.html"));
});

// Auth routes with proper error handling
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
		console.error("Registration error:", error);
		res.status(500).json({ error: "Registration failed" });
	}
});

app.post("/api/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: "Email and password are required" });
		}
		const user = await User.findOne({ email });
		if (!user || password !== user.password) {
			return res.status(401).json({ error: "Invalid credentials" });
		}
		res.status(200).json({
			success: true,
			user: { id: user._id, name: user.fullName, email: user.email },
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "Login failed" });
	}
});

// API route to get user info
app.get("/api/user", async (req, res) => {
	try {
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// Verify token (replace 'your-jwt-secret-key' with your actual secret)
		// const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Fetch user from database (replace User.findById with your actual method)
		// const user = await User.findById(decoded.userId);

		// Mock user data for now
		const user = {
			id: "someUserId",
			name: "Vaishnavi",
			email: "test@example.com",
		};

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		res.status(200).json({ user });
	} catch (error) {
		console.error("Get user error:", error);
		res.status(500).json({ error: "Failed to get user" });
	}
});

// API route to create a new board
app.post("/api/boards", async (req, res) => {
	try {
		const { name } = req.body;
		// const userId = req.user.id; // Assuming you have middleware to authenticate user

		// Mock user ID for now
		const userId = "someUserId";

		// Create board in database (replace Board.create with your actual method)
		// const board = await Board.create({ name, owner: userId });

		// Mock board data for now
		const board = {
			id: "someBoardId",
			name: name,
			owner: userId,
		};

		res.status(201).json({
			roomId: board.id,
			name: board.name,
		});
	} catch (error) {
		console.error("Board creation error:", error);
		res.status(500).json({ error: "Failed to create board" });
	}
});

// API route to find a board by code
app.get("/api/boards/code/:code", async (req, res) => {
	try {
		const { code } = req.params;

		// Find board in database (replace Board.findOne with your actual method)
		// const board = await Board.findOne({ code });

		// Mock board data for now
		const board = {
			id: "someBoardId",
			name: "Sample Board",
		};

		if (!board) {
			return res.status(404).json({ error: "Board not found" });
		}

		res.status(200).json({
			roomId: board.id,
			name: board.name,
		});
	} catch (error) {
		console.error("Find board by code error:", error);
		res.status(500).json({ error: "Failed to find board" });
	}
});

// Enhance catch-all route with better error info
app.use((req, res) => {
	res.status(404).json({
		error: "Not Found",
		message: `Route ${req.originalUrl} not found`,
		requestId: req.id || Math.random().toString(36).substring(7),
	});
});

const PORT = process.env.PORT || 5050;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Add proper server shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully");
	server.close(() => {
		console.log("Server closed");
		mongoose.connection.close(false, () => {
			console.log("MongoDB connection closed");
			process.exit(0);
		});
	});
});

process.on("uncaughtException", (err) => {
	console.error("Uncaught exception:", err);
	server.close(() => {
		process.exit(1);
	});
});
