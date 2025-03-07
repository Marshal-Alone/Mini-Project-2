require("dotenv").config();
const express = require("express");
const path = require("path");
const User = require("./models/User");
const Board = require("./models/Board");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const MonitoringService = require("./utils/monitoring");

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

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
	}

	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		if (err) {
			return res.status(403).json({ error: "Forbidden", message: "Invalid token" });
		}
		req.userId = decoded.id;
		next();
	});
};

// Health check endpoint
app.get("/health", async (req, res) => {
	try {
		const health = await MonitoringService.checkHealth();
		res.status(health.status === "healthy" ? 200 : 503).json(health);
	} catch (error) {
		console.error("Health check failed:", error);
		res.status(500).json({ status: "unhealthy", error: "Health check failed" });
	}
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

		// Create and assign a token
		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

		res.status(201).json({
			user: { id: user._id, name: user.fullName, email: user.email },
			token: token,
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
		if (!user) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Basic password check (replace with bcrypt for production)
		if (password !== user.password) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Create and assign a token
		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

		res.status(200).json({
			success: true,
			user: { id: user._id, name: user.fullName, email: user.email },
			token: token,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "Login failed" });
	}
});

// API route to get user info (protected)
app.get("/api/user", verifyToken, async (req, res) => {
	try {
		const user = await User.findById(req.userId);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		res.status(200).json({ user: { id: user._id, name: user.fullName, email: user.email } });
	} catch (error) {
		console.error("Get user error:", error);
		res.status(500).json({ error: "Failed to get user" });
	}
});

// API route to create a new board (protected)
app.post("/api/boards", verifyToken, async (req, res) => {
	try {
		const { name } = req.body;
		const userId = req.userId;

		const board = await Board.create({ name, owner: userId });

		res.status(201).json({
			roomId: board._id,
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

		const board = await Board.findOne({ code });

		if (!board) {
			return res.status(404).json({ error: "Board not found" });
		}

		res.status(200).json({
			roomId: board._id,
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
