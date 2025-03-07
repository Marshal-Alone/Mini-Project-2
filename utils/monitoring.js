const mongoose = require("mongoose");

class MonitoringService {
	static async checkHealth() {
		const health = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			services: {
				database: {
					status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
					responseTime: null,
				},
				memory: {
					usage: process.memoryUsage(),
					freeMemory: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
				},
			},
		};

		// Check database response time
		const start = Date.now();
		try {
			await mongoose.connection.db.admin().ping();
			health.services.database.responseTime = Date.now() - start;
		} catch (err) {
			health.status = "unhealthy";
			health.services.database.error = err.message;
		}

		return health;
	}

	static getSystemMetrics() {
		return {
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			cpu: process.cpuUsage(),
		};
	}
}

module.exports = MonitoringService;
