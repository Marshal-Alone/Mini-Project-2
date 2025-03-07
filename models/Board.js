const mongoose = require("mongoose");

const boardSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	code: {
		type: String,
		unique: true,
		sparse: true,
	},
	password: {
		type: String,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	lastAccessed: {
		type: Date,
		default: Date.now,
	},
	collaborators: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	],
});

module.exports = mongoose.model("Board", boardSchema);
