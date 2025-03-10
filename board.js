document.addEventListener("DOMContentLoaded", function () {
	// Socket.io setup
	const socket = io();
	let currentUserId = null;

	// Get URL parameters
	const urlParams = new URLSearchParams(window.location.search);
	const roomId = urlParams.get("room") || "Untitled Board";
	const roomName = urlParams.get("name") || "Untitled Board";

	// Set room name in the UI
	// document.getElementById('roomName').textContent = roomName;  change

	// Set the title of the page
	document.title = `Marshal's - Collaboard`;

	// Canvas setup
	const canvas = document.getElementById("whiteboard");
	const ctx = canvas.getContext("2d");
	let isDrawing = false;
	let lastX = 0;
	let lastY = 0;

	// Drawing settings
	let currentTool = "brush";
	let currentColor = "#000000";
	let currentWidth = 5; // Default brush size

	// History for undo/redo
	const history = [];
	let historyIndex = -1;

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

	// Initialize canvas size
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);

	// Save current state to history
	function saveState() {
		// Remove any states after current index if we've gone back in history
		if (historyIndex < history.length - 1) {
			history.splice(historyIndex + 1);
		}

		// Create a new image from the canvas
		const newState = new Image();
		newState.src = canvas.toDataURL();

		// Add to history once image is loaded
		newState.onload = function () {
			history.push(newState);
			historyIndex++;

			// Enable/disable undo/redo buttons
			document.getElementById("undoBtn").disabled = historyIndex <= 0;
			document.getElementById("redoBtn").disabled = historyIndex >= history.length - 1;
		};
	}

	// Save initial blank state
	saveState();

	// Add event listener for brush size selection
	const brushSizeSelect = document.getElementById("brushSize");
	brushSizeSelect.addEventListener("change", (e) => {
		currentWidth = parseInt(e.target.value);
	});

	// Drawing functions
	function startDrawing(e) {
		// isDrawing = true; change
		isDrawing = false;

		// Get mouse position relative to canvas
		const rect = canvas.getBoundingClientRect();
		lastX = e.clientX - rect.left;
		lastY = e.clientY - rect.top;

		// For shapes, we'll start a new path
		if (currentTool !== "brush" && currentTool !== "pencil") {
			ctx.beginPath();
			ctx.moveTo(lastX, lastY);
		}
	}

	function draw(e) {
		if (!isDrawing) return;

		// Get current mouse position
		const rect = canvas.getBoundingClientRect();
		const currentX = e.clientX - rect.left;
		const currentY = e.clientY - rect.top;

		// Set drawing styles
		ctx.lineWidth = currentWidth; // Use the selected brush size
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Draw based on selected tool
		switch (currentTool) {
			case "brush":
				ctx.strokeStyle = currentColor;
				ctx.globalAlpha = brushOpacitySlider.value / 100; // Use the selected opacity
				ctx.beginPath();
				ctx.moveTo(lastX, lastY);
				ctx.lineTo(currentX, currentY);
				ctx.stroke();

				// Emit draw event to server
				socket.emit("drawEvent", {
					tool: "brush",
					startX: lastX,
					startY: lastY,
					endX: currentX,
					endY: currentY,
					color: currentColor,
					width: currentWidth,
					opacity: ctx.globalAlpha, // Send opacity
				});
				break;

			case "eraser":
				// Set composite operation to destination-out for erasing
				ctx.globalCompositeOperation = "destination-out";
				ctx.beginPath();
				ctx.arc(currentX, currentY, parseInt(eraserSizeSelect.value) / 2, 0, Math.PI * 2, false);
				ctx.fill();

				// Emit erase event to server
				socket.emit("drawEvent", {
					tool: "eraser",
					startX: currentX,
					startY: currentY,
					width: parseInt(eraserSizeSelect.value), // Send eraser size
				});
				break;

			case "line":
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				if (historyIndex >= 0) {
					ctx.drawImage(history[historyIndex], 0, 0);
				}
				ctx.beginPath();
				ctx.moveTo(lastX, lastY);
				ctx.lineTo(currentX, currentY);
				ctx.stroke();
				break;

			case "rectangle":
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				if (historyIndex >= 0) {
					ctx.drawImage(history[historyIndex], 0, 0);
				}
				ctx.beginPath();
				const width = currentX - lastX;
				const height = currentY - lastY;
				ctx.rect(lastX, lastY, width, height);
				ctx.stroke();
				break;

			case "circle":
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				if (historyIndex >= 0) {
					ctx.drawImage(history[historyIndex], 0, 0);
				}
				ctx.beginPath();
				const radius = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
				ctx.arc(lastX, lastY, radius, 0, Math.PI * 2);
				ctx.stroke();
				break;

			case "text":
				// Handle text drawing logic here
				break;
		}

		// Update last position for brush and eraser tools
		if (currentTool === "brush" || currentTool === "eraser") {
			lastX = currentX;
			lastY = currentY;
		}

		// After drawing or erasing
		ctx.globalCompositeOperation = "source-over"; // Reset to default
	}

	function stopDrawing(event) {
		if (!isDrawing) return;
		isDrawing = false;

		// Get current mouse position
		const rect = canvas.getBoundingClientRect();
		const currentX = event.clientX - rect.left;
		const currentY = event.clientY - rect.top;

		// Emit shape drawing events
		if (currentTool !== "brush" && currentTool !== "pencil") {
			switch (currentTool) {
				case "line":
					socket.emit("drawEvent", {
						tool: "line",
						startX: lastX,
						startY: lastY,
						endX: currentX,
						endY: currentY,
						color: currentColor,
						width: currentWidth,
					});
					break;

				case "rectangle":
					socket.emit("drawEvent", {
						tool: "rectangle",
						startX: lastX,
						startY: lastY,
						width: currentX - lastX,
						height: currentY - lastY,
						color: currentColor,
						lineWidth: currentWidth,
					});
					break;

				case "circle":
					const radius = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
					socket.emit("drawEvent", {
						tool: "circle",
						centerX: lastX,
						centerY: lastY,
						radius: radius,
						color: currentColor,
						lineWidth: currentWidth,
					});
					break;
			}
		}

		// Save the current state for undo/redo
		saveState();

		// If text tool is selected, prompt for text input
		if (currentTool === "text") {
			const text = prompt("Enter text:");
			if (text) {
				ctx.font = `${currentWidth * 3}px Arial`;
				ctx.fillStyle = currentColor;
				ctx.fillText(text, lastX, lastY);

				// Emit text event
				socket.emit("drawEvent", {
					tool: "text",
					x: lastX,
					y: lastY,
					text: text,
					color: currentColor,
					fontSize: currentWidth * 3,
				});

				saveState();
			}
		}
	}

	// Handle received drawing events
	socket.on("drawEvent", (data) => {
		ctx.lineWidth = data.width; // Set line width

		switch (data.tool) {
			case "brush":
				ctx.strokeStyle = data.color;
				ctx.globalAlpha = data.opacity; // Set opacity from the event
				ctx.beginPath();
				ctx.moveTo(data.startX, data.startY);
				ctx.lineTo(data.endX, data.endY);
				ctx.stroke();
				break;

			case "eraser":
				// Set composite operation to destination-out for erasing
				ctx.globalCompositeOperation = "destination-out";
				ctx.beginPath();
				ctx.arc(data.startX, data.startY, data.width / 2, 0, Math.PI * 2, false);
				ctx.fill();
				break;

			case "line":
				ctx.beginPath();
				ctx.moveTo(data.startX, data.startY);
				ctx.lineTo(data.endX, data.endY);
				ctx.stroke();
				saveState();
				break;

			case "rectangle":
				ctx.beginPath();
				ctx.rect(data.startX, data.startY, data.width, data.height);
				ctx.stroke();
				saveState();
				break;

			case "circle":
				ctx.beginPath();
				ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
				ctx.stroke();
				saveState();
				break;

			case "text":
				ctx.font = `${data.fontSize}px Arial`;
				ctx.fillStyle = data.color;
				ctx.fillText(data.text, data.x, data.y);
				saveState();
				break;
		}
	});

	// Handle clear canvas event
	socket.on("clearCanvas", () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		saveState();
	});

	// Add event listeners for drawing
	canvas.addEventListener("mousedown", startDrawing);
	canvas.addEventListener("mousemove", draw);
	canvas.addEventListener("mouseup", stopDrawing);
	canvas.addEventListener("mouseout", stopDrawing);

	// Add touch support for mobile devices
	canvas.addEventListener("touchstart", (e) => {
		e.preventDefault();
		const touch = e.touches[0];
		const mouseEvent = new MouseEvent("mousedown", {
			clientX: touch.clientX,
			clientY: touch.clientY,
		});
		canvas.dispatchEvent(mouseEvent);
	});

	canvas.addEventListener("touchmove", (e) => {
		e.preventDefault();
		const touch = e.touches[0];
		const mouseEvent = new MouseEvent("mousemove", {
			clientX: touch.clientX,
			clientY: touch.clientY,
		});
		canvas.dispatchEvent(mouseEvent);
	});

	canvas.addEventListener("touchend", (e) => {
		e.preventDefault();
		const mouseEvent = new MouseEvent("mouseup", {});
		canvas.dispatchEvent(mouseEvent);
	});

	// Tool selection
	const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
	const brushSettingsPopup = document.getElementById("brushSettings");
	const brushColorInput = document.getElementById("brushColor");
	const brushSizeSlider = document.getElementById("brushSizeSlider");
	const brushOpacitySlider = document.getElementById("brushOpacity");
	const eraserSettings = document.getElementById("eraserSettings");
	const eraserSizeSelect = document.getElementById("eraserSize");

	toolButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all tool buttons
			toolButtons.forEach((btn) => btn.classList.remove("active"));

			// Add active class to clicked button
			button.classList.add("active");

			// Set current tool
			currentTool = button.dataset.tool;

			// Show brush settings if brush tool is selected
			if (currentTool === "brush") {
				brushSettingsPopup.style.display = "block";
			} else {
				brushSettingsPopup.style.display = "none";
			}

			// Show eraser settings if eraser tool is selected
			if (currentTool === "eraser") {
				// eraserSettings.style.display = 'block'; change
				// canvas.classList.add('eraser-cursor'); change
			} else {
				eraserSettings.style.display = "none";
				canvas.classList.remove("eraser-cursor");
			}
		});
	});

	// Color picker
	const colorPicker = document.getElementById("colorPicker");
	colorPicker.addEventListener("input", () => {
		currentColor = colorPicker.value;
	});

	// Stroke width
	const strokeButtons = document.querySelectorAll(".stroke-btn");
	strokeButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all stroke buttons
			strokeButtons.forEach((btn) => btn.classList.remove("active"));

			// Add active class to clicked button
			button.classList.add("active");

			// Set current width
			currentWidth = parseInt(button.dataset.width);
		});
	});

	// Undo button
	document.getElementById("undoBtn").addEventListener("click", () => {
		if (historyIndex > 0) {
			historyIndex--;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(history[historyIndex], 0, 0);

			// Update button states
			document.getElementById("undoBtn").disabled = historyIndex <= 0;
			document.getElementById("redoBtn").disabled = false;
		}
	});

	// Redo button
	document.getElementById("redoBtn").addEventListener("click", () => {
		if (historyIndex < history.length - 1) {
			historyIndex++;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(history[historyIndex], 0, 0);

			// Update button states
			document.getElementById("redoBtn").disabled = historyIndex >= history.length - 1;
			document.getElementById("undoBtn").disabled = false;
		}
	});

	// Clear button
	document.getElementById("clearBtn").addEventListener("click", () => {
		if (confirm("Are you sure you want to clear the entire board?")) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			saveState();

			// Emit clear event
			socket.emit("clearCanvas");
		}
	});

	// Share button and modal
	const shareModal = document.getElementById("shareModal");
	const shareBtn = document.getElementById("shareBtn");
	const closeBtn = document.querySelector(".close-btn");
	const closeBtn2 = document.querySelector(".close-btn2");
	const shareLink = document.getElementById("shareLink");
	const copyLinkBtn = document.getElementById("copyLinkBtn");

	// Initially hide the share button until we confirm ownership
	// shareBtn.style.display = 'none'; change

	shareBtn.addEventListener("click", () => {
		// Set the share link
		shareLink.value = "'Direct Link to join board wlli be here'";

		// Generate and display a 6-digit code instead of the full roomId
		const boardCodeElement = document.getElementById("boardCode");
		if (boardCodeElement) {
			// Generate a 6-digit code from the roomId
			// Using a hash function to ensure consistent codes for the same roomId
			// const sixDigitCode = generateSixDigitCode(roomId); change
			const sixDigitCode = "SPECIAL CODE";
			boardCodeElement.textContent = sixDigitCode;
		}

		// Show the modal
		shareModal.classList.add("active");
	});

	// Function to generate a 6-digit code from roomId
	function generateSixDigitCode(roomId) {
		// Simple hash function to generate a numeric code from a string
		let numericValue = 0;
		for (let i = 0; i < roomId.length; i++) {
			numericValue += roomId.charCodeAt(i);
		}

		// Ensure it's exactly 6 digits by using modulo and padding
		let sixDigitCode = ((numericValue % 900000) + 100000).toString();
		return sixDigitCode;
	}

	closeBtn.addEventListener("click", () => {
		shareModal.classList.remove("active");
	});

	closeBtn2.addEventListener("click", () => {
		shareModal.classList.remove("active");
	});

	// Close modal when clicking outside
	window.addEventListener("click", (e) => {
		if (e.target === shareModal) {
			// shareModal.classList.remove('active'); change
		}
	});

	// Copy link button
	copyLinkBtn.addEventListener("click", () => {
		shareLink.select();
		document.execCommand("copy");

		// Show toast notification
		showToast("Link copied to clipboard!");
	});

	// Add a new copy button for the board code
	const copyCodeBtn = document.getElementById("copyCodeBtn");
	if (copyCodeBtn) {
		copyCodeBtn.addEventListener("click", () => {
			const boardCode = document.getElementById("boardCode").textContent;
			navigator.clipboard
				.writeText(boardCode)
				.then(() => {
					showToast("Board code copied to clipboard!");
				})
				.catch((err) => {
					console.error("Could not copy board code: ", err);
					// Fallback method
					const tempInput = document.createElement("input");
					tempInput.value = boardCode;
					document.body.appendChild(tempInput);
					tempInput.select();
					document.execCommand("copy");
					document.body.removeChild(tempInput);
					showToast("Board code copied to clipboard!");
				});
		});
	}

	// Password protection toggle
	const enablePasswordCheckbox = document.getElementById("enablePassword");
	const passwordInput = document.querySelector(".password-input");

	// Check if room already has password protection
	socket.on("roomPasswordStatus", (hasPassword) => {
		enablePasswordCheckbox.checked = hasPassword;
		passwordInput.style.display = hasPassword ? "flex" : "none";
	});

	enablePasswordCheckbox.addEventListener("change", () => {
		passwordInput.style.display = enablePasswordCheckbox.checked ? "flex" : "none";

		// If checkbox is unchecked, remove password protection
		if (!enablePasswordCheckbox.checked) {
			socket.emit("removeRoomPassword", { roomId });
			showToast("Password protection removed");
		}
	});

	// Set password button
	document.getElementById("setPasswordBtn").addEventListener("click", () => {
		const passwordField = document.getElementById("boardPassword");
		const password = passwordField.value;
		if (password) {
			// socket.emit('setRoomPassword', { roomId, password });
			showToast("Password protection enabled");
			// shareModal.classList.remove('active');
		} else {
			alert("Please enter a password");
		}
	});

	// Add password visibility toggle
	const togglePasswordBtn = document.createElement("button");
	togglePasswordBtn.type = "button";
	togglePasswordBtn.className = "btn password-toggle";
	togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
	togglePasswordBtn.title = "Show/Hide Password";
	togglePasswordBtn.addEventListener("click", () => {
		const passwordField = document.getElementById("boardPassword");
		if (passwordField.type === "password") {
			passwordField.type = "text";
			togglePasswordBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
		} else {
			passwordField.type = "password";
			togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
		}
	});

	// Insert toggle button after password input
	const passwordInputContainer = document.querySelector(".password-input");
	passwordInputContainer.insertBefore(togglePasswordBtn, document.getElementById("setPasswordBtn"));

	// Save button
	document.getElementById("saveBtn").addEventListener("click", () => {
		showToast("Board saved as PNG");
		// Create a temporary link element
		// const link = document.createElement('a');
		// link.download = `${roomName}.png`;
		// link.href = canvas.toDataURL('image/png');
		// change
		// // Trigger download
		// document.body.appendChild(link);
		// link.click();
		// document.body.removeChild(link);

		showToast("Board saved as PNG");
	});

	// Toast notification
	function showToast(message, type = "info") {
		const toast = document.getElementById("toast");
		const toastMessage = document.getElementById("toastMessage");

		toastMessage.textContent = message;
		toast.className = `toast ${type}`;
		toast.classList.add("active");

		// Hide toast after 3 seconds
		setTimeout(() => {
			toast.classList.remove("active");
		}, 3000);
	}

	// Get user info from localStorage
	function getUserInfo() {
		try {
			const userJson = localStorage.getItem("user");
			if (userJson) {
				return JSON.parse(userJson);
			}
		} catch (e) {
			console.error("Error parsing user data:", e);
		}
		return null;
	}

	// User name prompt
	function promptForUserName() {
		// First try to get name from logged in user
		const user = getUserInfo();
		if (user && user.name) {
			return user.name;
		}

		// Otherwise check localStorage or prompt
		let userName = localStorage.getItem("collaboard_username");

		if (!userName) {
			userName = prompt(
				"Enter your name to join the whiteboard:",
				"Guest " + Math.floor(Math.random() * 1000)
			);
			if (!userName) userName = "Guest " + Math.floor(Math.random() * 1000);
			localStorage.setItem("collaboard_username", userName);
		}

		return userName;
	}

	// Create password verification modal
	const passwordModal = document.createElement("div");
	passwordModal.className = "modal";
	passwordModal.id = "passwordModal";
	passwordModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i class="fas fa-lock"></i> Password Required</h3>
      </div>
      <div class="modal-body">
        <p>This board is password protected. Please enter the password to join.</p>
        <div class="password-input" style="display: flex;">
          <input type="password" id="joinPassword" placeholder="Enter password">
          <button id="toggleJoinPassword" class="btn password-toggle">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-primary" id="submitPasswordBtn">Join</button>
        </div>
        <div id="passwordError" class="error-message" style="display: none;"></div>
      </div>
    </div>
  `;
	document.body.appendChild(passwordModal);

	// Add password toggle functionality
	document.getElementById("toggleJoinPassword").addEventListener("click", () => {
		const passwordField = document.getElementById("joinPassword");
		const toggleBtn = document.getElementById("toggleJoinPassword");

		if (passwordField.type === "password") {
			passwordField.type = "text";
			toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
		} else {
			passwordField.type = "password";
			toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
		}
	});

	// Submit password button
	document.getElementById("submitPasswordBtn").addEventListener("click", submitPassword);

	// Submit password on enter key
	document.getElementById("joinPassword").addEventListener("keyup", (e) => {
		if (e.key === "Enter") {
			submitPassword();
		}
	});

	function submitPassword() {
		const password = document.getElementById("joinPassword").value;
		const errorElement = document.getElementById("passwordError");

		if (!password) {
			errorElement.textContent = "Please enter a password";
			errorElement.style.display = "block";
			return;
		}

		errorElement.style.display = "none";
		socket.emit("checkRoomPassword", { roomId, password });
	}

	// Handle password check result
	socket.on("passwordCheckResult", ({ success, message }) => {
		if (success) {
			passwordModal.classList.remove("active");
			const user = getUserInfo();
			const userId = user ? user.id : null;

			// Store both room auth and user ID if available
			localStorage.setItem(`board_auth_${roomId}`, "true");
			if (userId) {
				localStorage.setItem(`board_user_${roomId}`, userId);
			}

			socket.emit("joinRoom", {
				roomId,
				userName: promptForUserName(),
				userId,
				hasLocalAuth: true, // Always true after successful auth
			});
		} else {
			const errorElement = document.getElementById("passwordError");
			errorElement.textContent = message || "Incorrect password";
			errorElement.style.display = "block";
		}
	});

	// Handle password required
	socket.on("passwordRequired", () => {
		passwordModal.classList.add("active");
	});

	// Handle user rights
	let isOwner = false;
	socket.on("userRights", ({ isOwner: ownerStatus }) => {
		isOwner = ownerStatus;
		// Show/hide share button based on ownership
		const shareBtn = document.getElementById("shareBtn");
		shareBtn.style.display = isOwner ? "block" : "none";
	});

	// Join room
	const hasLocalAuth = localStorage.getItem(`board_auth_${roomId}`) === "true";
	const storedUserId = localStorage.getItem(`board_user_${roomId}`);
	const user = getUserInfo();

	socket.emit("joinRoom", {
		roomId,
		userName: promptForUserName(),
		userId: storedUserId || (user ? user.id : null),
		hasLocalAuth,
	});

	// Immediately populate users list
	populateStaticUsersList();

	// Make users panel fully visible
	const usersPanel = document.getElementById("usersPanel");
	if (usersPanel) {
		usersPanel.style.transform = "translateX(0)";

		// Remove any classes that might hide it
		usersPanel.classList.remove("collapsed");

		// Ensure panel content is visible
		const panelContent = usersPanel.querySelector(".panel-content");
		if (panelContent) {
			panelContent.style.display = "block";
		}
	}

	// Hide toggle button
	const toggleBtn = document.getElementById("toggleUsersPanel");
	if (toggleBtn) {
		toggleBtn.style.display = "none";
	}

	// Define the static users population function
	function populateStaticUsersList() {
		console.log("Populating static users list");
		const usersList = document.getElementById("usersList");
		console.log("Users list element:", usersList);

		if (usersList) {
			// Clear existing content
			usersList.innerHTML = "";

			// Define static users
			// const staticUsers = [
			//   { name: 'MARSHAL', status: 'You', isCurrentUser: true, color: '#4a6ee0' },
			//   { name: 'User 1', status: 'Online', color: '#e25563' },
			//   { name: 'User 2', status: 'Drawing...', color: '#28a745' },
			//   { name: 'User 3', status: 'Idle', color: '#f7b955' },
			//   { name: 'User 4', status: 'Online', color: '#8a56e0' }
			// ];

			// Add each user
			staticUsers.forEach((user) => {
				// Create user element
				const userElement = document.createElement("div");
				userElement.className = "user-item";

				// Generate initial
				const initial = user.name.charAt(0);

				// Set HTML content
				userElement.innerHTML = `
          <div class="user-avatar" style="background-color: ${user.color};">
            <span>${initial}</span>
          </div>
          <div class="user-info">
            <div class="user-name">${user.name} ${user.isCurrentUser ? "(You)" : ""}</div>
            <div class="user-status">${user.status}</div>
          </div>
        `;

				// Add to list
				usersList.appendChild(userElement);
				console.log(`Added user: ${user.name}`);
			});

			console.log(`Total users added: ${staticUsers.length}`);
		} else {
			console.error("Could not find usersList element");
		}
	}

	// Add a fallback method to populate after a short delay in case DOM isn't ready
	setTimeout(populateStaticUsersList, 1000);

	// Also try to populate whenever socket events happen
	socket.on("connect", () => {
		populateStaticUsersList();
	});

	socket.on("roomData", () => {
		populateStaticUsersList();
	});

	// Override other user-related functions to maintain our static list
	window.updateUsersList = function () {
		// Do nothing, maintain static list
	};

	window.addUserToList = function () {
		// Do nothing, maintain static list
	};

	window.removeUserFromList = function () {
		// Do nothing, maintain static list
	};
});
