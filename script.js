document.addEventListener("DOMContentLoaded", function () {
	// Check if user is logged in
	const checkAuth = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) return null;

			const response = await fetch("/api/user", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				return data.user;
			}
			return null;
		} catch (error) {
			console.error("Auth check error:", error);
			return null;
		}
	};

	// Update UI based on auth status
	const updateAuthUI = (user) => {
		const authLinks = document.querySelector(".nav-links");
		const userNameDisplay = document.getElementById("userNameDisplay");
		const welcomeMessage = document.querySelector(".welcome-message");

		if (welcomeMessage) {
			welcomeMessage.style.display = user ? "block" : "none";
		}

		if (userNameDisplay) {
			userNameDisplay.textContent = user ? user.name : "Guest";
		}

		if (authLinks) {
			if (user) {
				authLinks.innerHTML = `
                    <a href="#features">Features</a>
                    <a href="#pricing">Pricing</a>
                    <a href="#about">About</a>
                    <span style="font-size: 1.2rem; font-weight: bold;" class="user-greeting" title="Logged in as ${
											user.email || ""
										}">
                        ${user.name}
                    </span>
                    <button id="logoutBtn" class="btn btn-outline">Log out</button>
                `;

				// Add logout handler
				document.getElementById("logoutBtn").addEventListener("click", async () => {
					try {
						await fetch("/api/logout", { method: "POST" });
						localStorage.removeItem("token");
						localStorage.removeItem("user");
						window.location.href = "/";
					} catch (error) {
						console.error("Logout error:", error);
					}
				});
			} else {
				authLinks.innerHTML = `
                    <a href="#features">Features</a>
                    <a href="#pricing">Pricing</a>
                    <a href="#about">About</a>
                    <a href="auth.html?tab=login" class="btn btn-outline">Log in</a>
                    <a href="auth.html?tab=register" class="btn btn-primary">Sign up</a>
                `;
			}
		}
	};

	// Generate random room name
	const generateRandomName = () => {
		const adjectives = [
			"Amazing",
			"Brilliant",
			"Creative",
			"Dynamic",
			"Energetic",
			"Fantastic",
			"Gorgeous",
			"Happy",
		];
		const nouns = [
			"Board",
			"Canvas",
			"Drawing",
			"Idea",
			"Project",
			"Session",
			"Space",
			"Whiteboard",
		];
		const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
		const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
		const randomNumber = Math.floor(Math.random() * 1000);
		return `${randomAdjective}${randomNoun}${randomNumber}`;
	};

	// Handle room creation
	const roomNameInput = document.getElementById("roomName");
	const startBoardingButton = document.getElementById("startBoarding");

	if (roomNameInput && startBoardingButton) {
		// Set initial placeholder
		roomNameInput.placeholder = "Enter your room name...";

		// Change placeholder to random name after 3 seconds
		setTimeout(() => {
			const updatePlaceholder = () => {
				roomNameInput.placeholder = `e.g. ${generateRandomName()}`;
			};

			updatePlaceholder(); // Initial update
			const intervalId = setInterval(updatePlaceholder, 3000); // Update every 3 seconds

			// Clear interval when the user starts typing
			roomNameInput.addEventListener("input", () => {
				clearInterval(intervalId);
				roomNameInput.placeholder = ""; // Clear placeholder when typing
			});
		}, 3000); // Start changing after 3 seconds

		startBoardingButton.addEventListener("click", async () => {
			let roomName = roomNameInput.value.trim();

			// If no room name is provided, generate a random one
			if (!roomName) {
				roomName = roomNameInput.placeholder.replace("e.g. ", "");
			}

			// Check if the entered name is a 6-digit code
			const isBoardCode = /^\d{6}$/.test(roomName);

			// If it's a board code, try to find the corresponding board
			if (isBoardCode) {
				try {
					// Show a loading indicator or message
					startBoardingButton.disabled = true;
					startBoardingButton.textContent = "Looking for board...";
					
					const response = await fetch(`/api/boards/code/${roomName}`);
					
					// Reset button state
					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";
					
					if (response.ok) {
						const data = await response.json();
						// Redirect to the found board
						window.location.href = `/board?room=${encodeURIComponent(
							data.roomId
						)}&name=${encodeURIComponent(data.name)}`;
						return;
					} else {
						// If server responds but board not found
						alert(`Board with code ${roomName} not found. Creating a new board instead.`);
					}
				} catch (error) {
					console.log("Error finding board by code:", error);
					alert("Error connecting to server. Please try again.");
					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";
					return;
				}
			}

			// Check if user is authenticated
			const user = await checkAuth();
			if (user) {
				// Create board in database if logged in
				try {
					startBoardingButton.disabled = true;
					startBoardingButton.textContent = "Creating board...";
					
					const response = await fetch("/api/boards", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						},
						body: JSON.stringify({ name: roomName }),
					});

					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";

					if (response.ok) {
						const data = await response.json();
						window.location.href = `/board?room=${encodeURIComponent(
							data.roomId
						)}&name=${encodeURIComponent(roomName)}`;
					} else {
						alert("Failed to create board. Please try again.");
					}
				} catch (error) {
					console.error("Board creation error:", error);
					alert("Failed to create board. Please try again.");
					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";
				}
			} else {
				// Just redirect to a new room if not logged in
				const roomId = Math.random().toString(36).substring(2, 15);
				window.location.href = `/board?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(
					roomName
				)}`;
			}
		});
	}

	// Handle login form submission
	const loginForm = document.getElementById("loginForm");
	if (loginForm) {
		loginForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			const email = document.getElementById("login-email").value;
			const password = document.getElementById("l-password").value;

			try {
				const response = await fetch("/api/login", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, password }),
				});

				const data = await response.json();

				if (response.ok) {
					localStorage.setItem("token", data.token);
					localStorage.setItem("user", JSON.stringify(data.user));
					window.location.href = "/";
				} else {
					// Handle 400 Bad Request and other errors
					const errorDiv = document.getElementById("loginError");
					if (errorDiv) {
						errorDiv.textContent = data.message || data.error || "Invalid email or password";
						errorDiv.classList.add("visible");
						setTimeout(() => {
							errorDiv.classList.remove("visible");
						}, 5000);
					}
				}
			} catch (error) {
				console.error("Login error:", error);
				const errorDiv = document.getElementById("loginError");
				if (errorDiv) {
					errorDiv.textContent = "Login failed. Please check your credentials and try again.";
					errorDiv.classList.add("visible");
					setTimeout(() => {
						errorDiv.classList.remove("visible");
					}, 5000);
				}
			}
		});
	}

	// Handle registration form submission
	const registerForm = document.getElementById("registerForm");
	if (registerForm) {
		registerForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fullName = document.getElementById("fullName")?.value;
			const email = document.getElementById("register-email")?.value;
			const password = document.getElementById("password")?.value;

			// Simple validation
			if (!fullName || !email || !password) {
				alert("Please fill out all fields");
				return;
			}

			if (password.length < 8) {
				alert("Password must be at least 8 characters long!");
				return;
			}

			try {
				const response = await fetch("/api/register", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ fullName, email, password }),
				});

				const data = await response.json();

				if (response.ok) {
					localStorage.setItem("token", data.token);
					localStorage.setItem("user", JSON.stringify(data.user));
					window.location.href = "/";
				} else {
					alert(data.error || "Registration failed. Please try again.");
				}
			} catch (error) {
				console.error("Registration error:", error);
				alert("Registration failed. Please try again.");
			}
		});
	}

	// Check auth on page load
	checkAuth().then((user) => {
		if (user) {
			localStorage.setItem("user", JSON.stringify(user));
		}
		updateAuthUI(user);
	});
});
