const requireMeetingAuthority = (req, res, next) => {
  const { role, rank } = req.user;

  const isANO = role === "ANO";
  const isSUO =
    role === "CADET" &&
    String(rank || "").trim().toLowerCase() ===
      "senior under officer";

  if (isANO || isSUO) {
    return next();
  }

  return res.status(403).json({
    message: "Only ANO or Senior Under Officer can manage meetings",
  });
};

module.exports = {
  requireMeetingAuthority,
};