// ... existing code ...
	// Add this event handler with the other socket.on events

	socket.on("checkOwnership", async (data) => {
		try {
			const { roomId, userId } = data;
			// Check if the user is the owner of the board
			const board = await Board.findOne({ _id: roomId });
			
			if (board && board.owner && board.owner.toString() === userId) {
				// User is the owner
				io.to(socket.id).emit("userRights", { isOwner: true });
				console.log(`User ${userId} is the owner of board ${roomId}`);
			} else {
				// User is not the owner
				io.to(socket.id).emit("userRights", { isOwner: false });
				console.log(`User ${userId} is NOT the owner of board ${roomId}`);
			}
		} catch (err) {
			console.error("Error checking ownership:", err);
		}
	});

	// ... existing code ... 