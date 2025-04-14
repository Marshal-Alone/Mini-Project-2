const mongoose = require("mongoose");

const BoardSchema = new mongoose.Schema({
	roomId: {
		type: String,
		required: true,
		unique: true,
		index: true,
	},
	name: {
		type: String,
		required: true,
		default: "Untitled Board",
	},
	history: [
		{
			tool: String,
			startX: Number,
			startY: Number,
			endX: Number,
			endY: Number,
			width: Number,
			color: String,
			opacity: Number,
			// For brush paths
			points: [
				{
					x: Number,
					y: Number,
				},
			],
			isFinalSegment: Boolean,
			// For shapes
			centerX: Number,
			centerY: Number,
			radius: Number,
			height: Number,
			// For text
			text: String,
			fontSize: Number,
			x: Number,
			y: Number,
			// For line width
			lineWidth: Number,
			// Timestamps for ordering
			timestamp: Number,
		},
	],
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
	isPasswordProtected: {
		type: Boolean,
		default: false,
	},
	password: String,
	createdBy: String,
});

// Add a virtual property for the code
BoardSchema.virtual("code").get(function () {
	if (!this.roomId) return "000000";

	// Simple hash function to generate a numeric code from a string
	let numericValue = 0;
	for (let i = 0; i < this.roomId.length; i++) {
		numericValue += this.roomId.charCodeAt(i);
	}

	// Ensure it's exactly 6 digits by using modulo and padding
	let sixDigitCode = ((numericValue % 900000) + 100000).toString();
	return sixDigitCode;
});

// Update the updatedAt timestamp before saving
BoardSchema.pre("save", function (next) {
	this.updatedAt = Date.now();
	next();
});

module.exports = mongoose.model("Board", BoardSchema);
