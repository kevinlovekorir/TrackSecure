const mongoose = require("mongoose");

const locationHistorySchema = new mongoose.Schema(
  {
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
    battery: Number,
    recordedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Auto-expire raw location pings after 90 days to keep the collection lean;
// keep aggregated history at the application layer if longer retention is needed.
locationHistorySchema.index({ recordedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("LocationHistory", locationHistorySchema);
