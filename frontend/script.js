import config from "./config.js";

document.addEventListener("DOMContentLoaded", function () {
	// Function to load past boards
	const loadPastBoards = async () => {
		const pastBoardsList = document.getElementById("pastBoardsList");
		const noBoards = document.getElementById("noBoards");

		if (!pastBoardsList) return;

		try {
			const token = localStorage.getItem("token");
			if (!token) {
				if (noBoards) noBoards.style.display = "block";
				return;
			}

			// Show loading state
			pastBoardsList.innerHTML = '<div class="loading">Loading your boards...</div>';

			const response = await fetch(`${config.API_URL}/api/boards`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				const boards = data.boards;

				// Clear loading message
				pastBoardsList.innerHTML = "";

				if (boards.length === 0) {
					// Show "no boards" message if no boards exist
					if (noBoards) noBoards.style.display = "block";
				} else {
					// Hide "no boards" message
					if (noBoards) noBoards.style.display = "none";

					// Display each board
					boards.forEach((board) => {
						const boardCard = createBoardCard(board);
						pastBoardsList.appendChild(boardCard);
					});
				}
			} else {
				console.error("Failed to load boards");
				pastBoardsList.innerHTML =
					'<div class="error">Failed to load your boards. Please try again.</div>';
			}
		} catch (error) {
			console.error("Error loading boards:", error);
			pastBoardsList.innerHTML =
				'<div class="error">Error loading your boards. Please refresh the page.</div>';
		}
	};

	// Create board card element
	const createBoardCard = (board) => {
		const card = document.createElement("div");
		card.className = "board-card";

		// Format date
		const createdDate = new Date(board.createdAt);
		const formattedDate = createdDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});

		card.innerHTML = `
			<div class="board-card-header">
				<h3>${board.name}</h3>
			</div>
			<div class="board-card-date">
				Created: ${formattedDate}
			</div>
			<div class="board-card-actions">
				<button class="btn btn-primary join-board" data-room-id="${board.roomId}" data-name="${board.name}">
					<i class="fas fa-sign-in-alt"></i> Join
				</button>
				<button class="btn board-delete" data-room-id="${board.roomId}">
					<i class="fas fa-trash"></i> Delete
				</button>
			</div>
		`;

		// Add event listeners to buttons
		card.querySelector(".join-board").addEventListener("click", (e) => {
			const roomId = e.currentTarget.getAttribute("data-room-id");
			const name = e.currentTarget.getAttribute("data-name");
			window.location.href = `/board?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(
				name
			)}`;
		});

		card.querySelector(".board-delete").addEventListener("click", async (e) => {
			const roomId = e.currentTarget.getAttribute("data-room-id");
			if (confirm("Are you sure you want to delete this board? This action cannot be undone.")) {
				await deleteBoard(roomId, card);
			}
		});

		return card;
	};

	// Delete board function
	const deleteBoard = async (roomId, cardElement) => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(`${config.API_URL}/api/boards/${roomId}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				// Remove card from UI with animation
				cardElement.style.opacity = "0";
				cardElement.style.transform = "scale(0.8)";
				setTimeout(() => {
					cardElement.remove();

					// Check if there are no more boards
					const pastBoardsList = document.getElementById("pastBoardsList");
					if (pastBoardsList && pastBoardsList.children.length === 0) {
						const noBoards = document.getElementById("noBoards");
						if (noBoards) noBoards.style.display = "block";
					}
				}, 300);
			} else {
				alert("Failed to delete board. Please try again.");
			}
		} catch (error) {
			console.error("Error deleting board:", error);
			alert("An error occurred while trying to delete the board.");
		}
	};

	// Initialize past boards section
	const initializePastBoards = async () => {
		const pastBoardsSection = document.getElementById("pastBoards");
		const loginPrompt = document.getElementById("loginPrompt");
		const boardsList = document.getElementById("pastBoardsList");
		const noBoards = document.getElementById("noBoards");

		if (pastBoardsSection) {
			const user = await checkAuth();

			if (user) {
				// User is logged in - initially hide the section and check for boards
				if (loginPrompt) loginPrompt.style.display = "none";
				if (boardsList) boardsList.style.display = "grid";

				try {
					const token = localStorage.getItem("token");
					const response = await fetch(`${config.API_URL}/api/boards`, {
						headers: {
							Authorization: `Bearer ${token}`,
						},
					});

					if (response.ok) {
						const data = await response.json();
						const boards = data.boards;

						if (boards.length === 0) {
							// User has no boards, hide the entire section
							pastBoardsSection.style.display = "none";
						} else {
							// User has boards, show the section and load boards
							pastBoardsSection.style.display = "block";
							await loadPastBoards();
						}
					} else {
						console.error("Failed to check boards");
						pastBoardsSection.style.display = "none";
					}
				} catch (error) {
					console.error("Error checking boards:", error);
					pastBoardsSection.style.display = "none";
				}
			} else {
				// User is not logged in - show login prompt and hide boards
				pastBoardsSection.style.display = "block";
				if (loginPrompt) loginPrompt.style.display = "block";
				if (boardsList) boardsList.style.display = "none";
			}
		}
	};

	// Check if user is logged in
	const checkAuth = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) return null;

			const response = await fetch(`${config.API_URL}/api/user`, {
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
		const adjectives = ["Marshal's ", "Vaishnavi's ", "Mrunali's ", "Sanskruti's ", "Aditya's "];
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
					console.log(`Attempting to find board with code: ${roomName}`);

					const response = await fetch(`${config.API_URL}/api/boards/code/${roomName}`);

					// Reset button state
					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";

					if (response.ok) {
						const data = await response.json();
						console.log(`Board found with roomId: ${data.roomId}`);
						// Redirect to the found board
						window.location.href = `/board?room=${encodeURIComponent(
							data.roomId
						)}&name=${encodeURIComponent(data.name)}`;
						return;
					} else {
						// If server responds but board not found, show error and STOP
						const data = await response.json();
						console.error(`Error: ${data.error}`);
						alert(
							`Board with code ${roomName} was not found. Please try a different code or enter a name for a new board.`
						);
						return; // Stop execution here - don't create a new board
					}
				} catch (error) {
					console.error("Error finding board by code:", error);
					alert("Error connecting to server. Please try again.");
					startBoardingButton.disabled = false;
					startBoardingButton.textContent = "Start";
					return;
				}
			}

			// Only reach here if it's NOT a 6-digit code
			console.log("Creating a new board with name:", roomName);

			// Check if user is authenticated
			const user = await checkAuth();
			if (user) {
				// Create board in database if logged in
				try {
					startBoardingButton.disabled = true;
					startBoardingButton.textContent = "Creating board...";

					const response = await fetch(`${config.API_URL}/api/boards`, {
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
				const response = await fetch(`${config.API_URL}/api/login`, {
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

			// Get error message element
			const errorMessage = document.querySelector(".error-message");

			// Simple validation with modern error display
			if (!fullName || !email || !password) {
				errorMessage.textContent = "Please fill out all fields";
				errorMessage.classList.add("visible");
				return;
			}

			if (password.length < 8) {
				errorMessage.textContent = "Password must be at least 8 characters long!";
				errorMessage.classList.add("visible");

				// Highlight the password field as an error
				const passwordField = document.getElementById("password");
				passwordField.classList.add("error-field");

				// Focus on the password field
				passwordField.focus();
				return;
			}

			try {
				const response = await fetch(`${config.API_URL}/api/register`, {
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
					errorMessage.textContent =
						data.error ||
						"This email is already registered. Please use a different email or login instead.";
					errorMessage.classList.add("visible");

					// Highlight the email field as an error
					const emailField = document.getElementById("register-email");
					emailField.classList.add("error-field");

					// Focus on the email field for better UX
					emailField.focus();
				}
			} catch (error) {
				console.error("Registration error:", error);
				errorMessage.textContent = "Registration failed. Please try again.";
				errorMessage.classList.add("visible");
			}
		});
	}

	// Initialize past boards on page load
	initializePastBoards();

	// Check and update auth status on page load
	checkAuth().then(updateAuthUI);
});
