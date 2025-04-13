const mongoose = require('mongoose');

const BoardSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        default: 'Untitled Board'
    },
    history: [{
        tool: String,
        startX: Number,
        startY: Number,
        endX: Number,
        endY: Number,
        width: Number,
        color: String,
        opacity: Number,
        // For brush paths
        points: [{
            x: Number,
            y: Number
        }],
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
        timestamp: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isPasswordProtected: {
        type: Boolean,
        default: false
    },
    password: String,
    createdBy: String
});

// Update the updatedAt timestamp before saving
BoardSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Board', BoardSchema);
