const express = require("express");
const Device = require("../models/Device");
const LocationHistory = require("../models/LocationHistory");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// ---- Owner-facing endpoints (JWT auth) ----

// Register a new device to the logged-in owner's account
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, phoneNumber, imei, model, manufacturer, androidVersion } = req.body;
    if (!name) return res.status(400).json({ message: "Device name is required" });

    const device = await Device.create({
      owner: req.userId,
      name,
      phoneNumber,
      imei,
      model,
      manufacturer,
      androidVersion
    });

    // pairingToken is returned once here — enter it into the mobile app during setup.
    return res.status(201).json({ device });
  } catch (err) {
    return res.status(500).json({ message: "Could not register device", error: err.message });
  }
});

// List all devices belonging to the logged-in owner
router.get("/", requireAuth, async (req, res) => {
  const devices = await Device.find({ owner: req.userId }).select("-pairingToken").sort({ createdAt: -1 });
  return res.json({ devices });
});

// Get a single device's full detail, including recent movement history
router.get("/:id", requireAuth, async (req, res) => {
  const device = await Device.findOne({ _id: req.params.id, owner: req.userId }).select("-pairingToken");
  if (!device) return res.status(404).json({ message: "Device not found" });

  const history = await LocationHistory.find({ device: device._id }).sort({ recordedAt: -1 }).limit(50);
  return res.json({ device, history });
});

// Mark a device as lost (triggers emergency-contact + alert flow — see commands.js)
router.post("/:id/lost", requireAuth, async (req, res) => {
  const device = await Device.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { isLost: true },
    { new: true }
  );
  if (!device) return res.status(404).json({ message: "Device not found" });
  return res.json({ device });
});

// ---- Device-facing endpoint (pairing token auth, not JWT) ----
// The Android app calls this in the background to report its own status.
// Never trust a device to report on behalf of a different device's ID.
router.post("/:id/report", async (req, res) => {
  try {
    const { pairingToken, lat, lng, accuracy, batteryLevel, charging, networkType, carrier, ip, simIccid } = req.body;
    const device = await Device.findById(req.params.id);
    if (!device || device.pairingToken !== pairingToken) {
      return res.status(401).json({ message: "Invalid device or pairing token" });
    }

    const now = new Date();
    let simAlert = false;

    if (simIccid && device.sim?.iccid && simIccid !== device.sim.iccid) {
      simAlert = true;
      device.sim.lastChangedAt = now;
    }
    device.sim = { ...device.sim?.toObject?.(), iccid: simIccid ?? device.sim?.iccid, alertOnChange: device.sim?.alertOnChange ?? true };

    if (lat != null && lng != null) {
      device.lastKnownLocation = { lat, lng, accuracy, recordedAt: now };
      await LocationHistory.create({ device: device._id, lat, lng, accuracy, battery: batteryLevel });
    }

    device.battery = { level: batteryLevel, charging: !!charging };
    device.network = { type: networkType || "offline", carrier, ip };
    device.status = "online";
    device.lastSyncAt = now;
    await device.save();

    return res.json({ ok: true, simAlert });
  } catch (err) {
    return res.status(500).json({ message: "Report failed", error: err.message });
  }
});

module.exports = router;
