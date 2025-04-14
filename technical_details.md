# Collaborative Whiteboard: Technical Details

This document provides an in-depth technical overview of the technologies used in our Collaborative Whiteboard application, explaining the purpose, benefits, and implementation details of each component in our technology stack.

## Frontend Technologies

### Vanilla JavaScript

**What is it?**  
Vanilla JavaScript refers to pure JavaScript without any additional libraries or frameworks. It's the native JavaScript language that runs directly in the browser.

**Why we chose it:**

1. **Performance**: Vanilla JS executes faster than framework-heavy alternatives as there's no additional abstraction layer
2. **Bundle size**: Smaller codebase resulting in faster page loads
3. **Direct DOM manipulation**: Complete control over browser interactions
4. **Learning curve**: Clear understanding of core language concepts without framework-specific patterns

**How we use it in our application:**

- Canvas manipulation for all drawing operations
- Event handling for user interactions (mouse events, touch events)
- DOM manipulation for UI updates
- Real-time data handling and synchronization
- Client-side validation and error handling

**Implementation example:**

```javascript
function draw(e) {
	if (!isDrawing) return;

	const rect = canvas.getBoundingClientRect();
	const currentX = e.clientX - rect.left;
	const currentY = e.clientY - rect.top;

	ctx.strokeStyle = currentColor;
	ctx.lineWidth = currentWidth;
	ctx.lineCap = "round";

	ctx.beginPath();
	ctx.moveTo(lastX, lastY);
	ctx.lineTo(currentX, currentY);
	ctx.stroke();

	lastX = currentX;
	lastY = currentY;
}
```

### HTML5 Canvas API

**What is it?**  
Canvas is an HTML element that provides a bitmap surface for drawing graphics via JavaScript. It's a low-level, pixel-based drawing API that allows for dynamic, scriptable rendering of 2D shapes and bitmap images.

**Why we chose it:**

1. **Performance**: Optimized for real-time drawing and rendering
2. **Browser support**: Well-supported across modern browsers
3. **Pixel-level control**: Direct manipulation of individual pixels
4. **Integration**: Seamless integration with JavaScript and mouse/touch events

**How we use it in our application:**

- Primary drawing surface for all tools (brush, eraser, shapes)
- Real-time rendering of collaborative actions
- State management (saving/loading canvas states)
- Image handling and rendering
- Background for interactive elements

**Implementation example:**

```javascript
// Initialize canvas
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to fit window
function resizeCanvas() {
	const container = document.querySelector(".board-container");
	canvas.width = container.offsetWidth;
	canvas.height = container.offsetHeight;

	// Redraw canvas after resize
	if (historyIndex >= 0) {
		ctx.drawImage(history[historyIndex], 0, 0);
	}
}
```

### Socket.IO Client

**What is it?**  
Socket.IO is a JavaScript library that enables real-time, bidirectional communication between web clients and servers. It primarily uses the WebSocket protocol but can fall back to other methods if WebSockets aren't available.

**Why we chose it:**

1. **Real-time capabilities**: Enables instant data transmission
2. **Reliability**: Automatic reconnection handling
3. **Fallback options**: Gracefully degrades to HTTP long-polling if WebSockets aren't available
4. **Room support**: Built-in concept of "rooms" for organizing connections
5. **Event-based API**: Clean, event-driven programming model

**How we use it in our application:**

- Broadcasting drawing events to all connected users
- User presence notifications
- Real-time synchronization of canvas state
- Room management for separate whiteboards
- Connection state management

**Implementation example:**

```javascript
// Emit drawing event to server
socket.emit("drawEvent", {
	tool: "brush",
	startX: lastX,
	startY: lastY,
	endX: currentX,
	endY: currentY,
	color: currentColor,
	width: currentWidth,
	points: window.brushPoints,
});

// Listen for drawing events from other users
socket.on("drawEvent", (data) => {
	processDrawEvent(data);
});
```

## Backend Technologies

### Node.js

**What is it?**  
Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine that allows developers to run JavaScript on the server side. It uses an event-driven, non-blocking I/O model that makes it lightweight and efficient.

**Architecture and Core Components:**

1. **V8 JavaScript Engine**:

   - Developed by Google for Chrome
   - Compiles JavaScript directly to native machine code
   - Implements ECMAScript and WebAssembly standards
   - Manages memory allocation and garbage collection

2. **Event Loop**:

   - Single-threaded architecture that handles asynchronous operations
   - Core mechanism that allows non-blocking I/O operations
   - Processes the event queue in a continuous loop:
     1. Executes synchronous code
     2. Processes timers (setTimeout, setInterval)
     3. Executes I/O callbacks
     4. Handles poll events
     5. Processes close callbacks

3. **libuv**:

   - Cross-platform C library that handles asynchronous I/O
   - Provides thread pool for file system operations
   - Manages event loop implementation
   - Handles network operations across operating systems

4. **Core Modules**:
   - Built-in libraries that provide essential functionality
   - Examples: fs (file system), http, crypto, path, os
   - No external dependencies required to use these modules
   - Optimized for performance and security

**Why we chose it:**

1. **JavaScript everywhere**: Same language on client and server
2. **Performance**: Event-driven architecture optimized for real-time applications
3. **NPM ecosystem**: Access to thousands of packages and libraries
4. **Scalability**: Excellent for handling many simultaneous connections
5. **Asynchronous I/O**: Non-blocking operations improve throughput

**How Node.js operates in our application:**

1. **Request Handling Flow**:

   - Client sends request to server
   - Node.js receives the request without blocking
   - Request is processed asynchronously
   - Response is sent when processing completes
   - Server continues processing other requests without waiting

2. **Memory Efficiency**:

   - Non-blocking I/O reduces memory overhead
   - Single thread serves multiple requests concurrently
   - Event-driven architecture minimizes idle resources
   - Callback pattern prevents memory-intensive thread spawning

3. **Concurrency Model**:
   - Uses event callbacks instead of threads
   - Handles thousands of concurrent connections with minimal resources
   - Prevents common threading issues like deadlocks
   - Worker threads available for CPU-intensive operations when needed

**How we use it in our application:**

- Server runtime environment
- Real-time event handling
- API endpoints processing
- Database operations
- WebSocket connections management
- Image data processing and optimization

**Implementation example:**

```javascript
// Server setup with Node.js
const http = require("http");
const express = require("express");
const socketIO = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
```

### Express.js

**What is it?**  
Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications. It simplifies the creation of APIs and web servers.

**Why we chose it:**

1. **Minimalist approach**: Lightweight framework with no unnecessary abstractions
2. **Performance**: High throughput and low overhead
3. **Middleware ecosystem**: Rich ecosystem of plugins
4. **Routing**: Powerful routing capabilities for API endpoints
5. **Integration**: Easily integrated with various template engines, databases, and other middleware

**How we use it in our application:**

- API routing for all HTTP endpoints
- Static file serving (HTML, CSS, client-side JS)
- Request parsing and validation
- Error handling
- Authentication middleware
- File upload handling

**Implementation example:**

```javascript
// API route for saving board state
app.post("/api/boards/:roomId/save", authenticate, async (req, res) => {
	try {
		const { roomId } = req.params;
		const { drawingData } = req.body;

		let board = await Board.findOne({ roomId });

		if (!board) {
			board = new Board({
				roomId,
				history: drawingData,
			});
		} else {
			board.history = drawingData;
		}

		await board.save();
		res.status(200).json({ message: "Board saved successfully" });
	} catch (error) {
		console.error("Error saving board:", error);
		res.status(500).json({ error: "Server error" });
	}
});
```

### MongoDB with Mongoose

**What is it?**  
MongoDB is a NoSQL document database that stores data in flexible, JSON-like documents. Mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js that provides a schema-based solution for modeling application data.

**Why we chose it:**

1. **Flexible schema**: Accommodates evolving data structures
2. **JSON-like documents**: Natural fit for JavaScript applications
3. **Scalability**: Horizontal scaling capabilities
4. **Performance**: Fast for document-based operations
5. **Schema validation**: Mongoose provides data validation and type casting

**How we use it in our application:**

- Storing user account information
- Persisting whiteboard content and drawing history
- Saving uploaded images and their metadata
- Managing room/session data
- Tracking user interactions and analytics

**Implementation example:**

```javascript
// Mongoose schema for board data
const mongoose = require("mongoose");

const boardSchema = new mongoose.Schema({
	roomId: {
		type: String,
		required: true,
		unique: true,
	},
	history: [Object],
	images: [
		{
			data: String,
			position: {
				x: Number,
				y: Number,
			},
			size: {
				width: Number,
				height: Number,
			},
			timestamp: Number,
		},
	],
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

boardSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

module.exports = mongoose.model("Board", boardSchema);
```

### JWT Authentication

**What is it?**  
JSON Web Token (JWT) is an open standard (RFC 7519) that defines a compact and self-contained way for securely transmitting information between parties as a JSON object. This information can be verified and trusted because it is digitally signed.

**Why we chose it:**

1. **Stateless authentication**: No need to store session data on server
2. **Scalability**: Works well with distributed systems
3. **Cross-domain compatibility**: Easily used across different domains
4. **Security**: Digitally signed tokens prevent tampering
5. **Flexibility**: Can include custom claims and metadata

**Understanding Password Salting and Hashing:**

Password security is a critical aspect of our authentication system. Here's a detailed explanation of how we protect user passwords:

1. **What is a Salt?**

   - A salt is a random string of data that is generated for each user
   - It's combined with the password before hashing
   - Each user has a unique salt, even if they have the same password
   - The salt is stored alongside the password hash in the database

2. **Why Use Salts?**

   - **Prevents Rainbow Table Attacks**: Rainbow tables are pre-computed tables for reversing cryptographic hash functions. Salts make these tables impractical because each password hash is unique.
   - **Prevents Hash Collision Attacks**: Two users with the same password will have different hashes due to different salts.
   - **Increases Complexity**: Adds significant complexity to brute force attacks as each password must be cracked individually.

3. **Bcrypt Salting Process**:

   - Bcrypt generates a random salt automatically when hashing a password
   - The salt is 16 bytes (128 bits) long in bcrypt
   - The salt is integrated with the resulting hash string in the format: `$2b$[cost]$[22-character-salt][31-character-hash]`
   - Example: `$2b$10$X8OOvhXF1bCkYeWKKry5RupyQhY0XqB2wzP9RqJx7dOLQOYx8oMlW`
     - `$2b$` - bcrypt algorithm identifier
     - `10$` - cost factor (number of rounds)
     - `X8OOvhXF1bCkYeWKKry5Ru` - salt (encoded in base64)
     - `pyQhY0XqB2wzP9RqJx7dOLQOYx8oMlW` - hash (encoded in base64)

4. **Salt vs. JWT Secret**:
   - **Salt**: Used in password hashing, unique for each user, stored with hash
   - **JWT Secret**: Server-side secret key used to sign tokens, not stored with token
   - They serve different security purposes but both prevent different types of attacks

**How JWT works in our application:**

1. **Login process**:

   - User provides credentials (username/password)
   - Server retrieves the stored hash+salt for the username
   - Password + stored salt are hashed using bcrypt's compare function
   - If hashes match, server creates JWT containing user ID and permissions
   - Token is signed with a secret key (JWT_SECRET)
   - Signed token is returned to client

2. **Password storage**:

   - Passwords are never stored in plain text
   - We use bcrypt hashing algorithm with cost factor 10-12 (2^10 to 2^12 iterations)
   - Each password has a unique salt to prevent rainbow table attacks
   - The resulting hash+salt combination is stored in the database

3. **Authentication flow**:

   - Client sends JWT with each request in Authorization header
   - Server verifies token signature using JWT_SECRET
   - If signature is valid, server extracts user information
   - If token is expired or invalid, authentication fails
   - Authorized requests proceed to protected resources

4. **Security measures**:
   - Short token expiration time (typically 1-24 hours)
   - HTTP-only cookies for token storage when possible
   - HTTPS required for all authentication traffic
   - Token blacklisting for logout functionality

**Implementation example:**

```javascript
// User authentication with JWT
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Login route
app.post("/api/login", async (req, res) => {
	try {
		const { username, password } = req.body;

		// Find user in database
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Compare password with stored hash
		// bcrypt automatically extracts the salt from the stored hash
		const passwordMatch = await bcrypt.compare(password, user.password);
		if (!passwordMatch) {
			return res.status(401).json({ message: "Invalid credentials" });
		}

		// Generate JWT token
		const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, {
			expiresIn: "24h",
		});

		// Send token to client
		res.status(200).json({
			message: "Authentication successful",
			token,
			userId: user._id,
			username: user.username,
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Server error" });
	}
});

// User registration with secure password handling
app.post("/api/register", async (req, res) => {
	try {
		const { username, password, email } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({ username });
		if (existingUser) {
			return res.status(400).json({ message: "Username already exists" });
		}

		// Generate salt and hash password
		// Bcrypt automatically generates a secure random salt
		const saltRounds = 10; // 2^10 iterations
		const hashedPassword = await bcrypt.hash(password, saltRounds);

		// Create new user with hashed password
		const user = new User({
			username,
			email,
			password: hashedPassword, // contains both hash and salt
		});

		await user.save();

		// Generate JWT token
		const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, {
			expiresIn: "24h",
		});

		res.status(201).json({
			message: "User created successfully",
			token,
			userId: user._id,
			username: user.username,
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ message: "Server error" });
	}
});
```

## Real-time Communication Architecture

### Event Broadcasting System

Our real-time communication architecture is built around an event broadcasting system that ensures all clients see the same content at nearly the same time:

1. **Event Capture**:

   - Client-side actions (drawing, erasing, image manipulation) are captured as events
   - Events include tool type, coordinates, color, line width, and other relevant parameters
   - Events are throttled to reduce network traffic (typically 30-60 events per second)

2. **Server Broadcast**:

   - Socket.IO server receives events from clients
   - Events are processed and validated
   - Server broadcasts events to all clients in the same room except the sender
   - Server stores events in MongoDB for persistence

3. **Client Rendering**:

   - Clients receive events via Socket.IO
   - Events are queued and processed sequentially to maintain visual consistency
   - Canvas is updated based on event data
   - Optimizations like request animation frame ensure smooth rendering

4. **State Synchronization**:
   - Periodically full board state is synchronized
   - New users joining receive complete board history
   - Reconnecting users receive missed events

**Implementation example:**

```javascript
// Server-side event handling
io.on("connection", (socket) => {
	// User joined room
	socket.on("joinRoom", async ({ roomId, userId, username }) => {
		socket.join(roomId);

		// Add user to room users list
		users[socket.id] = { id: userId, username, roomId };

		// Notify all users in room
		io.to(roomId).emit("userJoined", {
			userId,
			username,
			users: getUsersInRoom(roomId),
		});

		// Send board history to new user
		const board = await Board.findOne({ roomId });
		if (board) {
			socket.emit("roomData", {
				users: getUsersInRoom(roomId),
				history: board.history,
			});
		}
	});

	// Drawing event received
	socket.on("drawEvent", (data) => {
		const user = users[socket.id];
		if (user && user.roomId) {
			// Broadcast to all other users in room
			socket.to(user.roomId).emit("drawEvent", data);

			// Store in memory buffer for persistence
			if (!drawingBuffer[user.roomId]) {
				drawingBuffer[user.roomId] = [];
			}
			drawingBuffer[user.roomId].push(data);

			// Save buffer to database periodically
			scheduleBufferSave(user.roomId);
		}
	});
});
```

## Performance Optimizations

Our application implements several key performance optimizations to ensure smooth user experience even with complex drawings and multiple concurrent users:

1. **Request Animation Frame**:

   - Drawing operations are scheduled using requestAnimationFrame
   - This ensures smooth rendering aligned with browser's refresh rate
   - Reduces CPU usage and improves battery life on mobile devices

2. **Event Throttling**:

   - Drawing events are throttled to limit network traffic
   - Configurable rate (typically 16-30ms intervals)
   - Reduces server load and bandwidth usage

3. **Canvas Buffering**:

   - Complex operations use off-screen canvases for rendering
   - Results are copied to main canvas once complete
   - Reduces visual artifacts and flickering

4. **Batch Processing**:

   - Drawing events are processed in batches
   - Reduces DOM reflows and improves rendering performance

5. **Image Optimization**:

   - Uploaded images are resized and compressed before storage
   - Base64 encoding used for direct canvas integration
   - Lazy loading for images to improve initial load time

6. **Selective Redrawing**:
   - Only affected areas are redrawn when possible
   - Full canvas redraw is minimized to improve performance

**Implementation example:**

```javascript
// Optimize drawing with requestAnimationFrame
let drawAnimationFrame = null;
let lastDrawEvent = null;

function scheduleDraw(e) {
	if (!isDrawing) return;

	lastDrawEvent = e;

	// If we already have a drawing frame scheduled, don't schedule another
	if (drawAnimationFrame) return;

	// Schedule drawing on next animation frame for smoother performance
	drawAnimationFrame = requestAnimationFrame(() => {
		if (lastDrawEvent) {
			draw(lastDrawEvent);
			lastDrawEvent = null;
		}
		drawAnimationFrame = null;
	});
}
```

## Security Measures

### Password Security

Our application implements industry-standard security practices for handling user credentials:

1. **Hashing Process**:

   - Passwords are never stored in plain text
   - Bcrypt hashing algorithm with high cost factor (10-12 rounds)
   - Each password has a unique salt to prevent rainbow table attacks
   - The resulting hash + salt is stored in the database

2. **Authentication Process**:

   - User submits password
   - System retrieves stored hash for username
   - Bcrypt compares password against stored hash
   - Comparison happens in constant time to prevent timing attacks
   - No original password is ever reconstructed or compared directly

3. **JWT Generation**:

   - After successful authentication, JWT is created
   - Token contains user ID and permissions but NOT password
   - Token is signed with server's secret key
   - Token has expiration date to limit window of potential misuse

4. **Additional Protections**:
   - Rate limiting to prevent brute force attacks
   - Account lockout after multiple failed attempts
   - Password complexity requirements
   - HTTPS for all communication
   - Secure HTTP-only cookies for token storage when possible

**Implementation example:**

```javascript
// User registration with secure password handling
app.post("/api/register", async (req, res) => {
	try {
		const { username, password, email } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({ username });
		if (existingUser) {
			return res.status(400).json({ message: "Username already exists" });
		}

		// Hash password with bcrypt (10 rounds of salting)
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Create new user with hashed password
		const user = new User({
			username,
			email,
			password: hashedPassword,
		});

		await user.save();

		// Generate JWT token
		const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, {
			expiresIn: "24h",
		});

		res.status(201).json({
			message: "User created successfully",
			token,
			userId: user._id,
			username: user.username,
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ message: "Server error" });
	}
});
```

## Scalability Considerations

Our application architecture is designed with scalability in mind to accommodate growing user bases and increasing demand:

1. **Stateless Authentication**:

   - JWT-based authentication doesn't require server-side session storage
   - Enables horizontal scaling across multiple servers
   - Reduces database load for session management

2. **Microservice Potential**:

   - Core components (authentication, drawing, image handling) can be separated
   - Independent scaling based on specific resource needs
   - Improved resilience through service isolation

3. **Database Scaling**:

   - MongoDB supports horizontal scaling through sharding
   - Indexes optimized for common query patterns
   - Caching layer can be added for frequently accessed data

4. **WebSocket Management**:

   - Socket.IO supports Redis adapter for multi-server deployments
   - Enables scaling WebSocket connections across multiple nodes
   - Maintains room integrity across distributed systems

5. **Content Delivery**:

   - Static assets can be served through CDN
   - Reduces main server load
   - Improves global performance

6. **Container Deployment**:
   - Application components containerized for easy deployment
   - Kubernetes orchestration for automatic scaling
   - Resource isolation and management

These technical details illustrate the comprehensive architecture and design decisions behind our Collaborative Whiteboard application, ensuring a secure, performant, and scalable real-time collaboration platform.
