document.addEventListener("DOMContentLoaded", function () {
	// Initialize important DOM elements first
	const connectionStatus = document.getElementById("connectionStatus");
	const eraserCursor = document.getElementById("eraserCursor");
	const brushSizeSelect = document.getElementById("brushSize");
	const eraserSizeControl = document.getElementById("eraserSizeControl");

	// Check if required elements exist
	if (!eraserCursor || !brushSizeSelect || !connectionStatus) {
		console.error("Required elements not found in DOM");
		return;
	}

	// Socket.io setup
	const socket = io('http://localhost:3000', {
		transports: ['websocket'],
		withCredentials: true
	});
	// const socket = io('https://collaboard-backend-cdr6.onrender.com', {
	// 	transports: ['websocket'],
	// 	withCredentials: true
	// });

	// Connection status handling
	socket.on('connect', () => {
		console.log('Connected to server');
		connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #4CAF50;"></i> Connected';
	});

	socket.on('disconnect', () => {
		console.log('Disconnected from server');
		connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #f44336;"></i> Disconnected';
	});

	socket.on('connect_error', (error) => {
		console.error('Connection error:', error);
		connectionStatus.innerHTML = '<i class="fas fa-circle" style="color: #f44336;"></i> Connection Error';
	});

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

	// State tracking variables
	let currentTool = "brush";
	let historyIndex = -1;
	let history = [];
	let lastSaveTime = Date.now();

	// Tool-specific settings
	const toolColors = {
		brush: "#000000",
		line: "#000000",
		rectangle: "#000000",
		circle: "#000000",
		text: "#000000",
		eraser: "#ffffff"
	};
	
	const toolSizes = {
		brush: 5,
		line: 2,
		rectangle: 2,
		circle: 2,
		text: 24,
		eraser: 30
	};
	
	// Current active settings (will be set based on selected tool)
	let currentColor = toolColors.brush;
	let currentWidth = toolSizes.brush;
	
	// Update tool-specific settings
	function updateToolSettings() {
		// Set current color and width based on the active tool
		currentColor = toolColors[currentTool];
		currentWidth = toolSizes[currentTool];
		
		// Update UI to reflect the current tool's settings
		if (currentTool === "brush" && brushColorInput && brushSizeSlider) {
			brushColorInput.value = toolColors.brush;
			brushSizeSlider.value = toolSizes.brush;
		} else if (currentTool === "line" && lineColorInput && lineSizeSlider) {
			lineColorInput.value = toolColors.line;
			lineSizeSlider.value = toolSizes.line;
		} else if (currentTool === "rectangle" && rectangleColorInput && rectangleSizeSlider) {
			rectangleColorInput.value = toolColors.rectangle;
			rectangleSizeSlider.value = toolSizes.rectangle;
		} else if (currentTool === "circle" && circleColorInput && circleSizeSlider) {
			circleColorInput.value = toolColors.circle;
			circleSizeSlider.value = toolSizes.circle;
		} else if (currentTool === "text" && textColorInput && textSizeSlider) {
			textColorInput.value = toolColors.text;
			textSizeSlider.value = toolSizes.text;
		} else if (currentTool === "eraser" && eraserSizeSlider) {
			eraserSizeSlider.value = toolSizes.eraser;
		}
	}

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

		// Limit history size to prevent memory issues
		if (history.length > 50) {
			history.shift();
			historyIndex--;
		}

		// Create a new image from the canvas
		const newState = new Image();
		newState.src = canvas.toDataURL("image/png", 0.5); // Use compression for better performance

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

		// Check if we should save state (every 10 seconds during long drawing sessions)
		const currentTime = Date.now();
		if (currentTime - lastSaveTime > 10000) {
			// 10 seconds
			saveState();
			lastSaveTime = currentTime;
		}

		// Set drawing styles
		ctx.lineWidth = currentWidth;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		// Draw based on selected tool
		switch (currentTool) {
			case "brush":
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = toolColors.brush;
				ctx.lineWidth = toolSizes.brush;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";

				// Store points for smooth curve
				if (!window.brushPoints) {
					window.brushPoints = [];
				}

				// Add current point
				window.brushPoints.push({ x: currentX, y: currentY });

				// Keep only last 4 points for performance
				if (window.brushPoints.length > 4) {
					window.brushPoints.shift();
				}

				// Draw smooth curve through points
				if (window.brushPoints.length >= 2) {
					ctx.beginPath();
					ctx.moveTo(lastX, lastY);

					if (window.brushPoints.length === 2) {
						// Draw line for 2 points
						ctx.lineTo(currentX, currentY);
					} else {
						// Use bezier curve for smoother lines
						let i = 0;
						ctx.moveTo(window.brushPoints[0].x, window.brushPoints[0].y);

						for (i = 1; i < window.brushPoints.length - 2; i++) {
							const xc = (window.brushPoints[i].x + window.brushPoints[i + 1].x) / 2;
							const yc = (window.brushPoints[i].y + window.brushPoints[i + 1].y) / 2;
							ctx.quadraticCurveTo(window.brushPoints[i].x, window.brushPoints[i].y, xc, yc);
						}

						// Curve through the last two points
						ctx.quadraticCurveTo(
							window.brushPoints[i].x,
							window.brushPoints[i].y,
							window.brushPoints[i + 1].x,
							window.brushPoints[i + 1].y
						);
					}

					ctx.stroke();
				}

				// Emit draw event with curve data
				socket.emit("drawEvent", {
					tool: "brush",
					startX: lastX,
					startY: lastY,
					endX: currentX,
					endY: currentY,
					points: window.brushPoints.map((p) => ({ x: p.x, y: p.y })),
					color: toolColors.brush,
					width: toolSizes.brush,
					timestamp: Date.now(),
				});
				break;

			case "eraser":
				// Set composite operation to destination-out for erasing
				ctx.globalCompositeOperation = "destination-out";
				// Clear a circle at the cursor position
				ctx.beginPath();
				const eraserSize = toolSizes.eraser;
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
					timestamp: Date.now(), // Add timestamp for sequencing
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
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = toolColors.line;
				ctx.lineWidth = toolSizes.line;
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
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = toolColors.rectangle;
				ctx.lineWidth = toolSizes.rectangle;
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
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = toolColors.circle;
				ctx.lineWidth = toolSizes.circle;
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

	function stopDrawing(e) {
		if (!isDrawing) return;
		isDrawing = false;

		// Reset brush points
		window.brushPoints = [];

		const rect = canvas.getBoundingClientRect();
		const endX = e.clientX - rect.left;
		const endY = e.clientY - rect.top;

		if (currentTool === "line") {
			socket.emit("drawEvent", {
				tool: "line",
				startX: lastX,
				startY: lastY,
				endX: endX,
				endY: endY,
				color: toolColors.line,
				width: toolSizes.line,
				timestamp: Date.now(),
			});
		} else if (currentTool === "rectangle") {
			const width = endX - lastX;
			const height = endY - lastY;
			socket.emit("drawEvent", {
				tool: "rectangle",
				startX: lastX,
				startY: lastY,
				width: width,
				height: height,
				color: toolColors.rectangle,
				lineWidth: toolSizes.rectangle,
				timestamp: Date.now(),
			});
		} else if (currentTool === "circle") {
			const radiusX = Math.abs(endX - lastX) / 2;
			const radiusY = Math.abs(endY - lastY) / 2;
			const centerX = Math.min(lastX, endX) + radiusX;
			const centerY = Math.min(lastY, endY) + radiusY;

			socket.emit("drawEvent", {
				tool: "circle",
				centerX: centerX,
				centerY: centerY,
				radiusX: radiusX,
				radiusY: radiusY,
				color: toolColors.circle,
				lineWidth: toolSizes.circle,
				timestamp: Date.now(),
			});
		}

		// If text tool is selected, prompt for text input
		if (currentTool === "text") {
			const text = prompt("Enter text:");
			if (text) {
				// Get text settings
				const fontSize = textSizeSlider ? parseInt(textSizeSlider.value) : currentWidth * 3;
				const textColor = textColorInput ? textColorInput.value : currentColor;
				
				// Set font and color
				ctx.font = `${fontSize}px Arial`;
				ctx.fillStyle = textColor;
				ctx.fillText(text, lastX, lastY);

				// Emit text event with enhanced settings
				socket.emit("drawEvent", {
					tool: "text",
					x: lastX,
					y: lastY,
					text: text,
					color: textColor,
					fontSize: fontSize,
					font: "Arial"
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
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = data.color || "#000000";
				ctx.lineWidth = data.width;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";

				// Draw smooth curve if points are provided
				if (data.points && data.points.length >= 2) {
					ctx.beginPath();
					ctx.moveTo(data.points[0].x, data.points[0].y);

					if (data.points.length === 2) {
						ctx.lineTo(data.points[1].x, data.points[1].y);
					} else {
						let i = 0;
						for (i = 1; i < data.points.length - 2; i++) {
							const xc = (data.points[i].x + data.points[i + 1].x) / 2;
							const yc = (data.points[i].y + data.points[i + 1].y) / 2;
							ctx.quadraticCurveTo(data.points[i].x, data.points[i].y, xc, yc);
						}

						// Curve through the last two points
						ctx.quadraticCurveTo(
							data.points[i].x,
							data.points[i].y,
							data.points[i + 1].x,
							data.points[i + 1].y
						);
					}
					ctx.stroke();
				} else {
					// Fallback to simple line for backward compatibility
					ctx.beginPath();
					ctx.moveTo(data.startX, data.startY);
					ctx.lineTo(data.endX, data.endY);
					ctx.stroke();
				}
				break;

			case "eraser":
				// Set composite operation to destination-out for erasing
				ctx.globalCompositeOperation = "destination-out";

				// If we have both start and end positions, draw a line for continuous erasing
				if (
					data.startX !== undefined &&
					data.startY !== undefined &&
					data.endX !== undefined &&
					data.endY !== undefined
				) {
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
				const font = data.font || "Arial";
				ctx.font = `${data.fontSize}px ${font}`;
				ctx.fillStyle = data.color || "#000000";
				ctx.fillText(data.text, data.x, data.y);
				break;
		}

		// Reset context properties after drawing
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1;

		// Save state after each received event to ensure history is updated
		// but only save occasionally to prevent performance issues
		if (Math.random() < 0.2) {
			// 20% chance to save state
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
	const eraserSettings = document.getElementById("eraserSettings");
	const eraserBtn = document.getElementById("eraserBtn");
	const eraserSizeSlider = document.getElementById("eraserSize");
	const textSettings = document.getElementById("textSettings");
	const textColorInput = document.getElementById("textColor");
	const textSizeSlider = document.getElementById("textSize");
	const textFontSelect = document.getElementById("textFont");

	const lineSettings = document.getElementById("lineSettings");
	const lineSizeSlider = document.getElementById("lineSize");
	const lineColorInput = document.getElementById("lineColor");
	const rectangleSettings = document.getElementById("rectangleSettings");
	const rectangleSizeSlider = document.getElementById("rectangleSize");
	const rectangleColorInput = document.getElementById("rectangleColor");
	const circleSettings = document.getElementById("circleSettings");
	const circleSizeSlider = document.getElementById("circleSize");
	const circleColorInput = document.getElementById("circleColor");

	// Update text settings
	if (textColorInput) {
		textColorInput.addEventListener("input", (e) => {
			toolColors.text = e.target.value;
			if (currentTool === "text") {
				currentColor = e.target.value;
			}
		});
	}

	if (textSizeSlider) {
		textSizeSlider.addEventListener("input", (e) => {
			toolSizes.text = parseInt(e.target.value);
			if (currentTool === "text") {
				currentWidth = parseInt(e.target.value);
			}
		});
	}

	// Update eraser cursor size when slider changes
	if (eraserSizeSlider) {
		eraserSizeSlider.addEventListener("input", (e) => {
			const size = parseInt(e.target.value);
			toolSizes.eraser = size;
			if (currentTool === "eraser") {
				currentWidth = size;
			}
			
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.width = `${size}px`;
				eraserCursor.style.height = `${size}px`;
				eraserCursor.style.borderColor = `rgba(0,0,0,${size > 20 ? 0.8 : 0.5})`;
			}
		});
	}
	
	// Brush settings
	if (brushColorInput) {
		brushColorInput.addEventListener("input", (e) => {
			toolColors.brush = e.target.value;
			if (currentTool === "brush") {
				currentColor = e.target.value;
			}
		});
	}
	
	if (brushSizeSlider) {
		brushSizeSlider.addEventListener("input", (e) => {
			toolSizes.brush = parseInt(e.target.value);
			if (currentTool === "brush") {
				currentWidth = parseInt(e.target.value);
			}
		});
	}
	
	// Line settings
	if (lineColorInput) {
		lineColorInput.addEventListener("input", (e) => {
			toolColors.line = e.target.value;
			if (currentTool === "line") {
				currentColor = e.target.value;
			}
		});
	}
	
	if (lineSizeSlider) {
		lineSizeSlider.addEventListener("input", (e) => {
			toolSizes.line = parseInt(e.target.value);
			if (currentTool === "line") {
				currentWidth = parseInt(e.target.value);
			}
		});
	}
	
	// Rectangle settings
	if (rectangleColorInput) {
		rectangleColorInput.addEventListener("input", (e) => {
			toolColors.rectangle = e.target.value;
			if (currentTool === "rectangle") {
				currentColor = e.target.value;
			}
		});
	}
	
	if (rectangleSizeSlider) {
		rectangleSizeSlider.addEventListener("input", (e) => {
			toolSizes.rectangle = parseInt(e.target.value);
			if (currentTool === "rectangle") {
				currentWidth = parseInt(e.target.value);
			}
		});
	}
	
	// Circle settings
	if (circleColorInput) {
		circleColorInput.addEventListener("input", (e) => {
			toolColors.circle = e.target.value;
			if (currentTool === "circle") {
				currentColor = e.target.value;
			}
		});
	}
	
	if (circleSizeSlider) {
		circleSizeSlider.addEventListener("input", (e) => {
			toolSizes.circle = parseInt(e.target.value);
			if (currentTool === "circle") {
				currentWidth = parseInt(e.target.value);
			}
		});
	}

	// Setup close buttons for tool settings panels
	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll('.settings-close-btn').forEach(btn => {
			btn.addEventListener('click', function() {
				const targetId = this.getAttribute('data-target');
				const panel = document.getElementById(targetId);
				if (panel) {
					panel.style.display = 'none';
				}
			});
		});
	});

	// Color picker
	const colorPicker = document.getElementById("colorPicker");
	if (colorPicker) {
		colorPicker.addEventListener("input", (e) => {
			// Update the current tool color
			toolColors[currentTool] = e.target.value;
			currentColor = e.target.value;
			
			// Also update the corresponding tool-specific color input
			if (currentTool === "brush" && brushColorInput) {
				brushColorInput.value = e.target.value;
			} else if (currentTool === "line" && lineColorInput) {
				lineColorInput.value = e.target.value;
			} else if (currentTool === "rectangle" && rectangleColorInput) {
				rectangleColorInput.value = e.target.value;
			} else if (currentTool === "circle" && circleColorInput) {
				circleColorInput.value = e.target.value;
			} else if (currentTool === "text" && textColorInput) {
				textColorInput.value = e.target.value;
			}
		});
		
		colorPicker.addEventListener("change", (e) => {
			// Update the current tool color
			toolColors[currentTool] = e.target.value;
			currentColor = e.target.value;
		});
	}

	// Tool selection
	toolButtons.forEach((button) => {
		button.addEventListener("click", () => {
			// Remove active class from all tool buttons
			toolButtons.forEach((btn) => btn.classList.remove("active"));

			// Add active class to clicked button
			button.classList.add("active");

			// Set current tool
			currentTool = button.dataset.tool;
			
			// Update current settings based on the selected tool
			currentColor = toolColors[currentTool];
			currentWidth = toolSizes[currentTool];

			// Update canvas class to indicate eraser is active or not
			if (currentTool === "eraser") {
				canvas.classList.add("eraser-active");
			} else {
				canvas.classList.remove("eraser-active");
			}

			// Hide all settings panels first
			document.querySelectorAll(".tool-settings").forEach(panel => {
				panel.style.display = "none";
			});

			// Explicitly hide eraser cursor when switching tools
			const eraserCursor = document.getElementById("eraserCursor");
			if (eraserCursor) {
				eraserCursor.style.display = currentTool === "eraser" ? "block" : "none";

				// If eraser is selected, position the cursor at the current mouse position
				if (currentTool === "eraser") {
					// Get last known mouse position or use center of canvas as fallback
					const lastMouseEvent = window.lastMouseEvent || {
						clientX: window.innerWidth / 2,
						clientY: window.innerHeight / 2,
					};
					updateEraserCursor(lastMouseEvent);
				}
			}

			// Show settings for selected tool
			const settingsPanelId = `${currentTool}Settings`;
			const settingsPanel = document.getElementById(settingsPanelId);
			if (settingsPanel) {
				settingsPanel.style.display = "block";
			}

			if (currentTool === "eraser") {
				// Remove active class from all action tools
				document.querySelectorAll(".action-tools .tool").forEach((tool) => {
					tool.classList.remove("active");
				});

				const eraserSettings = document.getElementById("eraserSettings");
				if (eraserSettings) {
					eraserSettings.style.display = "block";
				}
				
				const eraserSize = toolSizes.eraser;
				const cursorSize = Math.max(10, eraserSize); // Minimum size of 10px
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

	// Users panel toggle functionality
	const usersPanel = document.getElementById("usersPanel");
	const toggleButton = document.getElementById("toggleUsersPanel");

	// Panel should be visible by default, so we'll only check for explicitly collapsed state
	const isPanelCollapsed = localStorage.getItem("usersPanelCollapsed") === "true";
	if (isPanelCollapsed) {
		usersPanel.classList.add("collapsed");
	}

	// Toggle on button click
	toggleButton.addEventListener("click", (e) => {
		e.stopPropagation(); // Prevent event from bubbling
		usersPanel.classList.toggle("collapsed");
		localStorage.setItem("usersPanelCollapsed", usersPanel.classList.contains("collapsed"));
	});

	// Show panel when clicking anywhere on it while collapsed
	usersPanel.addEventListener("click", (e) => {
		if (usersPanel.classList.contains("collapsed")) {
			usersPanel.classList.remove("collapsed");
			localStorage.setItem("usersPanelCollapsed", false);
		}
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

	// Update currentWidth when tool changes
	function updateToolSize() {
		currentColor = toolColors[currentTool];
		currentWidth = toolSizes[currentTool];
	}
});
