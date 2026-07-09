const express = require("express");
const Device = require("../models/Device");
const Command = require("../models/Command");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Owner issues a recovery command: ring, lock, wipe, or a lock-screen message
router.post("/devices/:id/commands", requireAuth, async (req, res) => {
  try {
    const { action, payload } = req.body;
    const allowed = ["ring", "lock", "wipe", "message"];
    if (!allowed.includes(action)) return res.status(400).json({ message: `action must be one of ${allowed.join(", ")}` });

    const device = await Device.findOne({ _id: req.params.id, owner: req.userId });
    if (!device) return res.status(404).json({ message: "Device not found" });

    const command = await Command.create({ device: device._id, issuedBy: req.userId, action, payload });
    return res.status(201).json({ command });
  } catch (err) {
    return res.status(500).json({ message: "Could not issue command", error: err.message });
  }
});

// Owner views command history for a device
router.get("/devices/:id/commands", requireAuth, async (req, res) => {
  const device = await Device.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) return res.status(404).json({ message: "Device not found" });

  const commands = await Command.find({ device: device._id }).sort({ createdAt: -1 }).limit(50);
  return res.json({ commands });
});

// Device polls for pending commands using its pairing token (called by the mobile app)
router.get("/devices/:id/pending-commands", async (req, res) => {
  const { pairingToken } = req.query;
  const device = await Device.findById(req.params.id);
  if (!device || device.pairingToken !== pairingToken) {
    return res.status(401).json({ message: "Invalid device or pairing token" });
  }

  const pending = await Command.find({ device: device._id, status: "pending" }).sort({ createdAt: 1 });
  return res.json({ commands: pending });
});

// Device acknowledges a command was delivered/executed
router.post("/commands/:commandId/ack", async (req, res) => {
  const { pairingToken } = req.body;
  const command = await Command.findById(req.params.commandId).populate("device");
  if (!command || command.device.pairingToken !== pairingToken) {
    return res.status(401).json({ message: "Invalid device or pairing token" });
  }
  command.status = "delivered";
  await command.save();
  return res.json({ ok: true });
});

module.exports = router;
