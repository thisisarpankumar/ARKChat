const {
  login,
  register,
  getAllUsers,
  setAvatar,
  logOut,
  setPublicKey,
} = require("../controllers/userController");

const router = require("express").Router();

router.post("/login", login);
router.post("/register", register);
router.get("/allusers/:id", getAllUsers);
router.post("/setavatar/:id", setAvatar);
router.get("/logout/:id", logOut);

// new: save public key for a user (client sends publicKey)
router.post("/setpubkey/:id", setPublicKey);

module.exports = router;