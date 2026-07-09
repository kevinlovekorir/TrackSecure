const mongoose = require("mongoose");
const crypto = require("crypto");

const deviceSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    imei: { type: String, trim: true },
    model: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    androidVersion: { type: String, trim: true },

    // Set once during device registration, used by the mobile app to authenticate
    // its background reports without asking the user to log in on-device.
    pairingToken: { type: String, default: () => crypto.randomBytes(24).toString("hex") },

    status: { type: String, enum: ["online", "offline"], default: "offline" },
    isLost: { type: Boolean, default: false },

    lastKnownLocation: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      recordedAt: Date
    },
    battery: {
      level: Number,
      charging: Boolean
    },
    network: {
      type: { type: String, enum: ["wifi", "mobile", "offline"], default: "offline" },
      carrier: String,
      ip: String
    },
    sim: {
      iccid: String,
      lastChangedAt: Date,
      alertOnChange: { type: Boolean, default: true }
    },
    lastSyncAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);
