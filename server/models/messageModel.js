const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
  {
    message: {
      // store an object containing ciphertext, nonce, senderPublicKey
      text: {
        ciphertext: { type: String, required: true },
        nonce: { type: String, required: true },
        senderPublicKey: { type: String, required: true },
      },
    },
    users: Array,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Messages", MessageSchema);