document.addEventListener("DOMContentLoaded", function () {
	// Initialize important DOM elements first
	const connectionStatus = document.getElementById("connectionStatus");
	const eraserCursor = document.getElementById("eraserCursor");
	const brushSizeSelect = document.getElementById("brushSize");
	const eraserSizeControl = document.getElementById("eraserSizeControl");

	// Check if required elements exist
	if (!eraserCursor || !brushSizeSelect  || !connectionStatus) {
		console.error("Required elements not found in DOM");
		return;
	}

	// Socket.io setup
	const socket = io();
	let currentUserId = null;

	// Get URL parameters
	const urlParams = new URLSearchParams(window.location.search);
	const roomId = urlParams.get("room") || "Untitled Board";
	const roomName = urlParams.get("name") || "Untitled Board";

	// Set room name in the UI
	document.getElementById("roomName").textContent = roomName;

	// Set the title of the page
	document.title = `${roomName} - Collaboard`;

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

	// Initialize eraser settings
	const eraserSizeSelect = document.getElementById("eraserSize");
	if (eraserSizeSelect) {
		// Default eraser size
		const defaultEraserSize = 30;
		eraserSizeSelect.value = defaultEraserSize;
		
		// Create a visual indicator for eraser size
		const eraserSizeControl = document.getElementById("eraserSizeControl");
		if (eraserSizeControl) {
			eraserSizeControl.innerHTML = `<div class="size-indicator" style="width: ${defaultEraserSize}px; height: ${defaultEraserSize}px; border-radius: 50%; border: 1px solid #000; margin: 10px auto;"></div>`;
			
			// Update the visual indicator when slider changes
			eraserSizeSelect.addEventListener("input", (e) => {
				const size = parseInt(e.target.value);
				eraserSizeControl.innerHTML = `<div class="size-indicator" style="width: ${size}px; height: ${size}px; border-radius: 50%; border: 1px solid #000; margin: 10px auto;"></div>`;
			});
		}
	}

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
	brushSizeSelect.addEventListener("change", (e) => {
		currentWidth = parseInt(e.target.value);
	});

	// Drawing functions
	function startDrawing(e) {
		isDrawing = true;

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
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.strokeStyle = currentColor;
				// ctx.globalAlpha = brushOpacitySlider.value / 100; // Use the selected opacity
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
				// Clear a circle at the cursor position
				ctx.beginPath();
				const eraserSize = parseInt(eraserSizeSelect.value);
				// Draw a continuous line for smooth erasing
				ctx.lineWidth = eraserSize;
				ctx.strokeStyle = "rgba(255,255,255,1)"; // Color doesn't matter with destination-out
				ctx.beginPath();
				ctx.moveTo(lastX, lastY);
				ctx.lineTo(currentX, currentY);
				ctx.stroke();
				
				// Also draw a circle at current position for spot erasing
				ctx.beginPath();
				ctx.arc(currentX, currentY, eraserSize / 2, 0, Math.PI * 2, false);
				ctx.fill();

				// Emit erase event to server with full details for better synchronization
				socket.emit("drawEvent", {
					tool: "eraser",
					startX: lastX,
					startY: lastY,
					endX: currentX,
					endY: currentY,
					width: eraserSize,
					timestamp: Date.now() // Add timestamp for sequencing
				});
				
				// Save state after erasing occasionally to avoid performance issues
				if (Math.random() < 0.05) {
					saveState();
				}
				break;

			case "line":
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				if (historyIndex >= 0) {
					ctx.drawImage(history[historyIndex], 0, 0);
				}
				ctx.strokeStyle = currentColor;
				ctx.lineWidth = currentWidth;
				ctx.fillStyle = "transparent";
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
				ctx.strokeStyle = currentColor;
				ctx.lineWidth = currentWidth;
				ctx.fillStyle = "transparent";
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
				ctx.strokeStyle = currentColor;
				ctx.lineWidth = currentWidth;
				ctx.fillStyle = "transparent";
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
		ctx.globalAlpha = 1; // Reset opacity
	}

	function stopDrawing(event) {
		if (!isDrawing) return;
		isDrawing = false;

		// Save the current state
		saveState();
		
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
						lineWidth: currentWidth, // Change width to lineWidth to avoid conflict
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
						lineWidth: currentWidth, // Change width to lineWidth to avoid conflict
					});
					break;
			}
		}

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
		// Always save the current canvas state before applying new changes
		const tempState = new Image();
		tempState.src = canvas.toDataURL();
		
		// Set context properties for drawing
		ctx.lineWidth = data.width || data.lineWidth || 5; // Ensure we have a line width
		
		// Reset context state to ensure clean drawing
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = data.opacity !== undefined ? data.opacity : 1.0;

		switch (data.tool) {
			case "brush":
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.strokeStyle = data.color || "#000000";
				ctx.beginPath();
				ctx.moveTo(data.startX, data.startY);
				ctx.lineTo(data.endX, data.endY);
				ctx.stroke();
				break;

			case "eraser":
				// Set composite operation to destination-out for erasing
				ctx.globalCompositeOperation = "destination-out";
				
				// If we have both start and end positions, draw a line for continuous erasing
				if (data.startX !== undefined && data.startY !== undefined && 
					data.endX !== undefined && data.endY !== undefined) {
					ctx.lineWidth = data.width;
					ctx.strokeStyle = "rgba(255,255,255,1)"; // Color doesn't matter with destination-out
					ctx.beginPath();
					ctx.moveTo(data.startX, data.startY);
					ctx.lineTo(data.endX, data.endY);
					ctx.stroke();
				}
				
				// Also draw a circle for spot erasing (either at end point or provided position)
				ctx.beginPath();
				const eraserX = data.endX || data.startX;
				const eraserY = data.endY || data.startY;
				ctx.arc(eraserX, eraserY, data.width / 2, 0, Math.PI * 2, false);
				ctx.fill();
				break;

			case "line":
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.lineWidth || data.width || 5;
				ctx.fillStyle = "transparent";
				ctx.beginPath();
				ctx.moveTo(data.startX, data.startY);
				ctx.lineTo(data.endX, data.endY);
				ctx.stroke();
				break;

			case "rectangle":
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.lineWidth || data.width || 5;
				ctx.fillStyle = "transparent";
				ctx.beginPath();
				ctx.rect(data.startX, data.startY, data.width, data.height);
				ctx.stroke();
				break;

			case "circle":
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.lineWidth || data.width || 5;
				ctx.fillStyle = "transparent";
				ctx.beginPath();
				ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
				ctx.stroke();
				break;

			case "text":
				ctx.globalCompositeOperation = "source-over"; // Ensure normal drawing mode
				ctx.font = `${data.fontSize}px Arial`;
				ctx.fillStyle = data.color || "#000000";
				ctx.fillText(data.text, data.x, data.y);
				break;
		}
		
		// Reset context properties after drawing
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;
		
		// Save state after each received event to ensure history is updated
		// but only save occasionally to prevent performance issues
		if (Math.random() < 0.2) { // 20% chance to save state
			saveState();
		}
	});

	// Handle clear canvas event
	socket.on("clearCanvas", () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		saveState();
	});

	// Add event listeners for drawing
	canvas.addEventListener("mousedown", startDrawing);
	canvas.addEventListener("mousemove", (e) => {
		draw(e);
		// Only update eraser cursor if the current tool is eraser
		if (currentTool === "eraser") {
			updateEraserCursor(e);
		}
	});

	// Add global document mousemove listener to handle cursor outside canvas
	document.addEventListener("mousemove", (e) => {
		if (currentTool === "eraser") {
			updateEraserCursor(e);
		}
	});

	canvas.addEventListener("mouseup", stopDrawing);
	canvas.addEventListener("mouseout", stopDrawing);

	// Add mouseenter and mouseleave events for eraser cursor
	canvas.addEventListener("mouseenter", (e) => {
		if (currentTool === "eraser") {
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.display = "block";
				updateEraserCursor(e); // Update position immediately
			}
		}
	});

	canvas.addEventListener("mouseleave", () => {
		// We now keep the cursor visible even when leaving canvas
		// so we can see it coming back to the canvas
		// but only if we're using the eraser tool
		if (currentTool !== "eraser") {
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.display = "none";
			}
		}
	});

	// Update eraser cursor position and size
	function updateEraserCursor(e) {
		if (currentTool === "eraser") {
			const eraserCursor = document.getElementById("eraserCursor");
			if (!eraserCursor) return;
			
			const rect = canvas.getBoundingClientRect();
			// Calculate the cursor position relative to the page, not just the canvas
			const x = e.clientX;
			const y = e.clientY;
			const size = parseInt(eraserSizeSelect.value);

			eraserCursor.style.display = "block";
			eraserCursor.style.width = `${size}px`;
			eraserCursor.style.height = `${size}px`;
			eraserCursor.style.left = `${x}px`;
			eraserCursor.style.top = `${y}px`;
			eraserCursor.style.borderColor = `rgba(0,0,0,${size > 20 ? 0.8 : 0.5})`;
			
			// Make sure this cursor doesn't interfere with canvas events
			eraserCursor.style.pointerEvents = "none";
		} else {
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.display = "none";
			}
		}
	}

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
	// const brushOpacitySlider = document.getElementById("brushOpacity");
	const eraserSettings = document.getElementById("eraserSettings");
	const eraserBtn = document.getElementById("eraserBtn");
	// const eraserCursor = document.getElementById("eraserCursor");
	const eraserSizeSlider = document.getElementById("eraserSize");
	// const eraserSizeControl = document.getElementById("eraserSizeControl");

	// Update eraser cursor size when slider changes
	if (eraserSizeSlider) {
		eraserSizeSlider.addEventListener("input", (e) => {
			const size = parseInt(e.target.value);
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.width = `${size}px`;
				eraserCursor.style.height = `${size}px`;
				eraserCursor.style.borderColor = `rgba(0,0,0,${size > 20 ? 0.8 : 0.5})`;
			}
		});
	}

	toolButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all tool buttons
			toolButtons.forEach((btn) => btn.classList.remove("active"));

			// Add active class to clicked button
			button.classList.add("active");

			// Set current tool
			currentTool = button.dataset.tool;

			// Update canvas class to indicate eraser is active or not
			if (currentTool === "eraser") {
				canvas.classList.add("eraser-active");
			} else {
				canvas.classList.remove("eraser-active");
			}

			// Hide all settings panels first
			brushSettingsPopup.style.display = "none";
			eraserSettings.style.display = "none";
			// const lineSettings = document.getElementById("lineSettings");
			// const rectangleSettings = document.getElementById("rectangleSettings");
			// const circleSettings = document.getElementById("circleSettings");
			// lineSettings.style.display = "none";
			// rectangleSettings.style.display = "none";
			// circleSettings.style.display = "none";

			// Explicitly hide eraser cursor when switching tools
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.display = currentTool === "eraser" ? "block" : "none";
				
				// If eraser is selected, position the cursor at the current mouse position
				if (currentTool === "eraser") {
					// Get last known mouse position or use center of canvas as fallback
					const lastMouseEvent = window.lastMouseEvent || {
						clientX: window.innerWidth / 2,
						clientY: window.innerHeight / 2
					};
					updateEraserCursor(lastMouseEvent);
				}
			}

			// Show settings for selected tool
			switch (currentTool) {
				case "brush":
					brushSettingsPopup.style.display = "block";
					break;
				// case "line":
					// lineSettings.style.display = "block";
					// break;
				// case "rectangle":
					// rectangleSettings.style.display = "block";
					// break;
				// case "circle":
					// circleSettings.style.display = "block";
					// break;
				case "eraser":
					eraserSettings.style.display = "block";
					break;
			}

			if (currentTool === "eraser") {
				// Remove active class from all action tools
				document.querySelectorAll(".action-tools .tool").forEach((tool) => {
					tool.classList.remove("active");
				});

				eraserSettings.style.display = "block";
				const eraserSize = parseInt(eraserSizeSlider.value);
				const cursorSize = Math.max(10, eraserSize * 0.5); // Minimum size of 10px
				canvas.style.cursor = `none`;
				if (eraserCursor) {
					eraserCursor.style.display = "block";
					eraserCursor.style.width = `${cursorSize}px`;
					eraserCursor.style.height = cursorSize + "px";
				}
			} else {
				canvas.style.cursor = "default";
				if (eraserCursor) {
					eraserCursor.style.display = "none";
				}
				// Stop any active drawing
				if (isDrawing) {
					stopDrawing({ clientX: 0, clientY: 0 });
				}
			}
		});
	});

	// Track mouse position for eraser positioning
	window.lastMouseEvent = null;
	document.addEventListener("mousemove", (e) => {
		window.lastMouseEvent = e;
	});

	// Color picker
	const colorPicker = document.getElementById("colorPicker");
	colorPicker.addEventListener("input", (e) => {
		currentColor = e.target.value;
		ctx.strokeStyle = currentColor; // Immediately update the strokeStyle
	});

	// Add color picker change event for completion
	colorPicker.addEventListener("change", (e) => {
		currentColor = e.target.value;
		ctx.strokeStyle = currentColor;
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
	shareBtn.style.display = "none";

	shareBtn.addEventListener("click", () => {
		// Set the share link
		shareLink.value = window.location.href;

		// Generate and display a 6-digit code instead of the full roomId
		const boardCodeElement = document.getElementById("boardCode");
		if (boardCodeElement) {
			// Generate a 6-digit code from the roomId
			// Using a hash function to ensure consistent codes for the same roomId
			const sixDigitCode = generateSixDigitCode(roomId);
			boardCodeElement.textContent = sixDigitCode;
		}

		// Show the modal
		shareModal.classList.add("active");
	});

	// Function to generate a 6-digit code from roomId
	function generateSixDigitCode(roomId) {
		// Check if roomId is null or undefined
		if (!roomId) {
			console.warn("Warning: Attempted to generate code for undefined or null roomId");
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

	closeBtn.addEventListener("click", () => {
		shareModal.classList.remove("active");
	});

	closeBtn2.addEventListener("click", () => {
		shareModal.classList.remove("active");
	});

	// Close modal when clicking outside
	window.addEventListener("click", (e) => {
		if (e.target === shareModal) {
			shareModal.classList.remove("active");
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
			socket.emit("setRoomPassword", { roomId, password });
			showToast("Password protection enabled");
			shareModal.classList.remove("active");
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
		// Create a temporary link element
		const link = document.createElement("a");
		link.download = roomName + ".png";
		link.href = canvas.toDataURL("image/png");

		// Trigger download
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		showToast("Board saved as PNG");
	});

	// Toast notification
	function showToast(message, type = "info") {
		const toast = document.getElementById("toast");
		const toastMessage = document.getElementById("toastMessage");

		toastMessage.textContent = message;
		toast.className = "toast " + type;
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

	// Join room with auth check
	(async () => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const response = await fetch("/api/user", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (response.ok) {
					// Now join the room with authenticated user
					socket.emit("joinRoom", {
						roomId,
						userName: promptForUserName(),
						userId: storedUserId || (user ? user.id : null),
						hasLocalAuth,
						token,
					});
				} else {
					// Token invalid, join as guest
					socket.emit("joinRoom", {
						roomId,
						userName: promptForUserName(),
						hasLocalAuth,
					});
				}
			} catch (error) {
				console.error("Auth check error:", error);
				// Join as guest on error
				socket.emit("joinRoom", {
					roomId,
					userName: promptForUserName(),
					hasLocalAuth,
				});
			}
		} else {
			// No token, join as guest
			socket.emit("joinRoom", {
				roomId,
				userName: promptForUserName(),
				hasLocalAuth,
			});
		}
	})();

	// Handle room data (users and history)
	socket.on("roomData", ({ users, history: roomHistory }) => {
		console.log(
			"Received room data with",
			users.length,
			"users and",
			roomHistory ? roomHistory.length : 0,
			"history items"
		);

		// Update users list
		updateUsersList(users);

		// Apply drawing history if available
		if (roomHistory && roomHistory.length > 0) {
			// Clear canvas first to ensure we start fresh
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			console.log("Applying board history...");
			
			// Sort history by timestamp if available to ensure correct order
			if (roomHistory[0].timestamp) {
				roomHistory.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
			}

			// First pass: process all non-eraser events
			const eraserEvents = [];
			
			// Process in batches to improve performance
			let processedCount = 0;
			const totalEvents = roomHistory.length;
			
			roomHistory.forEach((data) => {
				processedCount++;
				
				// Log progress for large histories
				if (totalEvents > 100 && processedCount % 50 === 0) {
					console.log(`Processing history: ${processedCount}/${totalEvents} events`);
				}
				
				if (data.tool === "eraser") {
					eraserEvents.push(data);
					return; // Skip eraser events in the first pass
				}

				// Reset context state
				ctx.globalCompositeOperation = "source-over";
				ctx.fillStyle = "transparent";
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.width || data.lineWidth || 5;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";
				ctx.globalAlpha = data.opacity !== undefined ? data.opacity : 1.0;

				// Handle different tools
				switch (data.tool) {
					case "brush":
						ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
						break;

					case "line":
						ctx.strokeStyle = data.color || "#000000";
						ctx.lineWidth = data.lineWidth || data.width || 5;
						ctx.fillStyle = "transparent";
						ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
						break;

					case "rectangle":
						ctx.strokeStyle = data.color || "#000000";
						ctx.lineWidth = data.lineWidth || data.width || 5;
						ctx.fillStyle = "transparent";
						ctx.beginPath();
						ctx.rect(data.startX, data.startY, data.width, data.height);
						ctx.stroke();
						break;

					case "circle":
						ctx.strokeStyle = data.color || "#000000";
						ctx.lineWidth = data.lineWidth || data.width || 5;
						ctx.fillStyle = "transparent";
						ctx.beginPath();
						ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
						ctx.stroke();
						break;

					case "text":
						ctx.font = `${data.fontSize}px Arial`;
						ctx.fillStyle = data.color || "#000000";
						ctx.fillText(data.text, data.x, data.y);
						break;
				}

				// Reset for next drawing
				ctx.globalAlpha = 1.0;
				ctx.globalCompositeOperation = "source-over";
			});

			// Second pass: apply eraser events
			if (eraserEvents.length > 0) {
				console.log(`Applying ${eraserEvents.length} eraser events`);
				eraserEvents.forEach((data) => {
					ctx.globalCompositeOperation = "destination-out";
					
					// Handle eraser with both line and spot erasing
					if (data.startX !== undefined && data.startY !== undefined &&
						data.endX !== undefined && data.endY !== undefined) {
						// Line erasing for continuous motion
						ctx.lineWidth = data.width;
						ctx.strokeStyle = "rgba(255,255,255,1)"; // Color doesn't matter with destination-out
					ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
					}
					
					// Spot erasing with a circle
					ctx.beginPath();
					const eraserX = data.endX || data.startX;
					const eraserY = data.endY || data.startY;
					ctx.arc(eraserX, eraserY, data.width / 2, 0, Math.PI * 2, false);
					ctx.fill();
					
					ctx.globalCompositeOperation = "source-over";
				});
			}

			// Save the fully applied history as a state
			console.log("History applied, saving state");
			saveState();
			connectionStatus.classList.remove("disconnected");
			connectionStatus.classList.add("connected");
			showToast("Board loaded successfully", "success");
		}

		// Now that we have all data, send the userReady event
		socket.emit("userReady", { roomId });

		// Update document title
		document.getElementById("pageTitle").textContent = roomName;

		// Update connection UI
		connectionStatus.innerHTML = '<i class="fas fa-circle connected"></i> Connected';
	});

	// Handle user joined
	socket.on("userJoined", (userData) => {
		console.log("User joined:", userData);

		if (userData.id === socket.id) {
			currentUserId = userData.id;
		}

		// Add user to list
		addUserToList(userData);

		// Show notification
		if (userData.id !== socket.id) {
			showToast(`${userData.name} joined the board`);
		}
	});

	// Handle user left
	socket.on("userLeft", (user) => {
		// Check if user is null or undefined before trying to access properties
		if (!user) {
			console.warn("Received null or undefined user in userLeft event");
			return;
		}
		
		// Check if user is an object or just an ID
		if (typeof user === "object") {
			removeUserFromList(user.id);
			// Only show toast if we have a name
			if (user.name) {
				showToast(`${user.name} left the board`, "info");
			} else {
				showToast("A user left the board", "info");
			}
		} else {
			// Backward compatibility for older version
			removeUserFromList(user);
			showToast(`A user left the board`, "info");
		}
	});

	// Handle user count update
	socket.on("userCount", (count) => {
		console.log("User count updated:", count);
		document.getElementById("usersCount").textContent = `${count} user${count !== 1 ? "s" : ""}`;
	});

	// Update connection status
	socket.on("connect", () => {
		connectionStatus.classList.remove("disconnected");
		connectionStatus.classList.add("connected");
		console.log("Connected to server with socket ID:", socket.id);

		// Get the user name before joining the room
		const userName = promptForUserName();
		const user = getUserInfo();
		const userId = user ? user.id : null;

		// Check if we have local authentication for this room
		const hasLocalAuth = localStorage.getItem(`board_auth_${roomId}`) === "true";
		const storedUserId = localStorage.getItem(`board_user_${roomId}`);

		// Emit joinRoom with the user name
		socket.emit("joinRoom", {
			roomId,
			userName, // Use the retrieved user name
			userId,
			password: null,
			hasLocalAuth: hasLocalAuth || (userId && storedUserId === userId),
		});
	});

	socket.on("disconnect", () => {
		console.log("Disconnected from server");

		const connectionStatus = document.getElementById("connectionStatus");
		connectionStatus.innerHTML = '<i class="fas fa-circle disconnected"></i> Disconnected';
		connectionStatus.classList.remove("connected");
		connectionStatus.classList.add("disconnected");

		showToast("Disconnected from server. Trying to reconnect...");
	});

	// Add this new event handler for reconnect
	socket.on("reconnect", () => {
		console.log("Reconnected to server");

		const connectionStatus = document.getElementById("connectionStatus");
		connectionStatus.innerHTML = '<i class="fas fa-circle connected"></i> Connected';
		connectionStatus.classList.remove("disconnected");
		connectionStatus.classList.add("connected");

		showToast("Reconnected to server", "success");
	});

	// Add this error handling code near the socket events
	socket.on("error", ({ message }) => {
		showToast(`Error: ${message}`, "error");
		console.error("Server reported an error:", message);
	});

	// Users list functions
	function updateUsersList(users) {
		console.log("Updating users list with", users.length, "users");

		const usersList = document.getElementById("usersList");
		const existingUsers = new Set();

		// First, mark all existing users for potential removal
		Array.from(usersList.children).forEach((item) => {
			item.dataset.keep = "false";
		});

		// Process all users in the new list
		users.forEach((user) => {
			// Check if this user is already in the list by userId (more stable than socket ID)
			let existingItem = null;
			if (user.userId) {
				existingItem = Array.from(usersList.children).find(
					(item) => item.dataset.userId === user.userId
				);
			}

			if (!existingItem) {
				// No match by userId, try by socket id
				existingItem = document.getElementById(`user-${user.id}`);
			}

			if (existingItem) {
				// User exists, update and keep
				existingItem.dataset.keep = "true";

				// Update name or other properties if needed
				const nameElement = existingItem.querySelector(".user-name");
				if (nameElement) {
					const isCurrentUser = user.id === socket.id;
					nameElement.textContent = `${user.name} ${isCurrentUser ? "(You)" : ""}`;
				}
			} else {
				// Add new user
				addUserToList(user);
			}

			// Remember this user was processed
			existingUsers.add(user.id);
		});

		// Remove any users that weren't in the updated list
		Array.from(usersList.children).forEach((item) => {
			if (item.dataset.keep === "false") {
				item.remove();
			}
		});
	}

	function addUserToList(user) {
		const usersList = document.getElementById("usersList");

		// Skip if already in list by socket ID
		if (document.getElementById(`user-${user.id}`)) {
			return;
		}

		// Skip if already in list by user ID
		if (
			user.userId &&
			Array.from(usersList.children).some((item) => item.dataset.userId === user.userId)
		) {
			return;
		}

		const userItem = document.createElement("div");
		userItem.className = "user-item";
		userItem.id = `user-${user.id}`;
		userItem.dataset.userId = user.userId || user.id;
		userItem.dataset.keep = "true"; // Mark as keeping

		const isCurrentUser = user.id === socket.id;

		userItem.innerHTML = `
      <div class="user-avatar" style="background-color: ${user.color};">
        <span>${user.initial}</span>
      </div>
      <div class="user-name">${user.name} ${isCurrentUser ? "(You)" : ""}</div>
    `;

		usersList.appendChild(userItem);
	}

	function removeUserFromList(userId) {
		if (!userId) {
			console.warn("Attempted to remove user with null/undefined ID");
			return;
		}
		
		const userItem = document.getElementById(`user-${userId}`);
		if (userItem) {
			userItem.remove();
		}
	}

	// Update brush color
	brushColorInput.addEventListener("input", (e) => {
		currentColor = e.target.value;
	});

	// Update brush size
	brushSizeSlider.addEventListener("input", (e) => {
		currentWidth = e.target.value;
	});

	// Update brush opacity
	// brushOpacitySlider.addEventListener("input", (e) => {
	// 	ctx.globalAlpha = e.target.value / 100; // Convert to 0-1 range
	// });

	// Update eraser size
	eraserSizeSelect.addEventListener("change", (e) => {
		currentWidth = parseInt(e.target.value);
	});

	// Handle room password updates
	socket.on("roomPasswordUpdated", (hasPassword) => {
		// Update checkbox if user has share modal open
		if (document.getElementById("shareModal").classList.contains("active")) {
			enablePasswordCheckbox.checked = hasPassword;
			passwordInput.style.display = hasPassword ? "flex" : "none";
		}
	});

	// Add exit button handler
	document.getElementById("exitBtn").addEventListener("click", (e) => {
		e.preventDefault(); // Prevent default link behavior
		e.stopPropagation();

		// Show custom modal instead of default confirm
		showExitConfirmation();
	});

	// Add this function for modern confirmation dialog
	function showExitConfirmation() {
		const modal = document.createElement("div");
		modal.className = "modern-confirm-modal";
		modal.innerHTML = `
        <div class="modal-content">
            <h3>Leave Board?</h3>
            <p>Are you sure you want to leave this board?</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" id="cancelExit">Cancel</button>
                <button class="btn btn-danger" id="confirmExit">Leave</button>
            </div>
        </div>
    `;
		document.body.appendChild(modal);

		// Handle confirm
		document.getElementById("confirmExit").addEventListener("click", () => {
			if (!isOwner) {
				localStorage.removeItem(`board_auth_${roomId}`);
				localStorage.removeItem(`board_user_${roomId}`);
			}
			window.location.href = "/";
		});

		// Handle cancel
		document.getElementById("cancelExit").addEventListener("click", () => {
			modal.remove();
		});
	}

	// Add periodic sync to ensure all clients are up to date
	const SYNC_INTERVAL = 30000; // 30 seconds
	
	// Request a sync of the latest board state from the server
	function requestBoardSync() {
		console.log("Requesting board sync...");
		socket.emit("requestBoardSync", { roomId });
	}
	
	// Setup periodic sync
	let syncInterval;
	
	function setupSyncInterval() {
		// Clear any existing interval
		if (syncInterval) {
			clearInterval(syncInterval);
		}
		
		// Set up new interval
		syncInterval = setInterval(requestBoardSync, SYNC_INTERVAL);
		console.log("Board sync interval set up");
	}
	
	// Handle board sync received from server
	socket.on("boardSync", ({ history }) => {
		console.log(`Received board sync with ${history.length} history items`);
		
		// Only apply if we have new history items
		if (history && history.length > 0) {
			// Clear canvas and apply the updated history
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			
			// Sort history by timestamp if available to ensure correct order
			if (history[0].timestamp) {
				history.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
			}
			
			// Process history (simplified from roomData handler)
			const eraserEvents = [];
			
			history.forEach((data) => {
				if (data.tool === "eraser") {
					eraserEvents.push(data);
					return;
				}
				
				// Apply drawing event
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.width || data.lineWidth || 5;
				ctx.globalAlpha = data.opacity !== undefined ? data.opacity : 1.0;
				
				switch (data.tool) {
					case "brush":
						ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
						break;
					case "line":
						ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
						break;
					case "rectangle":
						ctx.beginPath();
						ctx.rect(data.startX, data.startY, data.width, data.height);
						ctx.stroke();
						break;
					case "circle":
						ctx.beginPath();
						ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
						ctx.stroke();
						break;
					case "text":
						ctx.font = `${data.fontSize}px Arial`;
						ctx.fillStyle = data.color || "#000000";
						ctx.fillText(data.text, data.x, data.y);
						break;
				}
			});
			
			// Apply eraser events after all drawing events
			if (eraserEvents.length > 0) {
				eraserEvents.forEach((data) => {
					ctx.globalCompositeOperation = "destination-out";
					
					if (data.startX !== undefined && data.endY !== undefined) {
						ctx.lineWidth = data.width;
						ctx.beginPath();
						ctx.moveTo(data.startX, data.startY);
						ctx.lineTo(data.endX, data.endY);
						ctx.stroke();
					}
					
					ctx.beginPath();
					const eraserX = data.endX || data.startX;
					const eraserY = data.endY || data.startY;
					ctx.arc(eraserX, eraserY, data.width / 2, 0, Math.PI * 2, false);
					ctx.fill();
				});
			}
			
			// Reset context properties and save state
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = 1.0;
			saveState();
			
			// showToast("Board synchronized", "info");
		}
	});
	
	// Start sync interval when connected
	socket.on("connect", () => {
		setupSyncInterval();
	});
	
	// Setup sync interval also after roomData received
	socket.on("roomData", () => {
		setupSyncInterval();
	});
	
	// Clear interval on disconnect
	socket.on("disconnect", () => {
		if (syncInterval) {
			clearInterval(syncInterval);
		}
	});
});
