const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

class ImageHandler {
  constructor(mongoUri) {
    this.mongoUri = mongoUri;
    this.client = new MongoClient(mongoUri);
    this.db = null;
    this.collection = null;
  }

  async connect() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db('collaboard');
      this.collection = this.db.collection('images');
    }
  }

  async saveImage(roomId, imageData) {
    await this.connect();
    
    // Store the complete image data
    const result = await this.collection.insertOne({
      roomId,
      imageData: imageData.imageData, // Base64 string of the image
      position: imageData.position,
      size: imageData.size,
      timestamp: imageData.timestamp,
      createdAt: new Date()
    });

    return result.insertedId;
  }

  async getImages(roomId) {
    await this.connect();
    
    // Get all images for the room, sorted by timestamp
    const images = await this.collection
      .find({ roomId })
      .sort({ timestamp: 1 })
      .toArray();

    return images;
  }

  async deleteImages(roomId) {
    await this.connect();
    
    // Delete all images for the room
    const result = await this.collection.deleteMany({ roomId });
    return result.deletedCount;
  }

  async updateImage(imageId, updates) {
    await this.connect();
    
    const result = await this.collection.updateOne(
      { _id: new ObjectId(imageId) },
      { $set: updates }
    );

    return result.modifiedCount;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.db = null;
      this.collection = null;
    }
  }
}

module.exports = ImageHandler; 