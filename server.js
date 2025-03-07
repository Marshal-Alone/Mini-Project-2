require("dotenv").config();
const express = require("express");
const path = require("path");
const User = require("./models/User");
const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => {
		console.log("Connected to MongoDB");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
	});

const app = express();

// Updated middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send("Something broke!");
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

// Catch-all route for undefined routes
app.use((req, res) => {
	res.status(404).sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
