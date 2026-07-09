const mongoose = require("mongoose");

const commandSchema = new mongoose.Schema(
  {
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ["ring", "lock", "wipe", "message"], required: true },
    payload: { type: mongoose.Schema.Types.Mixed }, // e.g. { text: "Please call 0712..." } for `message`
    status: { type: String, enum: ["pending", "delivered", "failed"], default: "pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Command", commandSchema);
